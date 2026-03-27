-- 005_add_schedule_name.sql
-- Thêm cột ScheduleName vào MaintenanceSchedules (thiếu khi thiết kế ban đầu).
USE warehouse_maintenance;

ALTER TABLE MaintenanceSchedules
  ADD COLUMN ScheduleName VARCHAR(200) NOT NULL DEFAULT '' AFTER AssetID;
