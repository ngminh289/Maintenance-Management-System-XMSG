-- 006_schedule_due_date.sql
-- Thêm NextDueDate (ngày đến hạn tiếp theo) và LastExecutedDate (ngày thực hiện lần cuối)
-- vào MaintenanceSchedules để hỗ trợ cảnh báo cho lịch theo DAYS/WEEKS/MONTHS.
USE warehouse_maintenance;

ALTER TABLE MaintenanceSchedules
  ADD COLUMN NextDueDate      DATE NULL AFTER StartDate,
  ADD COLUMN LastExecutedDate DATE NULL AFTER NextDueDate;

-- Khởi tạo NextDueDate = StartDate + 1 chu kỳ cho lịch theo ngày đã tồn tại
-- (lần bảo trì đầu tiên đến hạn sau 1 kỳ kể từ ngày bắt đầu)
UPDATE MaintenanceSchedules
  SET NextDueDate = CASE
    WHEN FrequencyUnit = 'DAYS'   THEN DATE_ADD(StartDate, INTERVAL FrequencyValue DAY)
    WHEN FrequencyUnit = 'WEEKS'  THEN DATE_ADD(StartDate, INTERVAL FrequencyValue * 7 DAY)
    WHEN FrequencyUnit = 'MONTHS' THEN DATE_ADD(StartDate, INTERVAL FrequencyValue MONTH)
    WHEN FrequencyUnit = 'YEARS'  THEN DATE_ADD(StartDate, INTERVAL FrequencyValue YEAR)
    ELSE NULL
  END
  WHERE NextDueDate IS NULL AND FrequencyUnit != 'HOURS';
