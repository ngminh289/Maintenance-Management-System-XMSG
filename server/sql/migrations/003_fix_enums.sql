-- migrations/003_fix_enums.sql
-- Bổ sung giá trị ENUM còn thiếu theo luong1.rule và luongxulykiemtra.rule:
--   WO_Source += 'CORRECTIVE'   (phiếu khắc phục sự cố, tạo từ checklist NG)
--   Assets.Status += 'CAUTION'  (máy vẫn chạy nhưng có dấu hiệu bất thường)

USE warehouse_maintenance;

ALTER TABLE WorkOrders
  MODIFY COLUMN WO_Source
    ENUM('SCHEDULE','PREDICTIVE','MANUAL','CORRECTIVE') NOT NULL DEFAULT 'MANUAL';

ALTER TABLE Assets
  MODIFY COLUMN Status
    ENUM('AVAILABLE','MAINTENANCE','BROKEN','DECOMMISSIONED','CAUTION') NOT NULL DEFAULT 'AVAILABLE';
