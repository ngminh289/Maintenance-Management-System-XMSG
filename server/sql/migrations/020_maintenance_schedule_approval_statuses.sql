-- 020_maintenance_schedule_approval_statuses.sql
-- Luồng lịch bảo trì đúng quy trình: DRAFT → PENDING_APPROVAL (chờ Trưởng ca) → PENDING (đã duyệt, chờ TH)
-- Từ chối → REJECTED; yêu cầu sửa → DRAFT. Đồng bộ dữ liệu cũ: lịch DRAFT đang có ApprovalLog PENDING.
USE warehouse_maintenance;

ALTER TABLE MaintenanceSchedules
MODIFY COLUMN Status ENUM(
  'DRAFT',
  'PENDING_APPROVAL',
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'OVERDUE',
  'CANCELLED',
  'REJECTED'
) NOT NULL DEFAULT 'PENDING';

UPDATE MaintenanceSchedules ms
INNER JOIN ApprovalLogs al
  ON al.ResourceID = ms.ScheduleID
  AND al.ResourceType = 'MAINTENANCE_PLAN'
  AND al.Status = 'PENDING'
SET ms.Status = 'PENDING_APPROVAL'
WHERE ms.Status = 'DRAFT';
