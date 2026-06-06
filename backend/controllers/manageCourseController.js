'use strict';

const { Op } = require('sequelize');
const {
  sequelize,
  Category,
  Course,
  CourseSection,
  Lesson,
  Quiz,
  QuizQuestion,
  QuizAnswer,
  Enrollment,
  User,
  Role,
  LessonProgress,
  QuizAttempt,
  QuizAttemptAnswer,
} = require('../models');

const serializeCourse = (course) => ({
  id: course.id,
  instructorId: course.instructorId,
  categoryId: course.categoryId,
  title: course.title,
  slug: course.slug,
  shortDescription: course.shortDescription,
  description: course.description,
  coverImageUrl: course.coverImageUrl,
  trailerUrl: course.trailerUrl,
  price: Number(course.price || 0),
  level: course.level,
  status: course.status,
  isFree: course.isFree,
  ratingAvg: Number(course.ratingAvg || 0),
  ratingCount: course.ratingCount || 0,
  createdAt: course.createdAt,
  updatedAt: course.updatedAt,
  category: course.category
    ? {
        id: course.category.id,
        name: course.category.name,
        slug: course.category.slug,
      }
    : null,
  instructor: course.instructor
    ? {
        id: course.instructor.id,
        fullName: course.instructor.fullName,
        email: course.instructor.email,
        avatarUrl: course.instructor.avatarUrl,
      }
    : null,
});

const ensureCourseAccess = async (courseId, reqUser) => {
  const course = await Course.findByPk(courseId, {
    include: [
      { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
      { model: User, as: 'instructor', attributes: ['id', 'fullName', 'email', 'avatarUrl'] },
    ],
  });

  if (!course) {
    const err = new Error('Không tìm thấy khóa học');
    err.status = 404;
    throw err;
  }

  if (reqUser.role !== 'admin' && Number(course.instructorId) !== Number(reqUser.id)) {
    const err = new Error('Bạn không có quyền truy cập khóa học này');
    err.status = 403;
    throw err;
  }

  return course;
};

const ensureSectionAccess = async (sectionId, reqUser) => {
  const section = await CourseSection.findByPk(sectionId);
  if (!section) {
    const err = new Error('Không tìm thấy chương học');
    err.status = 404;
    throw err;
  }

  const course = await ensureCourseAccess(section.courseId, reqUser);
  return { section, course };
};

const ensureLessonAccess = async (lessonId, reqUser) => {
  const lesson = await Lesson.findByPk(lessonId);
  if (!lesson) {
    const err = new Error('Không tìm thấy bài học');
    err.status = 404;
    throw err;
  }

  const course = await ensureCourseAccess(lesson.courseId, reqUser);
  return { lesson, course };
};

const ensureQuizAccess = async (quizId, reqUser) => {
  const quiz = await Quiz.findByPk(quizId);
  if (!quiz) {
    const err = new Error('Không tìm thấy quiz');
    err.status = 404;
    throw err;
  }

  const { lesson, course } = await ensureLessonAccess(quiz.lessonId, reqUser);
  return { quiz, lesson, course };
};

const ensureQuestionAccess = async (questionId, reqUser) => {
  const question = await QuizQuestion.findByPk(questionId);
  if (!question) {
    const err = new Error('Không tìm thấy câu hỏi');
    err.status = 404;
    throw err;
  }

  const { quiz, lesson, course } = await ensureQuizAccess(question.quizId, reqUser);
  return { question, quiz, lesson, course };
};

// ==========================================
// THÊM MỚI: LẤY DANH SÁCH GIẢNG VIÊN ĐỂ ASSIGN
// ==========================================
const getInstructorsList = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền lấy danh sách giảng viên',
      });
    }

    const instructors = await User.findAll({
      where: {
        status: 'active'
      },
      include: [
        {
          model: Role,
          as: 'roleInfo',
          where: {
            code: ['instructor', 'admin']
          },
          attributes: []
        }
      ],
      attributes: ['id', 'fullName', 'email'],
      order: [['fullName', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      data: instructors,
    });
  } catch (error) {
    next(error);
  }
};

