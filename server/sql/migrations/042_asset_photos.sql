-- ============================================================
-- 042_asset_photos.sql
-- Bảng ảnh tài sản (nhiều ảnh / tài sản, tương tự WorkOrderPhotos).
-- Liên quan: models/assetPhoto.model.js, controllers/asset.controller.js
-- ============================================================

CREATE TABLE IF NOT EXISTS AssetPhotos (
    PhotoID    INT          AUTO_INCREMENT PRIMARY KEY,
    AssetID    INT          NOT NULL,
    FilePath   VARCHAR(512) NOT NULL,
    Caption    VARCHAR(255) NULL,
    UploadedBy INT          NULL,
    CreatedAt  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_asset    (AssetID),
    INDEX idx_uploader (UploadedBy),
    FOREIGN KEY (AssetID)    REFERENCES Assets(AssetID)     ON DELETE CASCADE,
    FOREIGN KEY (UploadedBy) REFERENCES Employees(EmployeeID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
