-- Stage 5 schema (run AFTER step3.sql / step3_patched.sql)
-- Adds profile avatar URL for user profile pictures.

SET FOREIGN_KEY_CHECKS=0;

ALTER TABLE user_profiles
  ADD COLUMN avatar_url VARCHAR(255) NULL AFTER country;

SET FOREIGN_KEY_CHECKS=1;
