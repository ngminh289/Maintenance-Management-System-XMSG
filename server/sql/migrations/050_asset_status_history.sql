-- 050_asset_status_history.sql
-- Lịch sử thay đổi trạng thái tài sản — cần thiết để tính Tỷ lệ dừng máy chính xác (BFD 6.4).
-- Mỗi lần Assets.Status đổi → INSERT một bản ghi vào đây (ghi bởi asset.service.js).
-- Liên quan: services/asset.service.js (updateStatus), controllers/stats.controller.js (performanceReport).
USE warehouse_maintenance;

CREATE TABLE IF NOT EXISTS AssetStatusHistory (
    HistoryID   BIGINT       AUTO_INCREMENT PRIMARY KEY,
    AssetID     INT          NOT NULL,
    OldStatus   ENUM('AVAILABLE','MONITORING','CAUTION','MAINTENANCE','BROKEN','DECOMMISSIONED') NULL COMMENT 'NULL = bản ghi đầu tiên',
    NewStatus   ENUM('AVAILABLE','MONITORING','CAUTION','MAINTENANCE','BROKEN','DECOMMISSIONED') NOT NULL,
    ChangedBy   INT          NULL COMMENT 'EmployeeID người thay đổi; NULL = hệ thống tự động',
    ChangedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_asset_time (AssetID, ChangedAt),
    INDEX idx_new_status (NewStatus, ChangedAt),
    FOREIGN KEY (AssetID)   REFERENCES Assets(AssetID)    ON DELETE CASCADE,
    FOREIGN KEY (ChangedBy) REFERENCES Employees(EmployeeID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed: snapshot trạng thái hiện tại (OldStatus = NULL → đây là điểm khởi đầu lịch sử)
INSERT IGNORE INTO AssetStatusHistory (AssetID, OldStatus, NewStatus, ChangedBy, ChangedAt)
SELECT AssetID, NULL, Status, NULL, NOW()
FROM Assets
WHERE Status IS NOT NULL;
