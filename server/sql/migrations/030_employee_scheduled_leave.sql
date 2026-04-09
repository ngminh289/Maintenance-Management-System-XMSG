-- migrations/030_employee_scheduled_leave.sql
-- Lịch nghỉ phép: LeaveStartAt / LeaveEndAt — trong khoảng NOW() coi như ON_LEAVE (tính khi đọc SQL).
-- Idempotent.

SET @c1 := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Employees' AND COLUMN_NAME = 'LeaveStartAt'
);
SET @sql1 := IF(@c1 = 0,
  'ALTER TABLE Employees ADD COLUMN LeaveStartAt DATETIME NULL AFTER WasEverActivated',
  'SELECT 1'
);
PREPARE s1 FROM @sql1; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @c2 := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Employees' AND COLUMN_NAME = 'LeaveEndAt'
);
SET @sql2 := IF(@c2 = 0,
  'ALTER TABLE Employees ADD COLUMN LeaveEndAt DATETIME NULL AFTER LeaveStartAt',
  'SELECT 1'
);
PREPARE s2 FROM @sql2; EXECUTE s2; DEALLOCATE PREPARE s2;
