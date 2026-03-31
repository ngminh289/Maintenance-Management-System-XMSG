-- 019_truong_phong_position_and_wo_urgent_step2.sql
-- Tách Trưởng phòng khỏi Trưởng ca trong DB để duyệt 2 cấp có thể kiểm tra đúng người:
--   PositionID 3 — Trưởng ca (bước 1 WO khẩn cấp)
--   PositionID 6 — Trưởng phòng (bước 2 WO khẩn cấp); Level = 3 giống TC (cùng tầng quản lý).
-- Sao chép Roles_Permissions từ 3 → 6. Gán nhân viên Trưởng phòng: cập nhật Employees.PositionID = 6 (thủ công hoặc script).
-- Liên quan: approval.service.js verifyApprover, rbac.js (positionId === 6).
USE warehouse_maintenance;

UPDATE Positions
SET PositionName = 'Trưởng ca'
WHERE PositionID = 3;

INSERT IGNORE INTO Positions (PositionID, PositionName, Level) VALUES
  (6, 'Trưởng phòng', 3);

ALTER TABLE Positions AUTO_INCREMENT = 7;

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT 6, rp.PermissionName, rp.ResourceType
FROM Roles_Permissions rp
WHERE rp.PositionID = 3;

UPDATE WorkflowSteps ws
INNER JOIN WorkflowTemplates wt ON wt.WorkflowID = ws.WorkflowID
SET ws.PositionID = 6
WHERE wt.WorkflowName = 'Phê duyệt WO khẩn cấp'
  AND wt.DocumentType = 'WORK_ORDER'
  AND ws.StepLevel = 2;

UPDATE WorkflowTemplates
SET Description = 'WO PREDICTIVE/CORRECTIVE hoặc HIGH|EMERGENCY — bước 1: Trưởng ca (Position 3), bước 2: Trưởng phòng (Position 6).'
WHERE WorkflowName = 'Phê duyệt WO khẩn cấp' AND DocumentType = 'WORK_ORDER';
