-- 063_schedule_checklist_template_predictive_slots.sql
-- Bổ sung checklist template cho lịch bảo trì và chuẩn hoá checklist requirement cho WO dự báo.

USE warehouse_maintenance;

-- 1) MaintenanceSchedules: cho phép chọn template checklist theo lịch.
SET @has_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'MaintenanceSchedules'
    AND COLUMN_NAME = 'ChecklistTemplateID'
);

SET @sql_add_col := IF(
  @has_col > 0,
  'SELECT 1',
  'ALTER TABLE MaintenanceSchedules ADD COLUMN ChecklistTemplateID INT NULL AFTER DigitalAssetID'
);
PREPARE stmt_add_col FROM @sql_add_col;
EXECUTE stmt_add_col;
DEALLOCATE PREPARE stmt_add_col;

SET @has_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'MaintenanceSchedules'
    AND INDEX_NAME = 'idx_ms_checklist_template'
);

SET @sql_add_idx := IF(
  @has_idx > 0,
  'SELECT 1',
  'ALTER TABLE MaintenanceSchedules ADD INDEX idx_ms_checklist_template (ChecklistTemplateID)'
);
PREPARE stmt_add_idx FROM @sql_add_idx;
EXECUTE stmt_add_idx;
DEALLOCATE PREPARE stmt_add_idx;

SET @has_fk := (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'MaintenanceSchedules'
    AND CONSTRAINT_NAME = 'fk_ms_checklist_template'
);

SET @sql_add_fk := IF(
  @has_fk > 0,
  'SELECT 1',
  'ALTER TABLE MaintenanceSchedules
     ADD CONSTRAINT fk_ms_checklist_template
     FOREIGN KEY (ChecklistTemplateID) REFERENCES ChecklistTemplates(TemplateID)
     ON UPDATE CASCADE
     ON DELETE SET NULL'
);
PREPARE stmt_add_fk FROM @sql_add_fk;
EXECUTE stmt_add_fk;
DEALLOCATE PREPARE stmt_add_fk;

-- 2) WorkOrders WO_Source cho phép giá trị PREDICTIVE_SCHEDULE (lịch dự báo bắt buộc checklist theo ngày).
SET @wo_source_def := (
  SELECT COLUMN_TYPE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'WorkOrders'
    AND COLUMN_NAME = 'WO_Source'
);

SET @need_enum_expand := IF(@wo_source_def LIKE '%PREDICTIVE_SCHEDULE%', 0, 1);
SET @sql_expand_enum := IF(
  @need_enum_expand = 0,
  'SELECT 1',
  'ALTER TABLE WorkOrders
     MODIFY COLUMN WO_Source
       ENUM(''SCHEDULE'',''PREDICTIVE'',''MANUAL'',''CORRECTIVE'',''PREVENTIVE'',''PREDICTIVE_SCHEDULE'')
       NOT NULL DEFAULT ''MANUAL'''
);
PREPARE stmt_expand_enum FROM @sql_expand_enum;
EXECUTE stmt_expand_enum;
DEALLOCATE PREPARE stmt_expand_enum;
