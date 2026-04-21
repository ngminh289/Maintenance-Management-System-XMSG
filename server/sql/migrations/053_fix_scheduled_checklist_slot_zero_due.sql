-- 053_fix_scheduled_checklist_slot_zero_due.sql
-- Sửa DueDate = 0000-00-00 (do NextDueDate zero date trên lịch khi tạo WO): đồng bộ với PlannedDate của WO.
-- Sau khi chạy, các dòng này mới vào kỳ báo cáo `DueDate >= DATE_SUB(CURDATE(), INTERVAL n MONTH)`.

UPDATE ScheduledChecklistSlots s
INNER JOIN WorkOrders wo ON wo.WO_ID = s.WorkOrderID
SET s.DueDate = wo.PlannedDate
WHERE s.DueDate = '0000-00-00'
  OR s.DueDate < '1970-01-02';
