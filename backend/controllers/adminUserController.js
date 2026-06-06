'use strict';

const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
// Import thêm model Course để xử lý quan hệ phân phối khóa học cho Giảng viên
const { Role, User, Course } = require('../models');

const serializeUser = (user) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  avatarUrl: user.avatarUrl,
  roleId: user.roleId,
  role: user.roleInfo?.code || null,
  roleName: user.roleInfo?.name || null,
  status: user.status,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,

  assignedCourses: user.instructedCourses
    ? user.instructedCourses.map(c => ({ id: c.id, title: c.title, slug: c.slug }))
    : []
});

const generateTempPassword = () => {
  return Math.random().toString(36).slice(-10);
};

const getRoles = async (req, res, next) => {
  try {
    const roles = await Role.findAll({
      attributes: ['id', 'code', 'name'],
      order: [['id', 'ASC']],
    });

    return res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const offset = (page - 1) * limit;

    const keyword = (req.query.keyword || '').trim();
    const roleId = req.query.roleId;
    const status = req.query.status;

    const where = {};

    if (keyword) {
      where[Op.or] = [
        { fullName: { [Op.like]: `%${keyword}%` } },
        { email: { [Op.like]: `%${keyword}%` } },
        { phone: { [Op.like]: `%${keyword}%` } },
      ];
    }

    if (roleId) {
      where.roleId = Number(roleId);
    }

    if (status) {
      where.status = status;
    }

    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: [
        'id',
        'roleId',
        'fullName',
        'email',
        'phone',
        'avatarUrl',
        'status',
        'createdAt',
        'updatedAt',
      ],
      include: [
        {
          model: Role,
          as: 'roleInfo',
          attributes: ['id', 'code', 'name'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return res.status(200).json({
      success: true,
      data: {
        items: rows.map(serializeUser),
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

const getUserDetail = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: [
        'id',
        'roleId',
        'fullName',
        'email',
        'phone',
        'avatarUrl',
        'status',
        'createdAt',
        'updatedAt',
      ],
      include: [
        {
          model: Role,
          as: 'roleInfo',
          attributes: ['id', 'code', 'name'],
        },
        // NẠP THÊM: Danh sách các khóa học mà Giảng viên này đang được phân bổ phụ trách dạy
        {
          model: Course,
          as: 'instructedCourses', // Đổi tên alias cho khớp với cấu hình hệ thống của bạn
          required: false,
          attributes: ['id', 'title', 'slug', 'instructorId']
        }
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng',
      });
    }

    return res.status(200).json({
      success: true,
      data: serializeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { fullName, email, phone, roleId, status, password } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email đã tồn tại',
      });
    }

    const role = await Role.findByPk(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Vai trò không tồn tại',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName,
      email,
      phone: phone || null,
      roleId,
      status: status || 'active',
      passwordHash,
    });

    const freshUser = await User.findByPk(user.id, {
      attributes: [
        'id',
        'roleId',
        'fullName',
        'email',
        'phone',
        'avatarUrl',
        'status',
        'createdAt',
        'updatedAt',
      ],
      include: [
        {
          model: Role,
          as: 'roleInfo',
          attributes: ['id', 'code', 'name'],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: 'Tạo người dùng thành công',
      data: serializeUser(freshUser),
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// CẬP NHẬT: LUỒNG ĐỒNG BỘ MẢNG PHÂN PHỐI KHÓA HỌC
// ==========================================
const updateUser = async (req, res, next) => {
  try {
    const { fullName, email, phone, roleId, status, assignedCourseIds } = req.body;
    const userId = req.params.id;

    const user = await User.findByPk(userId, {
      include: [{ model: Role, as: 'roleInfo', attributes: ['id', 'code', 'name'] }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng',
      });
    }

    const duplicatedEmail = await User.findOne({
      where: {
        email,
        id: { [Op.ne]: user.id },
      },
    });

    if (duplicatedEmail) {
      return res.status(409).json({
        success: false,
        message: 'Email đã tồn tại',
      });
    }

    const role = await Role.findByPk(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Vai trò không tồn tại',
      });
    }

    // Tiến hành cập nhật thông tin cơ bản
    user.fullName = fullName;
    user.email = email;
    user.phone = phone || null;
    user.roleId = roleId;
    user.status = status;
    await user.save();

    // KIỂM TRA ĐỒNG BỘ: Nếu vai trò hiện tại là giảng viên và có mảng dữ liệu khóa học gửi lên
    const isInstructor = role.code === 'instructor' || role.name?.toLowerCase()?.includes('giáo viên');

    if (isInstructor && assignedCourseIds && Array.isArray(assignedCourseIds)) {
      const targetIds = assignedCourseIds.map(Number);

      // Trường hợp 1: Nếu hệ thống sử dụng mối quan hệ Nhiều - Nhiều liên kết bảng trung gian qua Sequelize BelongsToMany
      if (typeof user.setAssignedCourses === 'function') {
        await user.setAssignedCourses(targetIds);
      }

      // Trường hợp 2: Nếu hệ thống gán trực tiếp thông qua thay đổi cột instructorId ở bảng Courses
      else {
        // Gỡ bỏ phân bổ cũ của giảng viên này ra (Chỉ gỡ những khóa học gán thêm, không gỡ khóa học do họ tự tạo gốc ban đầu)
        await Course.update(
          { instructorId: req.user.id }, // Gán trả lại quyền quản lý tạm thời cho Admin đang đăng nhập xử lý
          {
            where: {
              instructorId: user.id,
              id: { [Op.notIn]: targetIds }
            }
          }
        );

        // Kích hoạt áp đặt giảng viên này phụ trách vào các khóa học mới được tick chọn
        if (targetIds.length > 0) {
          await Course.update(
            { instructorId: user.id },
            { where: { id: targetIds } }
          );
        }
      }
    }

    const freshUser = await User.findByPk(user.id, {
      attributes: [
        'id',
        'roleId',
        'fullName',
        'email',
        'phone',
        'avatarUrl',
        'status',
        'createdAt',
        'updatedAt',
      ],
      include: [
        {
          model: Role,
          as: 'roleInfo',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: Course,
          as: 'instructedCourses', // Đổi tên alias tại đây luôn
          required: false,
          attributes: ['id', 'title', 'slug']
        }
      ],
    });

    return res.status(200).json({
      success: true,
      message: 'Cập nhật người dùng và phân phối khóa học thành công',
      data: serializeUser(freshUser),
    });
  } catch (error) {
    next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const user = await User.findByPk(req.params.id, {
      include: [
        {
          model: Role,
          as: 'roleInfo',
          attributes: ['id', 'code', 'name'],
        },
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng',
      });
    }

    user.status = status;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái thành công',
      data: serializeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;

    const user = await User.findByPk(req.params.id, {
      include: [
        {
          model: Role,
          as: 'roleInfo',
          attributes: ['id', 'code', 'name'],
        },
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng',
      });
    }

    const nextPassword = password || generateTempPassword();
    const passwordHash = await bcrypt.hash(nextPassword, 10);

    user.passwordHash = passwordHash;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Đặt lại mật khẩu thành công',
      data: {
        user: serializeUser(user),
        temporaryPassword: nextPassword,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRoles,
  getUsers,
  getUserDetail,
  createUser,
  updateUser,
  updateUserStatus,
  resetPassword,
};