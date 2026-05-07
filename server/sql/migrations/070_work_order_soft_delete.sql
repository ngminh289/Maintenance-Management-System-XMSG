-- 070_work_order_soft_delete.sql
-- Bổ sung soft-delete cho WorkOrders: phiếu xoá vẫn lưu trong DB, có thể truy
-- xuất ở tab "Đã lưu trữ" (chỉ Admin), không xoá kèm checklist/ảnh/lịch sử.
-- Chỉ Admin được khôi phục (POST /work-orders/:id/restore).
-- Liên quan: server/services/workOrder.service.js, client/pages/workorders/*.

USE warehouse_maintenance;

-- IsDeleted: cờ ẩn khỏi danh sách thường (audit + báo cáo lọc bằng IsDeleted=0).
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'WorkOrders'
    AND COLUMN_NAME = 'IsDeleted'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE WorkOrders ADD COLUMN IsDeleted TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- DeletedAt: thời điểm lưu trữ (hiển thị trong tab Đã lưu trữ).
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'WorkOrders'
    AND COLUMN_NAME = 'DeletedAt'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE WorkOrders ADD COLUMN DeletedAt DATETIME NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- DeletedBy: ai đã xoá (audit).
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'WorkOrders'
    AND COLUMN_NAME = 'DeletedBy'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE WorkOrders ADD COLUMN DeletedBy INT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index lọc nhanh phiếu hiện hữu / đã lưu trữ.
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'WorkOrders'
    AND INDEX_NAME = 'idx_wo_isdeleted'
);
SET @sql := IF(@idx_exists = 0,
  'ALTER TABLE WorkOrders ADD INDEX idx_wo_isdeleted (IsDeleted)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FK DeletedBy -> Employees (SET NULL nếu nhân viên bị xoá).
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'WorkOrders'
    AND CONSTRAINT_NAME = 'fk_wo_deletedby'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE WorkOrders ADD CONSTRAINT fk_wo_deletedby FOREIGN KEY (DeletedBy) REFERENCES Employees(EmployeeID) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