const getManageCourses = async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const offset = (page - 1) * limit;

    const keyword = (req.query.keyword || '').trim();
    const status = (req.query.status || '').trim();
    const categoryId = req.query.categoryId;

    const where = {};

    if (req.user.role === 'instructor') {
      where.instructorId = req.user.id;
    }

    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { slug: { [Op.like]: `%${keyword}%` } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (categoryId) {
      where.categoryId = Number(categoryId);
    }

    const { rows, count } = await Course.findAndCountAll({
      where,
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
        { model: User, as: 'instructor', attributes: ['id', 'fullName', 'email', 'avatarUrl'] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return res.status(200).json({
      success: true,
      data: {
        items: rows.map(serializeCourse),
        pagination: {
          page,
          limit,
          totalItems: count,
          totalPages: Math.max(1, Math.ceil(count / limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const getManageCourseDetail = async (req, res, next) => {
  try {
    const course = await ensureCourseAccess(req.params.courseId, req.user);

    return res.status(200).json({
      success: true,
      data: serializeCourse(course),
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// CẬP NHẬT: LOGIC TẠO KHÓA HỌC CHO PHÉP ASSIGN
// ==========================================
const createManageCourse = async (req, res, next) => {
  try {
    const {
      categoryId,
      instructorId, 
      title,
      slug,
      shortDescription,
      description,
      coverImageUrl,
      trailerUrl,
      price,
      level,
      status,
      isFree,
    } = req.body;

    const existingCourse = await Course.findOne({ where: { slug } });
    if (existingCourse) {
      return res.status(409).json({
        success: false,
        message: 'Slug khóa học đã tồn tại',
      });
    }

    if (categoryId) {
      const category = await Category.findByPk(categoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Danh mục không tồn tại',
        });
      }
    }

    const finalIsFree = isFree !== undefined ? Boolean(isFree) : Number(price || 0) === 0;
    const finalPrice = finalIsFree ? 0 : Number(price || 0);
    
    // FIX BUG_009: Nếu là Admin và có chọn giảng viên phụ trách, lấy instructorId đó, ngược lại mặc định gán cho mình
    const finalInstructorId = (req.user.role === 'admin' && instructorId) ? Number(instructorId) : req.user.id;

    const course = await Course.create({
      instructorId: finalInstructorId,
      categoryId: categoryId || null,
      title,
      slug,
      shortDescription: shortDescription || null,
      description: description || null,
      coverImageUrl: coverImageUrl || null,
      trailerUrl: trailerUrl || null,
      price: finalPrice,
      level: level || null,
      status: status || 'draft',
      isFree: finalIsFree,
    });

    const freshCourse = await Course.findByPk(course.id, {
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
        { model: User, as: 'instructor', attributes: ['id', 'fullName', 'email', 'avatarUrl'] },
      ],
    });

    return res.status(201).json({
      success: true,
      message: 'Tạo khóa học thành công',
      data: serializeCourse(freshCourse),
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// CẬP NHẬT: LOGIC SỬA KHÓA HỌC CHO PHÉP ASSIGN
// ==========================================
const updateManageCourse = async (req, res, next) => {
  try {
    const course = await ensureCourseAccess(req.params.courseId, req.user);

    const {
      categoryId,
      instructorId, 
      title,
      slug,
      shortDescription,
      description,
      coverImageUrl,
      trailerUrl,
      price,
      level,
      status,
      isFree,
    } = req.body;

    const duplicatedSlug = await Course.findOne({
      where: {
        slug,
        id: { [Op.ne]: course.id },
      },
    });

    if (duplicatedSlug) {
      return res.status(409).json({
        success: false,
        message: 'Slug khóa học đã tồn tại',
      });
    }

    if (categoryId) {
      const category = await Category.findByPk(categoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Danh mục không tồn tại',
        });
      }
    }

    const finalIsFree = isFree !== undefined ? Boolean(isFree) : (Number(price || 0) === 0);
    const finalPrice = finalIsFree ? 0 : Number(price || 0);

    // FIX BUG_009: Nếu người dùng thực hiện là Admin, cho phép thay đổi giảng viên phụ trách khóa học
    if (req.user.role === 'admin' && instructorId) {
      course.instructorId = Number(instructorId);
    }
    
    course.categoryId = categoryId || null;
    course.title = title;
    course.slug = slug;
    course.shortDescription = shortDescription || null;
    course.description = description || null;
    course.coverImageUrl = coverImageUrl || null;
    course.trailerUrl = trailerUrl || null;
    course.price = finalPrice;
    course.level = level || null;
    course.status = status || 'draft';
    course.isFree = finalIsFree;

    await course.save();

    const freshCourse = await Course.findByPk(course.id, {
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
        { model: User, as: 'instructor', attributes: ['id', 'fullName', 'email', 'avatarUrl'] },
      ],
    });

    return res.status(200).json({
      success: true,
      message: 'Cập nhật khóa học thành công',
      data: serializeCourse(freshCourse),
    });
  } catch (error) {
    next(error);
  }
};

const updateManageCourseStatus = async (req, res, next) => {
  try {
    const course = await ensureCourseAccess(req.params.courseId, req.user);
    course.status = req.body.status;
    await course.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái khóa học thành công',
      data: { id: course.id, status: course.status },
    });
  } catch (error) {
    next(error);
  }
};

const getCourseEditorData = async (req, res, next) => {
  try {
    await ensureCourseAccess(req.params.courseId, req.user);

    const course = await Course.findByPk(req.params.courseId, {
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
        { model: User, as: 'instructor', attributes: ['id', 'fullName', 'email', 'avatarUrl'] },
        {
          model: CourseSection,
          as: 'sections',
          attributes: ['id', 'courseId', 'title', 'sortOrder', 'createdAt', 'updatedAt'],
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
                'documentUrl', 
                'durationSeconds',
                'isPreview',
                'isPublished',
                'unlockOrder',
                'sortOrder',
                'createdAt',
                'updatedAt',
              ],
              required: false,
              include: [
                {
                  model: Quiz,
                  as: 'quiz',
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
                },
              ],
            },
          ],
        },
      ],
      order: [
        [{ model: CourseSection, as: 'sections' }, 'sortOrder', 'ASC'],
        [{ model: CourseSection, as: 'sections' }, { model: Lesson, as: 'lessons' }, 'sortOrder', 'ASC'],
        [
          { model: CourseSection, as: 'sections' },
          { model: Lesson, as: 'lessons' },
          { model: Quiz, as: 'quiz' },
          { model: QuizQuestion, as: 'questions' },
          'sortOrder',
          'ASC',
        ],
        [
          { model: CourseSection, as: 'sections' },
          { model: Lesson, as: 'lessons' },
          { model: Quiz, as: 'quiz' },
          { model: QuizQuestion, as: 'questions' },
          { model: QuizAnswer, as: 'answers' },
          'id',
          'ASC',
        ],
      ],
    });

    return res.status(200).json({
      success: true,
      data: course,
    });
  } catch (error) {
    next(error);
  }
};

const createSection = async (req, res, next) => {
  try {
    const course = await ensureCourseAccess(req.params.courseId, req.user);

    const section = await CourseSection.create({
      courseId: course.id,
      title: req.body.title,
      sortOrder: Number(req.body.sortOrder || 0),
    });

    return res.status(201).json({
      success: true,
      message: 'Tạo chương học thành công',
      data: section,
    });
  } catch (error) {
    next(error);
  }
};

const updateSection = async (req, res, next) => {
  try {
    const { section } = await ensureSectionAccess(req.params.sectionId, req.user);

    section.title = req.body.title;
    section.sortOrder = Number(req.body.sortOrder || 0);
    await section.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật chương học thành công',
      data: section,
    });
  } catch (error) {
    next(error);
  }
};

const deleteSection = async (req, res, next) => {
  try {
    const { section } = await ensureSectionAccess(req.params.sectionId, req.user);

    const lessonCount = await Lesson.count({
      where: { sectionId: section.id },
    });

    if (lessonCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa chương học khi vẫn còn bài học bên trong',
      });
    }

    await section.destroy();

    return res.status(200).json({
      success: true,
      message: 'Xóa chương học thành công',
    });
  } catch (error) {
    next(error);
  }
};

const createLesson = async (req, res, next) => {
  try {
    const course = await ensureCourseAccess(req.params.courseId, req.user);

    const targetSectionId = req.body.sectionId ? Number(req.body.sectionId) : null;

    const section = await CourseSection.findOne({
      where: {
        id: targetSectionId,
        courseId: course.id,
      },
    });

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Chương học không thuộc khóa học này',
      });
    }

    let documentUrl = req.body.documentUrl || null;
    if (req.file) {
      documentUrl = `/uploads/documents/${req.file.filename}`;
    }

    const lesson = await Lesson.create({
      courseId: course.id,
      sectionId: section.id,
      title: req.body.title,
      lessonType: req.body.lessonType,
      content: req.body.content || null,
      videoUrl: req.body.videoUrl || null,
      documentUrl: documentUrl, 
      durationSeconds: req.body.durationSeconds ? Number(req.body.durationSeconds) : null,
      isPreview: String(req.body.isPreview) === 'true' || req.body.isPreview === true || req.body.isPreview === 1,
      isPublished: String(req.body.isPublished) === 'false' || req.body.isPublished === false || req.body.isPublished === 0 ? false : true,
      unlockOrder: Number(req.body.unlockOrder || 0),
      sortOrder: Number(req.body.sortOrder || 0),
    });

    return res.status(201).json({
      success: true,
      message: 'Tạo bài học thành công',
      data: lesson,
    });
  } catch (error) {
    next(error);
  }
};

