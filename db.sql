CREATE DATABASE IF NOT EXISTS project3
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE project3;



CREATE TABLE roles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO roles (code, name) VALUES
('admin', 'Admin'),
('instructor', 'Instructor'),
('student', 'Student');

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id BIGINT UNSIGNED NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NULL,
  avatar_url VARCHAR(255) NULL,
  status ENUM('active','locked','pending') NOT NULL DEFAULT 'active',
  email_verified_at TIMESTAMP NULL,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE password_resets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token VARCHAR(191) NOT NULL UNIQUE,
  expired_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  description TEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO categories (id, name, slug, description)
VALUES
  (1, 'Lập trình web', 'lap-trinh-web', 'Các khóa học và tài liệu về phát triển website'),
  (2, 'Thiết kế đồ họa', 'thiet-ke-do-hoa', 'Các nội dung liên quan đến thiết kế và sáng tạo hình ảnh'),
  (3, 'Marketing', 'marketing', 'Kiến thức về marketing online và offline'),
  (4, 'Kỹ năng mềm', 'ky-nang-mem', 'Các kỹ năng giao tiếp, làm việc nhóm và phát triển bản thân');

CREATE TABLE courses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  instructor_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  short_description VARCHAR(500) NULL,
  description LONGTEXT NULL,
  cover_image_url VARCHAR(255) NULL,
  trailer_url VARCHAR(255) NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  level ENUM('beginner','intermediate','advanced') NULL,
  status ENUM('draft','public','archived') NOT NULL DEFAULT 'draft',
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  rating_avg DECIMAL(3,2) NOT NULL DEFAULT 0,
  rating_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_courses_instructor FOREIGN KEY (instructor_id) REFERENCES users(id),
  CONSTRAINT fk_courses_category FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE course_sections (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sections_course FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE lessons (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT UNSIGNED NOT NULL,
  section_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  lesson_type ENUM('video','document','quiz') NOT NULL DEFAULT 'video',
  content LONGTEXT NULL,
  video_url VARCHAR(255) NULL,
  duration_seconds INT UNSIGNED NULL,
  is_preview BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  unlock_order INT UNSIGNED NOT NULL DEFAULT 0,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lessons_course FOREIGN KEY (course_id) REFERENCES courses(id),
  CONSTRAINT fk_lessons_section FOREIGN KEY (section_id) REFERENCES course_sections(id)
);

CREATE TABLE quizzes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lesson_id BIGINT UNSIGNED NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  pass_score INT UNSIGNED NOT NULL DEFAULT 80,
  time_limit_minutes INT UNSIGNED NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_quizzes_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id)
);

CREATE TABLE quiz_questions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quiz_id BIGINT UNSIGNED NOT NULL,
  question_text TEXT NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_questions_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
);

CREATE TABLE quiz_answers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question_id BIGINT UNSIGNED NOT NULL,
  answer_text VARCHAR(500) NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_answers_question FOREIGN KEY (question_id) REFERENCES quiz_questions(id)
);

CREATE TABLE coupons (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  discount_type ENUM('percent','fixed') NOT NULL,
  discount_value DECIMAL(12,2) NOT NULL,
  max_uses INT UNSIGNED NULL,
  used_count INT UNSIGNED NOT NULL DEFAULT 0,
  started_at TIMESTAMP NULL,
  expired_at TIMESTAMP NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  course_id BIGINT UNSIGNED NOT NULL,
  coupon_id BIGINT UNSIGNED NULL,
  order_code VARCHAR(50) NOT NULL UNIQUE,
  original_price DECIMAL(12,2) NOT NULL,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  final_price DECIMAL(12,2) NOT NULL,
  payment_status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  payment_method ENUM('stripe') NOT NULL DEFAULT 'stripe',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_orders_course FOREIGN KEY (course_id) REFERENCES courses(id),
  CONSTRAINT fk_orders_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id)
);

CREATE TABLE payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'stripe',
  provider_payment_id VARCHAR(191) NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  status ENUM('pending','succeeded','failed','refunded') NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE enrollments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  course_id BIGINT UNSIGNED NOT NULL,
  enrolled_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  progress_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  completed_at TIMESTAMP NULL,
  UNIQUE KEY uq_enrollment_user_course (user_id, course_id),
  CONSTRAINT fk_enrollments_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_enrollments_course FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE lesson_progresses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  lesson_id BIGINT UNSIGNED NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  watched_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  completed_at TIMESTAMP NULL,
  UNIQUE KEY uq_progress_enrollment_lesson (enrollment_id, lesson_id),
  CONSTRAINT fk_progress_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id),
  CONSTRAINT fk_progress_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id)
);

CREATE TABLE quiz_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  quiz_id BIGINT UNSIGNED NOT NULL,
  score DECIMAL(5,2) NOT NULL DEFAULT 0,
  is_passed BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP NULL,
  CONSTRAINT fk_attempts_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id),
  CONSTRAINT fk_attempts_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
);

CREATE TABLE quiz_attempt_answers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  attempt_id BIGINT UNSIGNED NOT NULL,
  question_id BIGINT UNSIGNED NOT NULL,
  answer_id BIGINT UNSIGNED NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_attempt_answers_attempt FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id),
  CONSTRAINT fk_attempt_answers_question FOREIGN KEY (question_id) REFERENCES quiz_questions(id),
  CONSTRAINT fk_attempt_answers_answer FOREIGN KEY (answer_id) REFERENCES quiz_answers(id)
);

CREATE TABLE course_reviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_review_course_user (course_id, user_id),
  CONSTRAINT fk_reviews_course FOREIGN KEY (course_id) REFERENCES courses(id),
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE discussions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lesson_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  parent_id BIGINT UNSIGNED NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_discussions_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id),
  CONSTRAINT fk_discussions_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_discussions_parent FOREIGN KEY (parent_id) REFERENCES discussions(id)
);

CREATE TABLE notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NULL,
  type VARCHAR(50) NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id)
);

ALTER TABLE lessons 
ADD COLUMN document_url VARCHAR(255) NULL AFTER video_url;
