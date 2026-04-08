-- 029_wo_awaiting_closure_photos.sql — Bước 5–6 quy trình WO: thợ báo hoàn thành + ảnh hiện trường → Chờ nghiệm thu → TC/TP đóng phiếu.
-- WorkReportedAt: mốc kết thúc làm việc để tính giờ thực tế (không tính thời gian chờ duyệt).
USE warehouse_maintenance;

ALTER TABLE WorkOrders
  ADD COLUMN WorkReportedAt DATETIME NULL DEFAULT NULL COMMENT 'Thoi diem thong bao hoan thanh cho nghiem thu' AFTER PauseStartedAt;

ALTER TABLE WorkOrders
  MODIFY COLUMN Status ENUM(
    'PENDING_APPROVAL','WAITING','IN_PROGRESS','PAUSED','AWAITING_CLOSURE','COMPLETED','CANCELLED'
  ) NOT NULL DEFAULT 'WAITING';

CREATE TABLE IF NOT EXISTS WorkOrderPhotos (
  PhotoID    INT AUTO_INCREMENT PRIMARY KEY,
  WO_ID      INT          NOT NULL,
  FilePath   VARCHAR(512) NOT NULL,
  UploadedBy INT          NULL,
  CreatedAt  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wo (WO_ID),
  FOREIGN KEY (WO_ID)      REFERENCES WorkOrders(WO_ID)     ON DELETE CASCADE,
  FOREIGN KEY (UploadedBy) REFERENCES Employees(EmployeeID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
