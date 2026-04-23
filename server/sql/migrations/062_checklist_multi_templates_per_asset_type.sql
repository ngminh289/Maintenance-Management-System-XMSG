-- 062_checklist_multi_templates_per_asset_type.sql
-- Cho phép nhiều checklist template trên cùng một loại tài sản.
-- Đồng thời lưu TemplateID vào ChecklistResults để truy vết đúng mẫu đã dùng.

USE warehouse_maintenance;

-- 1) Gỡ unique cũ trên ChecklistTemplates.AssetTypeID (nếu tồn tại).
SET @idx_name := (
  SELECT s.INDEX_NAME
  FROM information_schema.STATISTICS s
  WHERE s.TABLE_SCHEMA = DATABASE()
    AND s.TABLE_NAME = 'ChecklistTemplates'
  GROUP BY s.INDEX_NAME
  HAVING SUM(CASE WHEN s.COLUMN_NAME = 'AssetTypeID' THEN 1 ELSE 0 END) = 1
     AND COUNT(*) = 1
     AND MAX(s.NON_UNIQUE) = 0
  LIMIT 1
);

SET @sql_drop_idx := IF(
  @idx_name IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE ChecklistTemplates DROP INDEX `', @idx_name, '`')
);
PREPARE stmt_drop_idx FROM @sql_drop_idx;
EXECUTE stmt_drop_idx;
DEALLOCATE PREPARE stmt_drop_idx;

-- 2) Thêm cột TemplateID cho ChecklistResults (nếu chưa có).
SET @has_template_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS c
  WHERE c.TABLE_SCHEMA = DATABASE()
    AND c.TABLE_NAME = 'ChecklistResults'
    AND c.COLUMN_NAME = 'TemplateID'
);

SET @sql_add_col := IF(
  @has_template_col > 0,
  'SELECT 1',
  'ALTER TABLE ChecklistResults ADD COLUMN TemplateID INT NULL AFTER WO_ID'
);
PREPARE stmt_add_col FROM @sql_add_col;
EXECUTE stmt_add_col;
DEALLOCATE PREPARE stmt_add_col;

-- 3) Backfill dữ liệu cũ: map về template đầu tiên theo AssetType của tài sản.
UPDATE ChecklistResults cr
JOIN Assets a ON a.AssetID = cr.AssetID
LEFT JOIN (
  SELECT ct.AssetTypeID, MIN(ct.TemplateID) AS FirstTemplateID
  FROM ChecklistTemplates ct
  GROUP BY ct.AssetTypeID
) t ON t.AssetTypeID = a.AssetTypeID
SET cr.TemplateID = t.FirstTemplateID
WHERE cr.TemplateID IS NULL;

-- 4) Tạo FK + index cho TemplateID (nếu chưa có).
SET @has_template_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS s
  WHERE s.TABLE_SCHEMA = DATABASE()
    AND s.TABLE_NAME = 'ChecklistResults'
    AND s.INDEX_NAME = 'idx_checklistresults_templateid'
);

SET @sql_add_idx := IF(
  @has_template_idx > 0,
  'SELECT 1',
  'ALTER TABLE ChecklistResults ADD INDEX idx_checklistresults_templateid (TemplateID)'
);
PREPARE stmt_add_idx FROM @sql_add_idx;
EXECUTE stmt_add_idx;
DEALLOCATE PREPARE stmt_add_idx;

SET @has_template_fk := (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'ChecklistResults'
    AND rc.CONSTRAINT_NAME = 'fk_checklistresults_template'
);

SET @sql_add_fk := IF(
  @has_template_fk > 0,
  'SELECT 1',
  'ALTER TABLE ChecklistResults
     ADD CONSTRAINT fk_checklistresults_template
     FOREIGN KEY (TemplateID) REFERENCES ChecklistTemplates(TemplateID)
     ON UPDATE CASCADE
     ON DELETE SET NULL'
);
PREPARE stmt_add_fk FROM @sql_add_fk;
EXECUTE stmt_add_fk;
DEALLOCATE PREPARE stmt_add_fk;
