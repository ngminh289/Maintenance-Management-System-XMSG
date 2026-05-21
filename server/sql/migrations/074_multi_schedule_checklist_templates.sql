-- 074_multi_schedule_checklist_templates.sql
-- Nhiều checklist template trên một lịch bảo trì; mỗi WO có nhiều slot (mỗi mẫu một slot).
USE warehouse_maintenance;

CREATE TABLE IF NOT EXISTS MaintenanceScheduleChecklistTemplates (
    ScheduleID   INT NOT NULL,
    TemplateID   INT NOT NULL,
    SortOrder    TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (ScheduleID, TemplateID),
    INDEX idx_msct_template (TemplateID),
    FOREIGN KEY (ScheduleID) REFERENCES MaintenanceSchedules(ScheduleID) ON DELETE CASCADE,
    FOREIGN KEY (TemplateID) REFERENCES ChecklistTemplates(TemplateID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO MaintenanceScheduleChecklistTemplates (ScheduleID, TemplateID, SortOrder)
SELECT ms.ScheduleID, ms.ChecklistTemplateID, 0
FROM MaintenanceSchedules ms
WHERE ms.ChecklistTemplateID IS NOT NULL;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ScheduledChecklistSlots'
    AND COLUMN_NAME = 'TemplateID'
);

SET @sql_add_col = IF(
  @col_exists = 0,
  'ALTER TABLE ScheduledChecklistSlots ADD COLUMN TemplateID INT NULL AFTER WorkOrderID',
  'SELECT 1'
);
PREPARE stmt FROM @sql_add_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ScheduledChecklistSlots'
    AND CONSTRAINT_NAME = 'fk_slot_template'
);

SET @sql_fk = IF(
  @fk_exists = 0,
  'ALTER TABLE ScheduledChecklistSlots ADD CONSTRAINT fk_slot_template FOREIGN KEY (TemplateID) REFERENCES ChecklistTemplates(TemplateID) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE ScheduledChecklistSlots s
JOIN MaintenanceSchedules ms ON ms.ScheduleID = s.ScheduleID
SET s.TemplateID = ms.ChecklistTemplateID
WHERE s.TemplateID IS NULL AND ms.ChecklistTemplateID IS NOT NULL;

-- Thêm unique (WorkOrderID, TemplateID) TRƯỚC khi xóa unique cũ — cột trái WorkOrderID vẫn index cho FK.
SET @uq_wo_tpl_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ScheduledChecklistSlots'
    AND INDEX_NAME = 'uq_slot_work_order_template'
);

SET @sql_add_uq = IF(
  @uq_wo_tpl_exists = 0,
  'ALTER TABLE ScheduledChecklistSlots ADD UNIQUE KEY uq_slot_work_order_template (WorkOrderID, TemplateID)',
  'SELECT 1'
);
PREPARE stmt FROM @sql_add_uq;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index thường cho FK WorkOrderID (nếu vẫn cần sau khi bỏ unique cũ)
SET @idx_wo_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ScheduledChecklistSlots'
    AND INDEX_NAME = 'idx_slot_work_order'
);

SET @sql_add_idx = IF(
  @idx_wo_exists = 0,
  'ALTER TABLE ScheduledChecklistSlots ADD INDEX idx_slot_work_order (WorkOrderID)',
  'SELECT 1'
);
PREPARE stmt FROM @sql_add_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @uq_wo_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ScheduledChecklistSlots'
    AND INDEX_NAME = 'uq_slot_work_order'
);

SET @uq_wo_tpl_exists2 = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ScheduledChecklistSlots'
    AND INDEX_NAME = 'uq_slot_work_order_template'
);

SET @sql_drop_uq = IF(
  @uq_wo_exists > 0 AND @uq_wo_tpl_exists2 > 0,
  'ALTER TABLE ScheduledChecklistSlots DROP INDEX uq_slot_work_order',
  'SELECT 1'
);
PREPARE stmt FROM @sql_drop_uq;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
