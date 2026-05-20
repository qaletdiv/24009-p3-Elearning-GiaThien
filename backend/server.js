'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // Thêm fs để tự động tạo thư mục khi chạy server

const sequelize = require('./config/config');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const courseRoutes = require('./routes/courseRoutes');
const orderRoutes = require('./routes/orderRoutes');
const learningRoutes = require('./routes/learningRoutes');
const quizRoutes = require('./routes/quizRoutes');
const manageCourseRoutes = require('./routes/manageCourseRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');

const requestLogger = require('./middlewares/requestLogger');
const errorHandler = require('./middlewares/errorHandler');

const server = express();
const PORT = process.env.PORT || 5000;

const uploadDir = path.join(__dirname, 'uploads/documents');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

server.use(
  cors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  })
);
server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.use(requestLogger);


server.use('/uploads', express.static(path.join(__dirname, 'uploads')));

server.get('/', (req, res) => {
  return res.json({
    success: true,
    message: 'Backend E-Learning đang hoạt động',
  });
});

server.use('/api/auth', authRoutes);
server.use('/api/users', userRoutes);
server.use('/api/courses', courseRoutes);
server.use('/api/orders', orderRoutes);
server.use('/api/learning', learningRoutes);
server.use('/api/quizzes', quizRoutes);
server.use('/api/manage', manageCourseRoutes);
server.use('/api/admin', adminUserRoutes);

server.use(errorHandler);

sequelize
  .authenticate()
  .then(() => {
    console.log('Kết nối database thành công');
  })
  .catch((err) => {
    console.error('Không thể kết nối CSDL: ' + err);
  });

server.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
});