-- 072_dam_version_archive.sql
-- Lưu trữ ở cấp PHIÊN BẢN cho Tài liệu số: thay vì xoá cứng, mỗi version có
-- thể được đánh dấu IsArchived. Khi phiên bản bị archive trùng với
-- CurrentVersion, BE tự fallback CurrentVersion về phiên bản còn active mới
-- nhất; nếu hết phiên bản → archive cả tài liệu (DigitalAssets.Status='ARCHIVED').
-- Tab "Đã lưu trữ" (Admin + Trưởng/Phó PKT) liệt kê toàn bộ versions archived.
-- Liên quan: server/services/digitalAsset.service.js, models/digitalAsset.model.js.

USE warehouse_maintenance;

-- IsArchived: cờ ẩn version khỏi danh sách thông thường.
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'AssetVersions'
    AND COLUMN_NAME = 'IsArchived'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE AssetVersions ADD COLUMN IsArchived TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ArchivedAt: thời điểm chuyển vào kho lưu trữ.
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'AssetVersions'
    AND COLUMN_NAME = 'ArchivedAt'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE AssetVersions ADD COLUMN ArchivedAt DATETIME NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ArchivedBy: ai đã lưu trữ (audit).
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'AssetVersions'
    AND COLUMN_NAME = 'ArchivedBy'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE AssetVersions ADD COLUMN ArchivedBy INT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index để filter nhanh active vs archived theo từng tài liệu.
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'AssetVersions'
    AND INDEX_NAME = 'idx_av_doc_archived'
);
SET @sql := IF(@idx_exists = 0,
  'ALTER TABLE AssetVersions ADD INDEX idx_av_doc_archived (DigitalAssetID, IsArchived)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FK ArchivedBy -> Employees (SET NULL khi nhân viên bị xoá).
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'AssetVersions'
    AND CONSTRAINT_NAME = 'fk_av_archivedby'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE AssetVersions ADD CONSTRAINT fk_av_archivedby FOREIGN KEY (ArchivedBy) REFERENCES Employees(EmployeeID) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