const updateLesson = async (req, res, next) => {
  try {
    const { lesson, course } = await ensureLessonAccess(req.params.lessonId, req.user);

    const targetSectionId = req.body.sectionId ? Number(req.body.sectionId) : lesson.sectionId;

    const section = await CourseSection.findOne({
      where: {
        id: targetSectionId,
        courseId: course.id,
      },
    });

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Chương học không thuộc khóa học này',
      });
    }

    let documentUrl = lesson.documentUrl;
    if (req.file) {
      documentUrl = `/uploads/documents/${req.file.filename}`;
    } else if (req.body.documentUrl !== undefined) {
      documentUrl = req.body.documentUrl;
    }

    lesson.sectionId = section.id;
    lesson.title = req.body.title || lesson.title;
    lesson.lessonType = req.body.lessonType || lesson.lessonType;
    lesson.content = req.body.content !== undefined ? req.body.content : lesson.content;
    lesson.videoUrl = req.body.videoUrl !== undefined ? req.body.videoUrl : lesson.videoUrl;
    lesson.documentUrl = documentUrl; 
    lesson.durationSeconds = req.body.durationSeconds ? Number(req.body.durationSeconds) : null;
    
    lesson.isPreview = String(req.body.isPreview) === 'true' || req.body.isPreview === true || req.body.isPreview === 1;
    lesson.isPublished = !(String(req.body.isPublished) === 'false' || req.body.isPublished === false || req.body.isPublished === 0);
    
    lesson.unlockOrder = Number(req.body.unlockOrder || 0);
    lesson.sortOrder = Number(req.body.sortOrder || 0);

    await lesson.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật bài học thành công',
      data: lesson,
    });
  } catch (error) {
    next(error);
  }
};

