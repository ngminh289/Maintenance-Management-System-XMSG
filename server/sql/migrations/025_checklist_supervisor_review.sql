-- migrations/025_checklist_supervisor_review.sql
-- BFD mục 3: KTV gửi checklist → Trưởng ca xác nhận OK / Duyệt theo dõi (WARNING) / Xác nhận NG
-- mới áp dụng đổi trạng thái tài sản, WO, ghi giờ chạy.

ALTER TABLE ChecklistResults
  ADD COLUMN ReviewStatus ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING' AFTER ReadingValue,
  ADD COLUMN ReviewedBy INT NULL DEFAULT NULL AFTER ReviewStatus,
  ADD COLUMN ReviewedAt DATETIME NULL DEFAULT NULL AFTER ReviewedBy,
  ADD COLUMN SupervisorNotes TEXT NULL AFTER ReviewedAt,
  ADD INDEX idx_review_status (ReviewStatus),
  ADD CONSTRAINT fk_checklist_reviewed_by
    FOREIGN KEY (ReviewedBy) REFERENCES Employees(EmployeeID);

-- Dữ liệu cũ: coi như đã xử lý xong (tránh treo hàng chờ)
UPDATE ChecklistResults
SET ReviewStatus = 'APPROVED',
    ReviewedAt     = COALESCE(ReviewedAt, CheckTime),
    ReviewedBy     = COALESCE(ReviewedBy, CheckerID)
WHERE ReviewStatus = 'PENDING';
