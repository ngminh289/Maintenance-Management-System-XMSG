-- migrations/004_asset_status_monitoring.sql
-- Thêm trạng thái MONITORING (Theo dõi) vào Assets.Status.
-- Ý nghĩa: Máy đang được giám sát chặt sau khi có dấu hiệu bất thường nhẹ,
--          khác CAUTION (cảnh báo rõ) và MAINTENANCE (đang bảo trì).

USE warehouse_maintenance;

ALTER TABLE Assets
  MODIFY COLUMN Status
    ENUM(
      'AVAILABLE',      -- Sẵn sàng hoạt động bình thường
      'MONITORING',     -- Đang theo dõi (có dấu hiệu nhẹ, cần giám sát thêm)
      'CAUTION',        -- Cảnh báo (có dấu hiệu rõ bất thường, đã tạo WO predictive)
      'MAINTENANCE',    -- Đang bảo trì (ngừng để bảo dưỡng theo lịch)
      'BROKEN',         -- Hỏng / ngừng hoạt động (đã tạo WO corrective khẩn)
      'DECOMMISSIONED'  -- Đã loại biên / lưu trữ (soft delete)
    ) NOT NULL DEFAULT 'AVAILABLE';
