-- 033_drop_checklistresults_partsnotes.sql — Bỏ PartsNotes khỏi ChecklistResults (vật tư chỉ ghi trên phiếu việc / lịch sử bảo trì WO).
USE warehouse_maintenance;

ALTER TABLE ChecklistResults DROP COLUMN PartsNotes;
