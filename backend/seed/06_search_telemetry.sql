-- Stage 6 schema
-- Search telemetry for ML-ish popular searches and personalization signals.

SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE IF NOT EXISTS search_events (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id INT NULL,
  query_text VARCHAR(120) NOT NULL,
  context VARCHAR(40) NOT NULL DEFAULT 'catalog',
  user_agent VARCHAR(255) NULL,
  ip VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_search_events_created_at (created_at),
  KEY idx_search_events_query (query_text),
  KEY idx_search_events_user (user_id),
  CONSTRAINT fk_search_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
