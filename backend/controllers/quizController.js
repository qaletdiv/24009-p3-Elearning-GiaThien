'use strict';

const { sequelize } = require('../models');
const {
  Course,
  CourseSection,
  Enrollment,
  Lesson,
  LessonProgress,
  Quiz,
  QuizAnswer,
  QuizAttempt,
  QuizAttemptAnswer,
  QuizQuestion,
} = require('../models');

const loadCourseForLearning = async (slug, transaction = null) => {
  return Course.findOne({
    where: { slug, status: 'public' },
    include: [
      {
        model: CourseSection,
        as: 'sections',
        attributes: ['id', 'title', 'sortOrder'],
        include: [
          {
            model: Lesson,
            as: 'lessons',
            attributes: ['id', 'title', 'lessonType', 'isPreview', 'isPublished', 'sortOrder'],
            where: { isPublished: true },
            required: false,
          },
        ],
      },
    ],
    order: [
      [{ model: CourseSection, as: 'sections' }, 'sortOrder', 'ASC'],
      [{ model: CourseSection, as: 'sections' }, { model: Lesson, as: 'lessons' }, 'sortOrder', 'ASC'],
    ],
    transaction,
  });
};

const flattenLessons = (course) => {
  const list = [];
  for (const section of course.sections || []) {
    for (const lesson of section.lessons || []) {
      list.push(lesson.toJSON());
    }
  }
  return list;
};

const getProgressMap = async (enrollmentId, transaction = null) => {
  const progresses = await LessonProgress.findAll({
    where: {
      enrollmentId,
      isCompleted: true,
    },
    attributes: ['lessonId'],
    transaction,
  });

  return new Map(progresses.map((item) => [Number(item.lessonId), true]));
};

const buildLessonStateMap = (course, progressMap) => {
  const flatLessons = flattenLessons(course);
  const map = new Map();

  flatLessons.forEach((lesson, index) => {
    const prevLesson = flatLessons[index - 1];

    const isUnlocked =
      lesson.isPreview ||
      index === 0 ||
      (prevLesson && progressMap.get(prevLesson.id));

    const isCompleted = Boolean(progressMap.get(lesson.id));

    map.set(lesson.id, {
      isUnlocked: Boolean(isUnlocked),
      isCompleted,
    });
  });

  return { flatLessons, map };
};

const recalculateEnrollmentProgress = async (enrollment, transaction) => {
  const totalLessons = await Lesson.count({
    where: {
      courseId: enrollment.courseId,
      isPublished: true,
    },
    transaction,
  });

  const completedLessons = await LessonProgress.count({
    where: {
      enrollmentId: enrollment.id,
      isCompleted: true,
    },
    transaction,
  });

  enrollment.progressPercent = totalLessons
    ? Number(((completedLessons / totalLessons) * 100).toFixed(2))
    : 0;

  if (totalLessons > 0 && completedLessons === totalLessons) {
    enrollment.completedAt = new Date();
  }

  await enrollment.save({ transaction });
};

const getQuizByLesson = async (req, res, next) => {
  try {
    const { slug, lessonId } = req.params;

    const course = await loadCourseForLearning(slug);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học',
      });
    }

    const enrollment = await Enrollment.findOne({
      where: {
        userId: req.user.id,
        courseId: course.id,
      },
    });

    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chưa sở hữu khóa học này',
      });
    }

    const progressMap = await getProgressMap(enrollment.id);
    const { flatLessons, map } = buildLessonStateMap(course, progressMap);

    const lesson = flatLessons.find((l) => Number(l.id) === Number(lessonId));

    if (!lesson || lesson.lessonType !== 'quiz') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy quiz hợp lệ',
      });
    }

    if (!map.get(lesson.id)?.isUnlocked) {
      return res.status(403).json({
        success: false,
        message: 'Quiz chưa được mở khóa',
      });
    }

    const quiz = await Quiz.findOne({
      where: { lessonId: lesson.id },
      include: [
        {
          model: QuizQuestion,
          as: 'questions',
          attributes: ['id', 'questionText', 'sortOrder'],
          include: [
            {
              model: QuizAnswer,
              as: 'answers',
              attributes: ['id', 'answerText'],
            },
          ],
        },
      ],
      order: [
        [{ model: QuizQuestion, as: 'questions' }, 'sortOrder', 'ASC'],
        [{ model: QuizQuestion, as: 'questions' }, { model: QuizAnswer, as: 'answers' }, 'id', 'ASC'],
      ],
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz chưa được tạo',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        lesson,
        quiz,
      },
    });
  } catch (error) {
    next(error);
  }
};

const submitQuiz = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { slug, lessonId } = req.params;
    const submittedAnswers = Array.isArray(req.body.answers) ? req.body.answers : [];

    const course = await loadCourseForLearning(slug, transaction);
    if (!course) throw new Error('Không tìm thấy khóa học');

    const enrollment = await Enrollment.findOne({
      where: { userId: req.user.id, courseId: course.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!enrollment) throw new Error('Chưa enroll');

    const progressMap = await getProgressMap(enrollment.id, transaction);
    const { flatLessons, map } = buildLessonStateMap(course, progressMap);

    const lesson = flatLessons.find((l) => Number(l.id) === Number(lessonId));
    if (!lesson || lesson.lessonType !== 'quiz') throw new Error('Lesson không hợp lệ');

    if (!map.get(lesson.id)?.isUnlocked) throw new Error('Chưa unlock');

    const quiz = await Quiz.findOne({
      where: { lessonId: lesson.id },
      include: [
        {
          model: QuizQuestion,
          as: 'questions',
          include: [{ model: QuizAnswer, as: 'answers' }],
        },
      ],
      transaction,
    });

    if (!quiz) throw new Error('Quiz chưa có');

    const answerMap = new Map(
      submittedAnswers.map((a) => [Number(a.questionId), Number(a.answerId)])
    );

    let correctCount = 0;

    const attempt = await QuizAttempt.create(
      {
        enrollmentId: enrollment.id,
        quizId: quiz.id,
        score: 0,
        isPassed: false,
        startedAt: new Date(),
        submittedAt: new Date(),
      },
      { transaction }
    );

    for (const question of quiz.questions) {
      const answerId = answerMap.get(question.id);
      if (!answerId) continue;

      const answer = question.answers.find((a) => a.id === answerId);
      if (!answer) continue;

      const isCorrect = Boolean(answer.isCorrect);
      if (isCorrect) correctCount++;

      await QuizAttemptAnswer.create(
        {
          attemptId: attempt.id,
          questionId: question.id,
          answerId: answer.id,
          isCorrect,
        },
        { transaction }
      );
    }

    const total = quiz.questions.length;
    const score = total ? Number(((correctCount / total) * 100).toFixed(2)) : 0;

    attempt.score = score;
    attempt.isPassed = score >= Number(quiz.passScore);
    await attempt.save({ transaction });

    if (attempt.isPassed) {
      const [progress] = await LessonProgress.findOrCreate({
        where: {
          enrollmentId: enrollment.id,
          lessonId: lesson.id,
        },
        defaults: {
          enrollmentId: enrollment.id,
          lessonId: lesson.id,
          isCompleted: true,
          completedAt: new Date(),
        },
        transaction,
      });

      progress.isCompleted = true;
      progress.completedAt = new Date();
      await progress.save({ transaction });

      await recalculateEnrollmentProgress(enrollment, transaction);
    }

    await transaction.commit();

    return res.json({
      success: true,
      data: {
        score,
        isPassed: attempt.isPassed,
        correctCount,
        totalQuestions: total,
      },
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

module.exports = {
  getQuizByLesson,
  submitQuiz,
};