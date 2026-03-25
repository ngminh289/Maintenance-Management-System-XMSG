-- migrations/001_employee_fields.sql
-- Thêm EmailVerified, IsActive vào Employees (bắt buộc cho function.rule: verify gmail).
-- Chạy lần 1: mysql -u root -p warehouse_maintenance < 001_employee_fields.sql

ALTER TABLE Employees
  ADD COLUMN EmailVerified BOOLEAN NOT NULL DEFAULT FALSE AFTER Email,
  ADD COLUMN IsActive      BOOLEAN NOT NULL DEFAULT TRUE  AFTER EmailVerified;