const deleteLesson = async (req, res, next) => {
  try {
    const { lesson } = await ensureLessonAccess(req.params.lessonId, req.user);

    const progressCount = await LessonProgress.count({ where: { lessonId: lesson.id } });
    if (progressCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa bài học đã có tiến độ học tập',
      });
    }

    const quiz = await Quiz.findOne({ where: { lessonId: lesson.id } });
    if (quiz) {
      const attemptCount = await QuizAttempt.count({ where: { quizId: quiz.id } });
      if (attemptCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Không thể xóa bài quiz đã có lượt làm bài',
        });
      }

      const questions = await QuizQuestion.findAll({ where: { quizId: quiz.id } });
      const questionIds = questions.map((item) => item.id);

      if (questionIds.length) {
        await QuizAnswer.destroy({ where: { questionId: questionIds } });
        await QuizQuestion.destroy({ where: { id: questionIds } });
      }

      await quiz.destroy();
    }

    await lesson.destroy();

    return res.status(200).json({
      success: true,
      message: 'Xóa bài học thành công',
    });
  } catch (error) {
    next(error);
  }
};

const upsertLessonQuiz = async (req, res, next) => {
  try {
    const { lesson } = await ensureLessonAccess(req.params.lessonId, req.user);

    if (lesson.lessonType !== 'quiz') {
      return res.status(400).json({
        success: false,
        message: 'Bài học này không phải loại quiz',
      });
    }

    let quiz = await Quiz.findOne({
      where: { lessonId: lesson.id },
    });

    if (!quiz) {
      quiz = await Quiz.create({
        lessonId: lesson.id,
        title: req.body.title,
        passScore: Number(req.body.passScore || 80),
        timeLimitMinutes: req.body.timeLimitMinutes || null,
      });
    } else {
      quiz.title = req.body.title;
      quiz.passScore = Number(req.body.passScore || 80);
      quiz.timeLimitMinutes = req.body.timeLimitMinutes || null;
      await quiz.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Lưu thông tin quiz thành công',
      data: quiz,
    });
  } catch (error) {
    next(error);
  }
};

