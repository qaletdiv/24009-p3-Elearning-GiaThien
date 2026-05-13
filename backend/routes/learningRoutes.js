'use strict';

const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authenticateToken');
const validationErrorHandler = require('../middlewares/validationErrorHandler');
const learningController = require('../controllers/learningController');
const {
  getLearningDataValidator,
  completeLessonValidator,
  createDiscussionValidator,
} = require('../validators/learningValidator');

router.use(authenticateToken);

router.get(
  '/courses/:slug',
  getLearningDataValidator,
  validationErrorHandler,
  learningController.getLearningData
);

router.post(
  '/lessons/:lessonId/complete',
  completeLessonValidator,
  validationErrorHandler,
  learningController.completeLesson
);

router.post(
  '/lessons/:lessonId/discussions',
  createDiscussionValidator,
  validationErrorHandler,
  learningController.createDiscussion
);

module.exports = router;