'use strict';

const { body, param } = require('express-validator');

const createCourseValidator = [
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

  
  body('instructorId')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('instructorId không hợp lệ'),

  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Giá khóa học phải lớn hơn hoặc bằng 0'),

  body('level')
    .optional()
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

const createSectionValidator = [
  param('courseId')
    .isInt({ min: 1 })
    .withMessage('courseId không hợp lệ'),

  body('title')
    .trim()
    .notEmpty()
    .withMessage('Tiêu đề section không được để trống')
    .isLength({ min: 2, max: 255 })
    .withMessage('Tiêu đề section phải từ 2 đến 255 ký tự'),

  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('sortOrder không hợp lệ'),
];

const createLessonValidator = [
  param('courseId')
    .isInt({ min: 1 })
    .withMessage('courseId không hợp lệ'),

  body('sectionId')
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

  body('durationSeconds')
    .optional({ nullable: true })
    .isInt({ min: 0 })
    .withMessage('durationSeconds không hợp lệ'),

  body('isPreview')
    .optional()
    .isBoolean()
    .withMessage('isPreview phải là true hoặc false'),

  body('isPublished')
    .optional()
    .isBoolean()
    .withMessage('isPublished phải là true hoặc false'),

  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('sortOrder không hợp lệ'),

  body('unlockOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('unlockOrder không hợp lệ'),
  
  body('documentUrl')
    .optional({ nullable: true })
    .isString()
    .withMessage('documentUrl phải là chuỗi ký tự'),
];

module.exports = {
  createCourseValidator,
  createSectionValidator,
  createLessonValidator,
};