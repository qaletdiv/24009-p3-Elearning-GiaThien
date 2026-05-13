'use strict';

const express = require('express');
const router = express.Router();

const authenticateToken = require('../middlewares/authenticateToken');
const authorizeRole = require('../middlewares/authorizeRole');
const validationErrorHandler = require('../middlewares/validationErrorHandler');
const manageCourseController = require('../controllers/manageCourseController');
const {
  courseIdParamValidator,
  sectionIdParamValidator,
  lessonIdParamValidator,
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
} = require('../validators/manageCourseValidator');

router.use(authenticateToken, authorizeRole('admin', 'instructor'));

router.get('/courses', manageCourseController.getManageCourses);

router.get(
  '/courses/:courseId',
  courseIdParamValidator,
  validationErrorHandler,
  manageCourseController.getManageCourseDetail
);

router.post(
  '/courses',
  createOrUpdateCourseValidator,
  validationErrorHandler,
  manageCourseController.createManageCourse
);

router.put(
  '/courses/:courseId',
  courseIdParamValidator,
  createOrUpdateCourseValidator,
  validationErrorHandler,
  manageCourseController.updateManageCourse
);

router.patch(
  '/courses/:courseId/status',
  updateCourseStatusValidator,
  validationErrorHandler,
  manageCourseController.updateManageCourseStatus
);

router.get(
  '/courses/:courseId/editor',
  courseIdParamValidator,
  validationErrorHandler,
  manageCourseController.getCourseEditorData
);

router.post(
  '/courses/:courseId/sections',
  createSectionValidator,
  validationErrorHandler,
  manageCourseController.createSection
);

router.put(
  '/sections/:sectionId',
  updateSectionValidator,
  validationErrorHandler,
  manageCourseController.updateSection
);

router.delete(
  '/sections/:sectionId',
  sectionIdParamValidator,
  validationErrorHandler,
  manageCourseController.deleteSection
);

router.post(
  '/courses/:courseId/lessons',
  createLessonValidator,
  validationErrorHandler,
  manageCourseController.createLesson
);

router.put(
  '/lessons/:lessonId',
  updateLessonValidator,
  validationErrorHandler,
  manageCourseController.updateLesson
);

router.delete(
  '/lessons/:lessonId',
  lessonIdParamValidator,
  validationErrorHandler,
  manageCourseController.deleteLesson
);

router.post(
  '/lessons/:lessonId/quiz',
  upsertQuizValidator,
  validationErrorHandler,
  manageCourseController.upsertLessonQuiz
);

router.post(
  '/quizzes/:quizId/questions',
  createQuizQuestionValidator,
  validationErrorHandler,
  manageCourseController.createQuizQuestion
);

router.delete(
  '/questions/:questionId',
  questionIdParamValidator,
  validationErrorHandler,
  manageCourseController.deleteQuestion
);

router.get(
  '/courses/:courseId/enrollments',
  courseIdParamValidator,
  validationErrorHandler,
  manageCourseController.getCourseEnrollments
);

router.post(
  '/courses/:courseId/enrollments',
  addEnrollmentValidator,
  validationErrorHandler,
  manageCourseController.addEnrollmentByEmail
);

router.delete(
  '/courses/:courseId/enrollments/:enrollmentId',
  [...courseIdParamValidator, ...enrollmentIdParamValidator],
  validationErrorHandler,
  manageCourseController.removeEnrollment
);

module.exports = router;