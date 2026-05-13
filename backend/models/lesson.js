'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/config');

const Lesson = sequelize.define(
  'Lesson',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    courseId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'course_id',
    },
    sectionId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'section_id',
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    lessonType: {
      type: DataTypes.ENUM('video', 'document', 'quiz'),
      allowNull: false,
      defaultValue: 'video',
      field: 'lesson_type',
    },
    content: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },
    videoUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'video_url',
    },
    documentUrl: { // Fix BUG_011: Bổ sung trường lưu trữ đường dẫn tài liệu
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'document_url',
    },
    durationSeconds: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'duration_seconds',
    },
    isPreview: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_preview',
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_published',
    },
    unlockOrder: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'unlock_order',
    },
    sortOrder: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'sort_order',
    },
  },
  {
    tableName: 'lessons',
    timestamps: true,
    underscored: true,
  }
);

module.exports = Lesson;