-- 024_asset_maintenance_history.sql — Lịch sử bảo trì theo tài sản (mỗi lần WO hoàn thành).
USE warehouse_maintenance;

CREATE TABLE IF NOT EXISTS AssetMaintenanceHistory (
  HistoryID           BIGINT AUTO_INCREMENT PRIMARY KEY,
  AssetID             INT            NOT NULL,
  WorkOrderID         INT            NULL,
  ScheduleID          INT            NULL,
  WoSource            ENUM('SCHEDULE','PREDICTIVE','MANUAL','CORRECTIVE') NOT NULL,
  CompletedDate       DATE           NOT NULL,
  ActualHours         DECIMAL(5,2)   NULL,
  TotalRuntimeHours   DECIMAL(12,2)  NULL COMMENT 'Snapshot TotalAccumulatedHours luc hoan thanh',
  Description         VARCHAR(500)   NULL,
  CreatedAt           DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_asset_completed (AssetID, CompletedDate DESC),
  INDEX idx_wo (WorkOrderID),
  FOREIGN KEY (AssetID)    REFERENCES Assets(AssetID)              ON DELETE CASCADE,
  FOREIGN KEY (WorkOrderID) REFERENCES WorkOrders(WO_ID)            ON DELETE SET NULL,
  FOREIGN KEY (ScheduleID) REFERENCES MaintenanceSchedules(ScheduleID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
