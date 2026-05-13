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

const loadCourseForLearning = async (slug) => {
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

const getProgressMap = async (enrollmentId) => {
  const progresses = await LessonProgress.findAll({
    where: {
      enrollmentId,
      isCompleted: true,
    },
    attributes: ['lessonId'],
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
      Boolean(prevLesson && progressMap.get(prevLesson.id));

    const isCompleted = Boolean(progressMap.get(lesson.id));

    map.set(lesson.id, {
      isUnlocked,
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

    const lesson = flatLessons.find((item) => Number(item.id) === Number(lessonId));
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài quiz',
      });
    }

    if (lesson.lessonType !== 'quiz') {
      return res.status(400).json({
        success: false,
        message: 'Bài học này không phải quiz',
      });
    }

    if (!map.get(lesson.id)?.isUnlocked) {
      return res.status(403).json({
        success: false,
        message: 'Quiz này chưa được mở khóa',
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

    const latestAttempt = await QuizAttempt.findOne({
      where: {
        enrollmentId: enrollment.id,
        quizId: quiz.id,
      },
      order: [['submittedAt', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      data: {
        course: {
          id: course.id,
          title: course.title,
          slug: course.slug,
        },
        lesson,
        quiz,
        latestAttempt: latestAttempt
          ? {
              id: latestAttempt.id,
              score: Number(latestAttempt.score),
              isPassed: latestAttempt.isPassed,
              submittedAt: latestAttempt.submittedAt,
            }
          : null,
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

    const course = await loadCourseForLearning(slug);
    if (!course) {
      await transaction.rollback();
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
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!enrollment) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Bạn chưa sở hữu khóa học này',
      });
    }

    const progressMap = await getProgressMap(enrollment.id);
    const { flatLessons, map } = buildLessonStateMap(course, progressMap);

    const lesson = flatLessons.find((item) => Number(item.id) === Number(lessonId));
    if (!lesson || lesson.lessonType !== 'quiz') {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy quiz hợp lệ',
      });
    }

    if (!map.get(lesson.id)?.isUnlocked) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Quiz này chưa được mở khóa',
      });
    }

    const quiz = await Quiz.findOne({
      where: { lessonId: lesson.id },
      include: [
        {
          model: QuizQuestion,
          as: 'questions',
          include: [
            {
              model: QuizAnswer,
              as: 'answers',
            },
          ],
        },
      ],
      order: [
        [{ model: QuizQuestion, as: 'questions' }, 'sortOrder', 'ASC'],
        [{ model: QuizQuestion, as: 'questions' }, { model: QuizAnswer, as: 'answers' }, 'id', 'ASC'],
      ],
      transaction,
    });

    if (!quiz) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Quiz chưa được tạo',
      });
    }

    const answerMap = new Map(
      submittedAnswers.map((item) => [Number(item.questionId), Number(item.answerId)])
    );

    let correctCount = 0;
    const totalQuestions = quiz.questions.length;

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
      const selectedAnswerId = answerMap.get(Number(question.id));
      if (!selectedAnswerId) continue;

      const selectedAnswer = question.answers.find(
        (answer) => Number(answer.id) === Number(selectedAnswerId)
      );

      if (!selectedAnswer) continue;

      const isCorrect = Boolean(selectedAnswer.isCorrect);
      if (isCorrect) correctCount += 1;

      await QuizAttemptAnswer.create(
        {
          attemptId: attempt.id,
          questionId: question.id,
          answerId: selectedAnswer.id,
          isCorrect,
        },
        { transaction }
      );
    }

    const score = totalQuestions
      ? Number(((correctCount / totalQuestions) * 100).toFixed(2))
      : 0;
    const isPassed = score >= Number(quiz.passScore);

    attempt.score = score;
    attempt.isPassed = isPassed;
    await attempt.save({ transaction });

    if (isPassed) {
      const [progress] = await LessonProgress.findOrCreate({
        where: {
          enrollmentId: enrollment.id,
          lessonId: lesson.id,
        },
        defaults: {
          enrollmentId: enrollment.id,
          lessonId: lesson.id,
          isCompleted: true,
          watchedSeconds: 0,
          completedAt: new Date(),
        },
        transaction,
      });

      progress.isCompleted = true;
      progress.completedAt = new Date();
      await progress.save({ transaction });

      await recalculateEnrollmentProgress(enrollment, transaction);
    }

    const currentIndex = flatLessons.findIndex((item) => Number(item.id) === Number(lesson.id));
    const nextLesson = currentIndex >= 0 && currentIndex < flatLessons.length - 1 ? flatLessons[currentIndex + 1] : null;

    await transaction.commit();

    return res.status(200).json({
      success: true,
      data: {
        attemptId: attempt.id,
        score,
        passScore: Number(quiz.passScore),
        isPassed,
        correctCount,
        totalQuestions,
        nextLesson: nextLesson
          ? {
              id: nextLesson.id,
              title: nextLesson.title,
              lessonType: nextLesson.lessonType,
            }
          : null,
      },
      message: isPassed
        ? 'Chúc mừng, bạn đã vượt qua bài kiểm tra'
        : 'Bạn chưa đạt. Vui lòng làm lại để tiếp tục',
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};
const createQuiz = async (req, res, next) => {
  try {
    const { lessonId } = req.params
    const { title, passScore, timeLimitMinutes } = req.body

    const lesson = await Lesson.findByPk(lessonId)
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lesson',
      })
    }

    if (lesson.lessonType !== 'quiz') {
      return res.status(400).json({
        success: false,
        message: 'Lesson này không phải loại quiz',
      })
    }

    const existingQuiz = await Quiz.findOne({ where: { lessonId: lesson.id } })
    if (existingQuiz) {
      return res.status(409).json({
        success: false,
        message: 'Lesson này đã có quiz',
      })
    }

    const quiz = await Quiz.create({
      lessonId: lesson.id,
      title,
      passScore: Number(passScore || 80),
      timeLimitMinutes: timeLimitMinutes || null,
    })

    return res.status(201).json({
      success: true,
      message: 'Tạo quiz thành công',
      data: quiz,
    })
  } catch (error) {
    next(error)
  }
}

const createQuestion = async (req, res, next) => {
  try {
    const { quizId } = req.params
    const { questionText, sortOrder } = req.body

    const quiz = await Quiz.findByPk(quizId)
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy quiz',
      })
    }

    const question = await QuizQuestion.create({
      quizId: quiz.id,
      questionText,
      sortOrder: Number(sortOrder || 0),
    })

    return res.status(201).json({
      success: true,
      message: 'Tạo câu hỏi thành công',
      data: question,
    })
  } catch (error) {
    next(error)
  }
}

const createAnswer = async (req, res, next) => {
  try {
    const { questionId } = req.params
    const { answerText, isCorrect } = req.body

    const question = await QuizQuestion.findByPk(questionId)
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy câu hỏi',
      })
    }

    const answer = await QuizAnswer.create({
      questionId: question.id,
      answerText,
      isCorrect: Boolean(isCorrect),
    })

    return res.status(201).json({
      success: true,
      message: 'Tạo đáp án thành công',
      data: answer,
    })
  } catch (error) {
    next(error)
  }
}
module.exports = {
  getQuizByLesson,
  submitQuiz,
  createQuiz,
  createQuestion,
  createAnswer,
}