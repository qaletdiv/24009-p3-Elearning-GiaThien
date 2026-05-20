'use strict';

const express = require('express');
const router = express.Router();

const authenticateToken = require('../middlewares/authenticateToken');
const authorizeRole = require('../middlewares/authorizeRole');
const validationErrorHandler = require('../middlewares/validationErrorHandler');
const manageCourseController = require('../controllers/manageCourseController');
const { uploadDocument } = require('../middlewares/uploadMiddleware');
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

// Cấu hình custom middleware ép kiểu dữ liệu từ FormData (Chuỗi) về đúng kiểu dữ liệu (Number/Boolean) 
// để vượt qua các tầng validator nghiêm ngặt phía dưới mà không bị lỗi 422
const parseLessonFormData = (req, res, next) => {
  if (req.body) {
    if (req.body.sectionId) req.body.sectionId = Number(req.body.sectionId);
    if (req.body.durationSeconds) req.body.durationSeconds = Number(req.body.durationSeconds);
    if (req.body.unlockOrder) req.body.unlockOrder = Number(req.body.unlockOrder);
    if (req.body.sortOrder) req.body.sortOrder = Number(req.body.sortOrder);
    
    if (req.body.isPreview !== undefined) {
      req.body.isPreview = req.body.isPreview === 'true' || req.body.isPreview === true || req.body.isPreview === '1' || req.body.isPreview === 1;
    }
    if (req.body.isPublished !== undefined) {
      req.body.isPublished = req.body.isPublished === 'true' || req.body.isPublished === true || req.body.isPublished === '1' || req.body.isPublished === 1;
    }
  }
  next();
};

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
  uploadDocument.single('documentFile'), 
  parseLessonFormData,                  
  createLessonValidator,                 
  validationErrorHandler,                
  manageCourseController.createLesson
);


router.put(
  '/lessons/:lessonId',
  uploadDocument.single('documentFile'), 
  parseLessonFormData,                  
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