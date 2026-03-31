-- 022_asset_predictive_event_log.sql — Nhật ký sự kiện dự báo bảo trì theo máy (cảnh báo / vượt ngưỡng / tạo WO).
-- Luồng 1.1–2.1: đối chiếu lịch sử thuật toán, không thay AssetRuntimeLogs (ghi nhận Reading).
USE warehouse_maintenance;

CREATE TABLE IF NOT EXISTS AssetPredictiveEventLog (
  LogID       INT AUTO_INCREMENT PRIMARY KEY,
  AssetID     INT          NOT NULL,
  EventType   ENUM('WARN_DUE_SOON','THRESHOLD_EXCEEDED','AUTO_WO_CREATED','AUTO_WO_SKIPPED_DUPLICATE') NOT NULL,
  Detail      VARCHAR(512) NULL,
  RelatedWOId INT          NULL,
  CreatedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_asset_time (AssetID, CreatedAt),
  FOREIGN KEY (AssetID)     REFERENCES Assets(AssetID)     ON DELETE CASCADE,
  FOREIGN KEY (RelatedWOId) REFERENCES WorkOrders(WO_ID)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
