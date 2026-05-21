-- 076_fix_slot_work_order_unique_fk.sql
-- Sửa khi 074 báo: Cannot drop index uq_slot_work_order: needed in a foreign key constraint.
-- Thêm unique (WorkOrderID, TemplateID) và index WorkOrderID trước, rồi mới DROP unique cũ.
USE warehouse_maintenance;

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

SET @uq_wo_tpl_ok = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ScheduledChecklistSlots'
    AND INDEX_NAME = 'uq_slot_work_order_template'
);

SET @sql_drop_uq = IF(
  @uq_wo_exists > 0 AND @uq_wo_tpl_ok > 0,
  'ALTER TABLE ScheduledChecklistSlots DROP INDEX uq_slot_work_order',
  'SELECT 1'
);
PREPARE stmt FROM @sql_drop_uq;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill slot thiếu (idempotent, giống 075)
INSERT IGNORE INTO ScheduledChecklistSlots (
    ScheduleID,
    AssetID,
    DueDate,
    WorkOrderID,
    TemplateID,
    Status
)
SELECT
    wo.ScheduleID,
    wo.AssetID,
    COALESCE(
        NULLIF(wo.PlannedDate, '0000-00-00'),
        NULLIF(ms.NextDueDate, '0000-00-00'),
        NULLIF(ms.StartDate, '0000-00-00'),
        CURDATE()
    ),
    wo.WO_ID,
    msct.TemplateID,
    'OPEN'
FROM WorkOrders wo
JOIN MaintenanceScheduleChecklistTemplates msct
  ON msct.ScheduleID = wo.ScheduleID
JOIN MaintenanceSchedules ms ON ms.ScheduleID = wo.ScheduleID
LEFT JOIN ScheduledChecklistSlots s
  ON s.WorkOrderID = wo.WO_ID AND s.TemplateID = msct.TemplateID
WHERE wo.IsDeleted = 0
  AND wo.ScheduleID IS NOT NULL
  AND wo.Status NOT IN ('COMPLETED', 'CANCELLED')
  AND (
    wo.WO_Source = 'SCHEDULE'
    OR wo.WO_Source = 'PREDICTIVE_SCHEDULE'
    OR (wo.WO_Source = 'PREDICTIVE' AND wo.ScheduleID IS NOT NULL)
  )
  AND s.SlotID IS NULL;
