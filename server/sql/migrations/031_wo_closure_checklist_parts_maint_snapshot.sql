-- 031_wo_closure_checklist_parts_maint_snapshot.sql
-- WO: ghi chú thợ khi báo chờ nghiệm thu; checklist: vật tư/linh kiện; lịch sử bảo trì: snapshot không phụ thuộc mở WO.
USE warehouse_maintenance;

ALTER TABLE WorkOrders
  ADD COLUMN ClosureFieldNotes TEXT NULL DEFAULT NULL COMMENT 'Ghi chú hiện trường khi thợ báo AWAITING_CLOSURE' AFTER Description,
  ADD COLUMN ClosurePartsNotes TEXT NULL DEFAULT NULL COMMENT 'Linh kiện đã thay / vật tư cần thay' AFTER ClosureFieldNotes;

ALTER TABLE ChecklistResults
  ADD COLUMN PartsNotes TEXT NULL DEFAULT NULL COMMENT 'Linh kiện/vật tư (đã thay, cần thay)' AFTER Notes;

ALTER TABLE AssetMaintenanceHistory
  ADD COLUMN FieldNotes TEXT NULL DEFAULT NULL COMMENT 'Snapshot ghi chú hiện trường WO' AFTER Description,
  ADD COLUMN PartsNotes TEXT NULL DEFAULT NULL COMMENT 'Snapshot linh kiện/vật tư' AFTER FieldNotes,
  ADD COLUMN TechnicianSummary VARCHAR(500) NULL DEFAULT NULL COMMENT 'Người thực hiện (tên)' AFTER PartsNotes,
  ADD COLUMN PhotoCount INT NULL DEFAULT NULL COMMENT 'Số ảnh hiện trường lúc hoàn thành' AFTER TechnicianSummary;
