-- Stage 4 schema (run AFTER step3.sql or step3_patched.sql)
-- Adds: course Q&A chat between buyers and creators (pre-purchase supported)

SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE IF NOT EXISTS chat_conversations (
  id INT NOT NULL AUTO_INCREMENT,
  course_id INT NOT NULL,
  buyer_id INT NOT NULL,
  creator_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_chat_conv (course_id, buyer_id, creator_id),
  KEY idx_chat_conv_buyer (buyer_id, updated_at),
  KEY idx_chat_conv_creator (creator_id, updated_at),
  CONSTRAINT fk_chat_conv_course FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_chat_conv_buyer FOREIGN KEY (buyer_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_chat_conv_creator FOREIGN KEY (creator_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
  id INT NOT NULL AUTO_INCREMENT,
  conversation_id INT NOT NULL,
  sender_id INT NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_chat_msg_conv (conversation_id, created_at),
  KEY idx_chat_msg_sender (sender_id, created_at),
  CONSTRAINT fk_chat_msg_conv FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_chat_msg_sender FOREIGN KEY (sender_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
