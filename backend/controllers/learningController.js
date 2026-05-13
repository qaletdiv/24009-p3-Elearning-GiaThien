'use strict';

const { sequelize } = require('../models');
const {
  Course,
  CourseSection,
  Discussion,
  Enrollment,
  Lesson,
  LessonProgress,
  User,
} = require('../models');

const canPreviewCourse = (user) => {
  return user?.role === 'admin' || user?.role === 'instructor';
};

const loadCourseForLearning = async (slug) => {
  return Course.findOne({
    where: { slug, status: 'public' },
    include: [
      {
        model: User,
        as: 'instructor',
        attributes: ['id', 'fullName', 'avatarUrl'],
      },
      {
        model: CourseSection,
        as: 'sections',
        attributes: ['id', 'title', 'sortOrder'],
        include: [
          {
            model: Lesson,
            as: 'lessons',
            attributes: [
              'id',
              'courseId',
              'sectionId',
              'title',
              'lessonType',
              'content',
              'videoUrl',
              'durationSeconds',
              'isPreview',
              'isPublished',
              'sortOrder',
            ],
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
      list.push({
        ...lesson.toJSON(),
        sectionTitle: section.title,
      });
    }
  }
  return list;
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

const buildLearningState = (course, progressMap, previewMode) => {
  const flatLessons = flattenLessons(course);

  const lessonStateMap = new Map();

  flatLessons.forEach((lesson, index) => {
    const prevLesson = flatLessons[index - 1];
    const isCompleted = Boolean(progressMap.get(lesson.id));
    const isUnlocked =
      previewMode ||
      lesson.isPreview ||
      index === 0 ||
      Boolean(prevLesson && progressMap.get(prevLesson.id));

    lessonStateMap.set(lesson.id, {
      isCompleted,
      isUnlocked,
    });
  });

  const sections = (course.sections || []).map((section) => ({
    id: section.id,
    title: section.title,
    sortOrder: section.sortOrder,
    lessons: (section.lessons || []).map((lesson) => ({
      ...lesson.toJSON(),
      ...lessonStateMap.get(lesson.id),
    })),
  }));

  return {
    flatLessons,
    sections,
    lessonStateMap,
  };
};

const getLessonProgressMap = async (enrollmentId) => {
  if (!enrollmentId) return new Map();

  const progresses = await LessonProgress.findAll({
    where: {
      enrollmentId,
      isCompleted: true,
    },
    attributes: ['lessonId'],
  });

  return new Map(progresses.map((item) => [Number(item.lessonId), true]));
};

const getLearningData = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const requestedLessonId = Number(req.query.lessonId || 0);

    const course = await loadCourseForLearning(slug);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học',
      });
    }

    const previewMode = canPreviewCourse(req.user);

    let enrollment = null;
    if (!previewMode) {
      enrollment = await Enrollment.findOne({
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
    } else {
      enrollment = await Enrollment.findOne({
        where: {
          userId: req.user.id,
          courseId: course.id,
        },
      });
    }

    const progressMap = await getLessonProgressMap(enrollment?.id);
    const { flatLessons, sections, lessonStateMap } = buildLearningState(course, progressMap, previewMode);

    if (flatLessons.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          course: {
            id: course.id,
            title: course.title,
            slug: course.slug,
            coverImageUrl: course.coverImageUrl,
            instructor: course.instructor,
          },
          sections,
          currentLesson: null,
          navigation: {
            previousLesson: null,
            nextLesson: null,
          },
          previewMode,
          progressPercent: Number(enrollment?.progressPercent || 0),
        },
      });
    }

    const fallbackLesson = flatLessons.find((lesson) => lessonStateMap.get(lesson.id)?.isUnlocked) || flatLessons[0];
    const currentLesson = requestedLessonId
      ? flatLessons.find((lesson) => lesson.id === requestedLessonId)
      : fallbackLesson;

    if (!currentLesson) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài học',
      });
    }

    const currentState = lessonStateMap.get(currentLesson.id);
    if (!currentState?.isUnlocked) {
      return res.status(403).json({
        success: false,
        message: 'Bài học này chưa được mở khóa',
      });
    }

    const currentIndex = flatLessons.findIndex((lesson) => lesson.id === currentLesson.id);
    const previousLesson = currentIndex > 0 ? flatLessons[currentIndex - 1] : null;
    const nextLesson = currentIndex < flatLessons.length - 1 ? flatLessons[currentIndex + 1] : null;

    const discussions = await Discussion.findAll({
      where: { lessonId: currentLesson.id },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'fullName', 'avatarUrl'],
        },
      ],
      order: [['createdAt', 'ASC']],
    });

    return res.status(200).json({
      success: true,
      data: {
        course: {
          id: course.id,
          title: course.title,
          slug: course.slug,
          coverImageUrl: course.coverImageUrl,
          instructor: course.instructor,
        },
        sections,
        currentLesson: {
          ...currentLesson,
          ...currentState,
          discussions,
        },
        navigation: {
          previousLesson: previousLesson
            ? {
                id: previousLesson.id,
                title: previousLesson.title,
                lessonType: previousLesson.lessonType,
                isUnlocked: lessonStateMap.get(previousLesson.id)?.isUnlocked || false,
              }
            : null,
          nextLesson: nextLesson
            ? {
                id: nextLesson.id,
                title: nextLesson.title,
                lessonType: nextLesson.lessonType,
                isUnlocked: lessonStateMap.get(nextLesson.id)?.isUnlocked || false,
              }
            : null,
        },
        previewMode,
        progressPercent: Number(enrollment?.progressPercent || 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

const completeLesson = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const lessonId = Number(req.params.lessonId || 0);
    const watchedSeconds = Number(req.body.watchedSeconds || 0);

    const lesson = await Lesson.findByPk(lessonId, { transaction });
    if (!lesson || !lesson.isPublished) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài học',
      });
    }

    const course = await loadCourseForLearning(req.body.courseSlug);
    if (!course || course.id !== lesson.courseId) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học',
      });
    }

    const previewMode = canPreviewCourse(req.user);
    if (previewMode) {
      await transaction.rollback();
      return res.status(200).json({
        success: true,
        message: 'Đang ở chế độ xem trước, không lưu tiến độ',
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

    const progressMap = await getLessonProgressMap(enrollment.id);
    const { lessonStateMap } = buildLearningState(course, progressMap, false);

    if (!lessonStateMap.get(lesson.id)?.isUnlocked) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Bài học này chưa được mở khóa',
      });
    }

    const [progress] = await LessonProgress.findOrCreate({
      where: {
        enrollmentId: enrollment.id,
        lessonId: lesson.id,
      },
      defaults: {
        enrollmentId: enrollment.id,
        lessonId: lesson.id,
        isCompleted: true,
        watchedSeconds,
        completedAt: new Date(),
      },
      transaction,
    });

    if (!progress.isCompleted) {
      progress.isCompleted = true;
      progress.completedAt = new Date();
    }

    if (watchedSeconds > progress.watchedSeconds) {
      progress.watchedSeconds = watchedSeconds;
    }

    await progress.save({ transaction });
    await recalculateEnrollmentProgress(enrollment, transaction);

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: 'Đã đánh dấu hoàn thành bài học',
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const createDiscussion = async (req, res, next) => {
  try {
    const lessonId = Number(req.params.lessonId || 0);
    const { content, parentId } = req.body;

    if (!content || !content.trim()) {
      return res.status(422).json({
        success: false,
        message: 'Nội dung thảo luận không được để trống',
      });
    }

    const lesson = await Lesson.findByPk(lessonId);
    if (!lesson || !lesson.isPublished) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài học',
      });
    }

    const course = await loadCourseForLearning(req.body.courseSlug);
    if (!course || course.id !== lesson.courseId) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học',
      });
    }

    const previewMode = canPreviewCourse(req.user);

    if (!previewMode) {
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

      const progressMap = await getLessonProgressMap(enrollment.id);
      const { lessonStateMap } = buildLearningState(course, progressMap, false);

      if (!lessonStateMap.get(lesson.id)?.isUnlocked) {
        return res.status(403).json({
          success: false,
          message: 'Bài học này chưa được mở khóa',
        });
      }
    }

    const discussion = await Discussion.create({
      lessonId: lesson.id,
      userId: req.user.id,
      parentId: parentId || null,
      content: content.trim(),
    });

    const freshDiscussion = await Discussion.findByPk(discussion.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'fullName', 'avatarUrl'],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: 'Đăng thảo luận thành công',
      data: freshDiscussion,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLearningData,
  completeLesson,
  createDiscussion,
};