const createQuizQuestion = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { quiz } = await ensureQuizAccess(req.params.quizId, req.user);

    const question = await QuizQuestion.create(
      {
        quizId: quiz.id,
        questionText: req.body.questionText,
        sortOrder: Number(req.body.sortOrder || 0),
      },
      { transaction }
    );

    const answers = req.body.answers.map((item) => ({
      questionId: question.id,
      answerText: item.answerText,
      isCorrect: Boolean(item.isCorrect),
    }));

    await QuizAnswer.bulkCreate(answers, { transaction });

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: 'Tạo câu hỏi quiz thành công',
      data: question,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const deleteQuestion = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { question } = await ensureQuestionAccess(req.params.questionId, req.user);

    const quizAttemptAnswerCount = await QuizAttemptAnswer.count({
      where: { questionId: question.id },
      transaction,
    });

    if (quizAttemptAnswerCount > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa câu hỏi đã có lượt làm bài',
      });
    }

    await QuizAnswer.destroy({
      where: { questionId: question.id },
      transaction,
    });

    await question.destroy({ transaction });
    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: 'Xóa câu hỏi thành công',
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const getCourseEnrollments = async (req, res, next) => {
  try {
    const course = await ensureCourseAccess(req.params.courseId, req.user);

    const enrollments = await Enrollment.findAll({
      where: { courseId: course.id },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'fullName', 'email', 'phone', 'avatarUrl', 'status'],
          include: [
            {
              model: Role,
              as: 'roleInfo',
              attributes: ['id', 'code', 'name'],
            },
          ],
        },
      ],
      order: [['enrolledAt', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      data: {
        course: {
          id: course.id,
          title: course.title,
          slug: course.slug,
        },
        items: enrollments.map((item) => ({
          id: item.id,
          enrolledAt: item.enrolledAt,
          progressPercent: Number(item.progressPercent || 0),
          completedAt: item.completedAt,
          user: item.user
            ? {
                id: item.user.id,
                fullName: item.user.fullName,
                email: item.user.email,
                phone: item.user.phone,
                avatarUrl: item.user.avatarUrl,
                status: item.user.status,
                role: item.user.roleInfo?.code || null,
                roleName: item.user.roleInfo?.name || null,
              }
            : null,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

const addEnrollmentByEmail = async (req, res, next) => {
  try {
    const course = await ensureCourseAccess(req.params.courseId, req.user);

    const email = req.body.email.trim().toLowerCase();

    const user = await User.findOne({
      where: { email },
      include: [{ model: Role, as: 'roleInfo', attributes: ['id', 'code', 'name'] }],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng với email này',
      });
    }

    if (user.roleInfo?.code !== 'student') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể ghi danh cho tài khoản học viên',
      });
    }

    const [enrollment, created] = await Enrollment.findOrCreate({
      where: {
        userId: user.id,
        courseId: course.id,
      },
      defaults: {
        userId: user.id,
        courseId: course.id,
        enrolledAt: new Date(),
        progressPercent: 0,
      },
    });

    return res.status(created ? 201 : 200).json({
      success: true,
      message: created ? 'Thêm học viên vào khóa học thành công' : 'Học viên đã có trong khóa học',
      data: enrollment,
    });
  } catch (error) {
    next(error);
  }
};

const removeEnrollment = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const course = await ensureCourseAccess(req.params.courseId, req.user);

    const enrollment = await Enrollment.findOne({
      where: {
        id: req.params.enrollmentId,
        courseId: course.id,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!enrollment) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy ghi danh',
      });
    }

    const attempts = await QuizAttempt.findAll({
      where: { enrollmentId: enrollment.id },
      attributes: ['id'],
      transaction,
    });

    const attemptIds = attempts.map((item) => item.id);

    if (attemptIds.length) {
      await QuizAttemptAnswer.destroy({
        where: { attemptId: attemptIds },
        transaction,
      });

      await QuizAttempt.destroy({
        where: { id: attemptIds },
        transaction,
      });
    }

    await LessonProgress.destroy({
      where: { enrollmentId: enrollment.id },
      transaction,
    });

    await enrollment.destroy({ transaction });
    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: 'Đã xóa học viên khỏi khóa học',
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

module.exports = {
  getManageCourses,
  getManageCourseDetail,
  createManageCourse,
  updateManageCourse,
  updateManageCourseStatus,
  getCourseEditorData,
  createSection,
  updateSection,
  deleteSection,
  createLesson,
  updateLesson,
  deleteLesson,
  upsertLessonQuiz,
  createQuizQuestion,
  deleteQuestion,
  getCourseEnrollments,
  addEnrollmentByEmail,
  removeEnrollment,
  getInstructorsList, // THÊM MỚI EXPORT
};