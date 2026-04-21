-- 054_resource_usage_logs.sql
-- Log phục vụ "Báo cáo sử dụng tài nguyên": mỗi lần mở màn hình QR (getQRInfo) và mỗi lần user mở file từ checklist.
-- Bảng: AssetQrAccessLogs (tài sản + nhân sự + thời điểm), DigitalAssetViewLogs (tài liệu số + nhân sự + thời điểm).
-- Liên quan: models/assetQrAccessLog.model.js, digitalAssetViewLog.model.js, services/checklist.service.js, stats.controller.js.
USE warehouse_maintenance;

CREATE TABLE IF NOT EXISTS AssetQrAccessLogs (
  LogID       BIGINT AUTO_INCREMENT PRIMARY KEY,
  AssetID     INT NOT NULL,
  EmployeeID  INT NOT NULL,
  AccessAt    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_aqr_asset_time  (AssetID, AccessAt),
  INDEX idx_aqr_emp_time   (EmployeeID, AccessAt),
  CONSTRAINT fk_aqr_asset   FOREIGN KEY (AssetID)    REFERENCES Assets(AssetID)     ON DELETE CASCADE,
  CONSTRAINT fk_aqr_employee FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS DigitalAssetViewLogs (
  LogID           BIGINT AUTO_INCREMENT PRIMARY KEY,
  DigitalAssetID  INT NOT NULL,
  EmployeeID      INT NOT NULL,
  AccessAt        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dav_da_time   (DigitalAssetID, AccessAt),
  INDEX idx_dav_emp_time  (EmployeeID, AccessAt),
  CONSTRAINT fk_dav_da   FOREIGN KEY (DigitalAssetID) REFERENCES DigitalAssets(DigitalAssetID) ON DELETE CASCADE,
  CONSTRAINT fk_dav_emp  FOREIGN KEY (EmployeeID)   REFERENCES Employees(EmployeeID)         ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
