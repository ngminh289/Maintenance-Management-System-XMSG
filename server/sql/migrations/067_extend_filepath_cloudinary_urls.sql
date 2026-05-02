-- 067_extend_filepath_cloudinary_urls.sql
-- URL Cloudinary (secure_url) có thể dài hơn 255 ký tự — mở rộng cột lưu đường dẫn file.

ALTER TABLE DigitalAssets
  MODIFY COLUMN FilePath VARCHAR(1024) NOT NULL;

ALTER TABLE AssetVersions
  MODIFY COLUMN FilePath VARCHAR(1024) NOT NULL;

ALTER TABLE ChecklistResults
  MODIFY COLUMN EvidencePhoto VARCHAR(1024) NULL;
