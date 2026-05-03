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



module.exports = router;