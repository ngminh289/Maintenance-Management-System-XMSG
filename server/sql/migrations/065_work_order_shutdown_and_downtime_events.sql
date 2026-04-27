-- 065_work_order_shutdown_and_downtime_events.sql
-- Bổ sung cờ shutdown cho WO và bảng AssetDowntimeEvents để tính downtime chuẩn.
-- Nguồn dữ liệu:
--   - WORK_ORDER + requiresShutdown=true => PLANNED_MAINTENANCE
--   - Asset status BROKEN -> AVAILABLE/... => UNPLANNED_BREAKDOWN
-- Liên quan: services/workOrder.service.js, services/asset.service.js, controllers/stats.controller.js
USE warehouse_maintenance;

ALTER TABLE WorkOrders
  ADD COLUMN RequiresShutdown TINYINT(1) NOT NULL DEFAULT 0 AFTER EstimatedHours;

CREATE TABLE IF NOT EXISTS AssetDowntimeEvents (
  EventID         BIGINT AUTO_INCREMENT PRIMARY KEY,
  AssetID         INT NOT NULL,
  DowntimeType    ENUM('PLANNED_MAINTENANCE','UNPLANNED_BREAKDOWN') NOT NULL,
  WorkOrderID     INT NULL,
  StartAt         DATETIME NOT NULL,
  EndAt           DATETIME NULL,
  DurationHours   DECIMAL(12,4) NULL,
  Source          ENUM('WORK_ORDER','ASSET_STATUS') NOT NULL,
  Reason          VARCHAR(500) NULL,
  CreatedBy       INT NULL,
  CreatedAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_asset_start (AssetID, StartAt),
  INDEX idx_asset_open (AssetID, EndAt),
  INDEX idx_type_time (DowntimeType, StartAt),
  INDEX idx_source_time (Source, StartAt),
  INDEX idx_workorder (WorkOrderID),
  FOREIGN KEY (AssetID) REFERENCES Assets(AssetID) ON DELETE CASCADE,
  FOREIGN KEY (WorkOrderID) REFERENCES WorkOrders(WO_ID) ON DELETE SET NULL,
  FOREIGN KEY (CreatedBy) REFERENCES Employees(EmployeeID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
