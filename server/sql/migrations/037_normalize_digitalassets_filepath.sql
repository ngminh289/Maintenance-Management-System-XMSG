-- 037_normalize_digitalassets_filepath.sql
-- Chuẩn hoá FilePath: chỉ tên file (tránh URL chứa C:/Users/... trên Windows).
USE warehouse_maintenance;

UPDATE DigitalAssets
SET FilePath = SUBSTRING_INDEX(REPLACE(IFNULL(FilePath, ''), CHAR(92), '/'), '/', -1)
WHERE FilePath IS NOT NULL AND TRIM(FilePath) <> '';

UPDATE AssetVersions
SET FilePath = SUBSTRING_INDEX(REPLACE(IFNULL(FilePath, ''), CHAR(92), '/'), '/', -1)
WHERE FilePath IS NOT NULL AND TRIM(FilePath) <> '';
