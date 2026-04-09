-- 032_wo_counter_baseline_reset_audit.sql — Ghi nhận reset mốc giờ chạy (CORRECTIVE) trên phiếu: tránh bấm lặp + hiển thị khi làm / nghiệm thu.
-- CounterBaselineResetAt / By: audit; API POST counter-reset-baseline chỉ cho phép một lần trên mỗi WO.
USE warehouse_maintenance;

ALTER TABLE WorkOrders
  ADD COLUMN CounterBaselineResetAt DATETIME NULL DEFAULT NULL COMMENT 'Da reset LastMaintenanceTotal tu phieu nay' AFTER WorkReportedAt,
  ADD COLUMN CounterBaselineResetBy INT NULL DEFAULT NULL COMMENT 'Nguoi thuc hien reset' AFTER CounterBaselineResetAt;

ALTER TABLE WorkOrders
  ADD CONSTRAINT fk_wo_counter_baseline_reset_by
    FOREIGN KEY (CounterBaselineResetBy) REFERENCES Employees(EmployeeID) ON DELETE SET NULL;
