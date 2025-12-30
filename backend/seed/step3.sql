-- Stage 3 schema (run AFTER step2.sql)
-- Adds:
-- 1) Optional contact info for private lessons.
-- 2) Order processing pipeline (statuses + audit log).
-- 3) Provider-agnostic payments table.
-- 4) Notification outbox (email) for external delivery.
-- 5) User profile table (account module).

SET FOREIGN_KEY_CHECKS=0;

/* =========================
   Courses: private lesson contact info
========================= */
ALTER TABLE courses
  ADD COLUMN contact_phone VARCHAR(60) NULL AFTER description,
  ADD COLUMN contact_note VARCHAR(255) NULL AFTER contact_phone,
  ADD COLUMN is_private_lesson TINYINT(1) NOT NULL DEFAULT 0 AFTER is_published;

/* =========================
   Accounts: user profiles
========================= */
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INT NOT NULL,
  full_name VARCHAR(190) NULL,
  phone VARCHAR(60) NULL,
  billing_address VARCHAR(255) NULL,
  city VARCHAR(120) NULL,
  country VARCHAR(120) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* =========================
   Orders: pipeline statuses
   NOTE: We keep ENUM for clarity in the course project.
========================= */
ALTER TABLE orders
  MODIFY COLUMN status ENUM(
    'created',
    'payment_authorizing',
    'payment_authorized',
    'payment_failed',
    'stock_checking',
    'stock_reserved',
    'fulfillment_pending',
    'fulfilled',
    'completed',
    'cancelled',
    'refunded'
  ) NOT NULL DEFAULT 'created';

/* =========================
   Payments
========================= */
CREATE TABLE IF NOT EXISTS payments (
  id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  provider ENUM('stripe','braintree','adyen','test') NOT NULL DEFAULT 'test',
  intent_id VARCHAR(120) NULL,
  status ENUM('initiated','authorized','captured','failed','refunded') NOT NULL DEFAULT 'initiated',
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  raw_response JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payments_order (order_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* =========================
   Order audit events
========================= */
CREATE TABLE IF NOT EXISTS order_events (
  id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  message VARCHAR(255) NULL,
  meta JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_events_order (order_id),
  CONSTRAINT fk_order_events_order FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* =========================
   Notification outbox (email)
========================= */
CREATE TABLE IF NOT EXISTS notification_outbox (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  channel ENUM('email','sms') NOT NULL DEFAULT 'email',
  to_addr VARCHAR(190) NOT NULL,
  subject VARCHAR(190) NULL,
  body TEXT NULL,
  status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
  last_error VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_outbox_user_status (user_id, status),
  CONSTRAINT fk_outbox_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
