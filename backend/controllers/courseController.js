'use strict';

const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { Category, Course, CourseSection, Enrollment, Lesson, User } = require('../models');

const getOptionalUserId = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id;
  } catch {
    return null;
  }
};

const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.findAll({
      attributes: ['id', 'name', 'slug'],
      order: [['name', 'ASC']],
    });

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

const getPublicCourses = async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 9);
    const offset = (page - 1) * limit;
    const keyword = (req.query.keyword || '').trim();
    const categoryId = req.query.categoryId;
    const priceType = req.query.priceType;

    const where = { status: 'public' };

    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { shortDescription: { [Op.like]: `%${keyword}%` } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (priceType === 'free') {
      where.isFree = true;
    }

    if (priceType === 'paid') {
      where.isFree = false;
      where.price = { [Op.gt]: 0 };
    }

    const { rows, count } = await Course.findAndCountAll({
      where,
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug'],
        },
        {
          model: User,
          as: 'instructor',
          attributes: ['id', 'fullName', 'avatarUrl'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return res.status(200).json({
      success: true,
      data: {
        items: rows,
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

const getCourseDetail = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const userId = getOptionalUserId(req);

    const course = await Course.findOne({
      where: { slug, status: 'public' },
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug'],
        },
        {
          model: User,
          as: 'instructor',
          attributes: ['id', 'fullName', 'avatarUrl'],
        },
        {
          model: CourseSection,
          as: 'sections',
          attributes: ['id', 'title', 'sortOrder'],
          include: [
            {
              model: Lesson,
              as: 'lessons',
              attributes: ['id', 'title', 'lessonType', 'isPreview', 'sortOrder'],
              where: { isPublished: true },
              required: false,
            },
          ],
        },
      ],
      order: [
        [{ model: CourseSection, as: 'sections' }, 'sortOrder', 'ASC'],
        [{ model: CourseSection, as: 'sections' }, { model: Lesson, as: 'lessons' }, 'sortOrder', 'ASC'],
      ],
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học',
      });
    }

    let isEnrolled = false;
    if (userId) {
      const enrollment = await Enrollment.findOne({
        where: {
          userId,
          courseId: course.id,
        },
      });
      isEnrolled = Boolean(enrollment);
    }

    return res.status(200).json({
      success: true,
      data: {
        ...course.toJSON(),
        viewer: {
          isAuthenticated: Boolean(userId),
          isEnrolled,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const createCourse = async (req, res, next) => {
  try {
    const {
      categoryId,
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

    const finalIsFree = Boolean(isFree) || Number(price || 0) === 0;
    const finalPrice = finalIsFree ? 0 : Number(price || 0);

    const course = await Course.create({
      instructorId: req.user.id,
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

    return res.status(201).json({
      success: true,
      message: 'Tạo khóa học thành công',
      data: course,
    });
  } catch (error) {
    next(error);
  }
};

const createSection = async (req, res, next) => {
  try {
    const { courseId } = req.params
    const { title, sortOrder } = req.body

    const course = await Course.findByPk(courseId)
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học',
      })
    }

    if (
      req.user.role !== 'admin' &&
      !(req.user.role === 'instructor' && Number(course.instructorId) === Number(req.user.id))
    ) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thêm section cho khóa học này',
      })
    }

    const section = await CourseSection.create({
      courseId: course.id,
      title,
      sortOrder: Number(sortOrder || 0),
    })

    return res.status(201).json({
      success: true,
      message: 'Tạo section thành công',
      data: section,
    })
  } catch (error) {
    next(error)
  }
}

const createLesson = async (req, res, next) => {
  try {
    const { courseId } = req.params
    const {
      sectionId,
      title,
      lessonType,
      content,
      videoUrl,
      durationSeconds,
      isPreview,
      isPublished,
      sortOrder,
      unlockOrder,
    } = req.body

    const course = await Course.findByPk(courseId)
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học',
      })
    }

    if (
      req.user.role !== 'admin' &&
      !(req.user.role === 'instructor' && Number(course.instructorId) === Number(req.user.id))
    ) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thêm bài học cho khóa học này',
      })
    }

    const section = await CourseSection.findOne({
      where: {
        id: sectionId,
        courseId: course.id,
      },
    })

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section không tồn tại trong khóa học này',
      })
    }

    const lesson = await Lesson.create({
      courseId: course.id,
      sectionId: section.id,
      title,
      lessonType,
      content: content || null,
      videoUrl: videoUrl || null,
      durationSeconds: durationSeconds || null,
      isPreview: Boolean(isPreview),
      isPublished: isPublished !== undefined ? Boolean(isPublished) : true,
      unlockOrder: Number(unlockOrder || 0),
      sortOrder: Number(sortOrder || 0),
    })

    return res.status(201).json({
      success: true,
      message: 'Tạo bài học thành công',
      data: lesson,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getCategories,
  getPublicCourses,
  getCourseDetail,
  createCourse,
  createSection,
  createLesson,
}