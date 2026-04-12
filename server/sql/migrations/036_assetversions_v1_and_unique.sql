-- 036_assetversions_v1_and_unique.sql
-- Chuẩn hoá lịch sử phiên bản DAM: mỗi tài liệu có v1 trong AssetVersions (file upload đầu tiên).
-- Backfill: chỉ tài liệu chưa có dòng AssetVersions nào (tránh ghi đè dữ liệu phức tạp).
-- UNIQUE (DigitalAssetID, VersionNumber) — an toàn khi upload phiên bản mới.
USE warehouse_maintenance;

INSERT INTO AssetVersions (DigitalAssetID, VersionNumber, FilePath, ChangedBy, ChangeNote)
SELECT da.DigitalAssetID, 1, da.FilePath, da.UploadedBy, NULL
FROM DigitalAssets da
WHERE NOT EXISTS (
  SELECT 1 FROM AssetVersions av WHERE av.DigitalAssetID = da.DigitalAssetID
);

-- Bỏ qua nếu đã có UNIQUE (chạy lặp migration — kiểm tra thủ công khi lỗi 1061)
SET @idx := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'AssetVersions'
    AND index_name = 'uq_da_vernum'
);
SET @sql := IF(@idx = 0,
  'ALTER TABLE AssetVersions ADD UNIQUE KEY uq_da_vernum (DigitalAssetID, VersionNumber)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
