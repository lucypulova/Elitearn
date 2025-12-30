-- Stage 2 schema (run AFTER seed.sql)
-- Adds: users/roles, creator ownership, cart, orders, enrollments, course assets.

SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('buyer','creator','admin') NOT NULL DEFAULT 'buyer',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Courses: add owner (creator)
ALTER TABLE courses
  ADD COLUMN creator_user_id INT NULL AFTER category_id,
  ADD KEY idx_courses_creator (creator_user_id),
  ADD CONSTRAINT fk_courses_creator
    FOREIGN KEY (creator_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Carts
CREATE TABLE IF NOT EXISTS carts (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  status ENUM('active','ordered','abandoned') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_carts_user_status (user_id, status),
  CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cart_items (
  id INT NOT NULL AUTO_INCREMENT,
  cart_id INT NOT NULL,
  course_id INT NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cart_course (cart_id, course_id),
  KEY idx_cart_items_course (course_id),
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cart_items_course FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id INT NOT NULL AUTO_INCREMENT,
  order_number VARCHAR(40) NOT NULL,
  user_id INT NOT NULL,
  status ENUM('pending','confirmed','cancelled','completed') NOT NULL DEFAULT 'confirmed',
  full_name VARCHAR(190) NULL,
  phone VARCHAR(60) NULL,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_number (order_number),
  KEY idx_orders_user (user_id),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  course_id INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  qty INT NOT NULL DEFAULT 1,
  line_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id),
  KEY idx_order_items_order (order_id),
  KEY idx_order_items_course (course_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_order_items_course FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Enrollments
CREATE TABLE IF NOT EXISTS enrollments (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  order_id INT NOT NULL,
  status ENUM('active','refunded','cancelled') NOT NULL DEFAULT 'active',
  granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_enroll_user_course (user_id, course_id),
  KEY idx_enroll_course (course_id),
  CONSTRAINT fk_enroll_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_enroll_course FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_enroll_order FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Course assets
CREATE TABLE IF NOT EXISTS course_assets (
  id INT NOT NULL AUTO_INCREMENT,
  course_id INT NOT NULL,
  title VARCHAR(190) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_assets_course (course_id),
  CONSTRAINT fk_assets_course FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
