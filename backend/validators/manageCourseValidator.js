'use strict';

const { body, param } = require('express-validator');

const courseIdParamValidator = [
  param('courseId').isInt({ min: 1 }).withMessage('courseId không hợp lệ'),
];

const sectionIdParamValidator = [
  param('sectionId').isInt({ min: 1 }).withMessage('sectionId không hợp lệ'),
];

const lessonIdParamValidator = [
  param('lessonId').isInt({ min: 1 }).withMessage('lessonId không hợp lệ'),
];

const quizIdParamValidator = [
  param('quizId').isInt({ min: 1 }).withMessage('quizId không hợp lệ'),
];

const questionIdParamValidator = [
  param('questionId').isInt({ min: 1 }).withMessage('questionId không hợp lệ'),
];

const enrollmentIdParamValidator = [
  param('enrollmentId').isInt({ min: 1 }).withMessage('enrollmentId không hợp lệ'),
];

const createOrUpdateCourseValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Tên khóa học không được để trống')
    .isLength({ min: 3, max: 255 })
    .withMessage('Tên khóa học phải từ 3 đến 255 ký tự'),

  body('slug')
    .trim()
    .notEmpty()
    .withMessage('Slug không được để trống')
    .isLength({ min: 3, max: 255 })
    .withMessage('Slug phải từ 3 đến 255 ký tự'),

  body('categoryId')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('categoryId không hợp lệ'),

  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Giá khóa học phải lớn hơn hoặc bằng 0'),

  body('level')
    .optional({ nullable: true })
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('Level không hợp lệ'),

  body('status')
    .optional()
    .isIn(['draft', 'public', 'archived'])
    .withMessage('Trạng thái không hợp lệ'),

  body('isFree')
    .optional()
    .isBoolean()
    .withMessage('isFree phải là true hoặc false'),
];

const updateCourseStatusValidator = [
  ...courseIdParamValidator,
  body('status')
    .notEmpty()
    .withMessage('Trạng thái không được để trống')
    .isIn(['draft', 'public', 'archived'])
    .withMessage('Trạng thái không hợp lệ'),
];

const createSectionValidator = [
  ...courseIdParamValidator,
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Tên chương học không được để trống')
    .isLength({ min: 2, max: 255 })
    .withMessage('Tên chương học phải từ 2 đến 255 ký tự'),
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('sortOrder không hợp lệ'),
];

const updateSectionValidator = [
  ...sectionIdParamValidator,
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Tên chương học không được để trống')
    .isLength({ min: 2, max: 255 })
    .withMessage('Tên chương học phải từ 2 đến 255 ký tự'),
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('sortOrder không hợp lệ'),
];

const createLessonValidator = [
  ...courseIdParamValidator,
  body('sectionId')
    .notEmpty()
    .withMessage('sectionId không được để trống')
    .isInt({ min: 1 })
    .withMessage('sectionId không hợp lệ'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Tên bài học không được để trống')
    .isLength({ min: 2, max: 255 })
    .withMessage('Tên bài học phải từ 2 đến 255 ký tự'),
  body('lessonType')
    .isIn(['video', 'document', 'quiz'])
    .withMessage('lessonType không hợp lệ'),
    
  // FIX LỖI DỮ LIỆU KHÔNG HỢP LỆ: Cho phép trống (checkFalsy) khi Frontend gửi chuỗi rỗng ""
  body('durationSeconds')
    .optional({ checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage('Thời lượng bài học phải là một số nguyên từ 0 trở lên'),
    
  // Xử lý custom mượt mà để nhận diện dữ liệu dạng chuỗi "true"/"false" từ FormData gửi lên
  body('isPreview')
    .optional()
    .custom((val) => {
      if (val === 'true' || val === 'false' || typeof val === 'boolean' || val === 1 || val === 0) return true;
      throw new Error('isPreview phải là kiểu định dạng Boolean');
    }),
  body('isPublished')
    .optional()
    .custom((val) => {
      if (val === 'true' || val === 'false' || typeof val === 'boolean' || val === 1 || val === 0) return true;
      throw new Error('isPublished phải là kiểu định dạng Boolean');
    }),
  body('unlockOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('unlockOrder không hợp lệ'),
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('sortOrder không hợp lệ'),
];

const updateLessonValidator = [
  ...lessonIdParamValidator,
  body('sectionId')
    .notEmpty()
    .withMessage('sectionId không được để trống')
    .isInt({ min: 1 })
    .withMessage('sectionId không hợp lệ'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Tên bài học không được để trống')
    .isLength({ min: 2, max: 255 })
    .withMessage('Tên bài học phải từ 2 đến 255 ký tự'),
  body('lessonType')
    .isIn(['video', 'document', 'quiz'])
    .withMessage('lessonType không hợp lệ'),
    
  // FIX LỖI DỮ LIỆU KHÔNG HỢP LỆ: Đồng bộ cho cả hàm cập nhật thông tin
  body('durationSeconds')
    .optional({ checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage('Thời lượng bài học phải là một số nguyên từ 0 trở lên'),
    
  body('isPreview')
    .optional()
    .custom((val) => {
      if (val === 'true' || val === 'false' || typeof val === 'boolean' || val === 1 || val === 0) return true;
      throw new Error('isPreview phải là kiểu định dạng Boolean');
    }),
  body('isPublished')
    .optional()
    .custom((val) => {
      if (val === 'true' || val === 'false' || typeof val === 'boolean' || val === 1 || val === 0) return true;
      throw new Error('isPublished phải là kiểu định dạng Boolean');
    }),
  body('unlockOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('unlockOrder không hợp lệ'),
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('sortOrder không hợp lệ'),
];

const upsertQuizValidator = [
  ...lessonIdParamValidator,
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Tiêu đề quiz không được để trống')
    .isLength({ min: 2, max: 255 })
    .withMessage('Tiêu đề quiz phải từ 2 đến 255 ký tự'),
  body('passScore')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('passScore phải từ 0 đến 100'),
  body('timeLimitMinutes')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('timeLimitMinutes phải lớn hơn 0'),
];

const createQuizQuestionValidator = [
  ...quizIdParamValidator,
  body('questionText')
    .trim()
    .notEmpty()
    .withMessage('Nội dung câu hỏi không được để trống')
    .isLength({ min: 2 })
    .withMessage('Nội dung câu hỏi quá ngắn'),
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('sortOrder không hợp lệ'),
  body('answers')
    .isArray({ min: 2 })
    .withMessage('answers phải là mảng có ít nhất 2 đáp án'),
  body('answers.*.answerText')
    .trim()
    .notEmpty()
    .withMessage('Nội dung đáp án không được để trống'),
  body('answers.*.isCorrect')
    .isBoolean()
    .withMessage('isCorrect phải là true hoặc false'),
  body('answers').custom((answers) => {
    const correctCount = answers.filter((item) => item.isCorrect === true || String(item.isCorrect) === 'true').length;
    if (correctCount < 1) {
      throw new Error('Phải có ít nhất 1 đáp án đúng');
    }
    return true;
  }),
];

const addEnrollmentValidator = [
  ...courseIdParamValidator,
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email không được để trống')
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail(),
];

module.exports = {
  courseIdParamValidator,
  sectionIdParamValidator,
  lessonIdParamValidator,
  quizIdParamValidator,
  questionIdParamValidator,
  enrollmentIdParamValidator,
  createOrUpdateCourseValidator,
  updateCourseStatusValidator,
  createSectionValidator,
  updateSectionValidator,
  createLessonValidator,
  updateLessonValidator,
  upsertQuizValidator,
  createQuizQuestionValidator,
  addEnrollmentValidator,
};