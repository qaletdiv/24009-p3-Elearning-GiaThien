'use strict';

const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authenticateToken');
const authorizeRole = require('../middlewares/authorizeRole');
const validationErrorHandler = require('../middlewares/validationErrorHandler');
const quizController = require('../controllers/quizController');
const {
  getQuizValidator,
  submitQuizValidator,
} = require('../validators/quizValidator');
const {
  createQuizValidator,
  createQuestionValidator,
  createAnswerValidator,
} = require('../validators/quizManageValidator');

router.get(
  '/courses/:slug/lessons/:lessonId',
  authenticateToken,
  authorizeRole('student'),
  getQuizValidator,
  validationErrorHandler,
  quizController.getQuizByLesson
);

router.post(
  '/courses/:slug/lessons/:lessonId/submit',
  authenticateToken,
  authorizeRole('student'),
  submitQuizValidator,
  validationErrorHandler,
  quizController.submitQuiz
);

router.post(
  '/lessons/:lessonId',
  authenticateToken,
  authorizeRole('admin', 'instructor'),
  createQuizValidator,
  validationErrorHandler,
  quizController.createQuiz
);

router.post(
  '/:quizId/questions',
  authenticateToken,
  authorizeRole('admin', 'instructor'),
  createQuestionValidator,
  validationErrorHandler,
  quizController.createQuestion
);

router.post(
  '/questions/:questionId/answers',
  authenticateToken,
  authorizeRole('admin', 'instructor'),
  createAnswerValidator,
  validationErrorHandler,
  quizController.createAnswer
);

module.exports = router;