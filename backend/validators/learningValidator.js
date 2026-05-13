'use strict';

const { body, param } = require('express-validator');

const getLearningDataValidator = [
  param('slug')
    .trim()
    .notEmpty()
    .withMessage('Slug khóa học không được để trống'),
];

const completeLessonValidator = [
  param('lessonId')
    .isInt({ min: 1 })
    .withMessage('lessonId không hợp lệ'),

  body('courseSlug')
    .trim()
    .notEmpty()
    .withMessage('courseSlug không được để trống'),

  body('watchedSeconds')
    .optional()
    .isInt({ min: 0 })
    .withMessage('watchedSeconds phải là số nguyên lớn hơn hoặc bằng 0'),
];

const createDiscussionValidator = [
  param('lessonId')
    .isInt({ min: 1 })
    .withMessage('lessonId không hợp lệ'),

  body('courseSlug')
    .trim()
    .notEmpty()
    .withMessage('courseSlug không được để trống'),

  body('content')
    .trim()
    .notEmpty()
    .withMessage('Nội dung thảo luận không được để trống')
    .isLength({ min: 2, max: 5000 })
    .withMessage('Nội dung thảo luận phải từ 2 đến 5000 ký tự'),

  body('parentId')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('parentId không hợp lệ'),
];

module.exports = {
  getLearningDataValidator,
  completeLessonValidator,
  createDiscussionValidator,
};