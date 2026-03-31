-- 021_wo_work_timing.sql — Mốc thời gian làm việc để tính ActualHours tự động (trừ thời gian PAUSED).
-- WorkStartedAt: lần đầu vào IN_PROGRESS; PausedAccumulatedSec: tổng giây đã tạm dừng; PauseStartedAt: đợt pause hiện tại.
-- Ghi mốc từ ứng dụng (Node Date + mysql2), không dùng UTC_TIMESTAMP() trong SQL — tránh lệch múi giờ khi đọc DATETIME.
USE warehouse_maintenance;

ALTER TABLE WorkOrders
  ADD COLUMN WorkStartedAt DATETIME NULL DEFAULT NULL COMMENT 'Moc bat dau (cung TZ voi server/app)' AFTER ActualHours,
  ADD COLUMN PausedAccumulatedSec INT UNSIGNED NOT NULL DEFAULT 0 AFTER WorkStartedAt,
  ADD COLUMN PauseStartedAt DATETIME NULL DEFAULT NULL COMMENT 'Moc pause hien tai' AFTER PausedAccumulatedSec;
