'use strict';

const { body, param, query } = require('express-validator');


const getLearningDataValidator = [
  param('slug')
    .trim()
    .notEmpty()
    .withMessage('Slug khóa học không được để trống'),

  query('lessonId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('lessonId không hợp lệ')
    .toInt(),
];


const completeLessonValidator = [
  param('lessonId')
    .isInt({ min: 1 })
    .withMessage('lessonId không hợp lệ')
    .toInt(),

  body('courseSlug')
    .optional() 
    .trim(),

  body('watchedSeconds')
    .optional()
    .isInt({ min: 0 })
    .withMessage('watchedSeconds phải là số nguyên ≥ 0')
    .toInt(),
];


const createDiscussionValidator = [
  param('lessonId')
    .isInt({ min: 1 })
    .withMessage('lessonId không hợp lệ')
    .toInt(),

  body('courseSlug')
    .optional() 
    .trim(),

  body('content')
    .trim()
    .notEmpty()
    .withMessage('Nội dung không được để trống')
    .isLength({ min: 2, max: 5000 })
    .withMessage('Nội dung phải từ 2–5000 ký tự'),

  body('parentId')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('parentId không hợp lệ')
    .toInt(),
];

module.exports = {
  getLearningDataValidator,
  completeLessonValidator,
  createDiscussionValidator,
};