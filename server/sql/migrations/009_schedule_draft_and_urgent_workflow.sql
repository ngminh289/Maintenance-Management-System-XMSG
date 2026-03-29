-- 009_schedule_draft_and_urgent_workflow.sql
-- Bổ sung luồng còn thiếu theo thiết kế (Workflow sheet):
--   1. Thêm trạng thái DRAFT cho MaintenanceSchedules (lịch tạo xong cần phê duyệt mới kích hoạt)
--   2. Thêm Workflow "Phê duyệt WO khẩn cấp" (1 cấp: Trưởng phòng) cho PREDICTIVE / CORRECTIVE
--   3. Thêm WORK_ORDER_COMPLETED vào Notifications.Type
--
-- Liên quan: maintenanceSchedule.model.js, approval.service.js, workOrder.service.js.

USE warehouse_maintenance;

-- ─── 1. Thêm DRAFT vào MaintenanceSchedules.Status ───────────────────────────
ALTER TABLE MaintenanceSchedules
  MODIFY Status ENUM('DRAFT','PENDING','IN_PROGRESS','COMPLETED','OVERDUE','CANCELLED')
  NOT NULL DEFAULT 'PENDING';

-- Không cần cập nhật dữ liệu cũ — chúng đã PENDING (đã được kích hoạt trước đây).

-- ─── 2. Workflow "Phê duyệt WO khẩn cấp" ─────────────────────────────────────
-- PREDICTIVE / CORRECTIVE / EMERGENCY → Trưởng phòng cơ điện duyệt trực tiếp (1 cấp).
INSERT INTO WorkflowTemplates (WorkflowName, DocumentType, TotalLevels, Description)
VALUES (
  'Phê duyệt WO khẩn cấp',
  'WORK_ORDER',
  1,
  'Dùng cho WO nguồn PREDICTIVE hoặc CORRECTIVE / độ ưu tiên EMERGENCY — Trưởng phòng xét duyệt trực tiếp.'
);

-- WorkflowSteps: Step 1 = Trưởng phòng cơ điện (PositionID = 3)
INSERT INTO WorkflowSteps (WorkflowID, StepLevel, PositionID)
SELECT wt.WorkflowID, 1, p.PositionID
FROM   WorkflowTemplates wt
JOIN   Positions         p  ON p.PositionName = 'Trưởng phòng cơ điện'
WHERE  wt.WorkflowName = 'Phê duyệt WO khẩn cấp'
  AND  wt.DocumentType = 'WORK_ORDER'
LIMIT 1;

-- ─── 3. Thêm WORK_ORDER_COMPLETED vào Notifications.Type ────────────────────
ALTER TABLE Notifications
  MODIFY Type ENUM('MAINTENANCE_DUE','APPROVAL_REQUEST','WORK_ORDER_ASSIGNED','WORK_ORDER_COMPLETED','SYSTEM_ALERT','TASK_OVERDUE')
  NOT NULL DEFAULT 'SYSTEM_ALERT';
