-- 014_employee_was_ever_activated.sql
-- Phân biệt chờ admin kích hoạt (tự đăng ký) vs tài khoản bị vô hiệu sau khi đã hoạt động.
-- Idempotent: bỏ qua nếu schema.sql mới đã có cột.
USE warehouse_maintenance;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Employees' AND COLUMN_NAME = 'WasEverActivated'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE Employees ADD COLUMN WasEverActivated BOOLEAN NOT NULL DEFAULT FALSE AFTER IsActive',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE Employees SET WasEverActivated = TRUE WHERE IsActive = TRUE OR EmailVerified = TRUE;
