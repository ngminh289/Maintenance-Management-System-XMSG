-- 055_rbac_lanes_maintenance_vs_digital.sql
-- Tách luồng: Phòng bảo trì (TC 3, Trưởng/Phó bảo trì 6,8) vs Phòng kỹ thuật (Trưởng/Phó PKT 7,9).
-- Đổi tên Position 6; thêm 7,8,9; cập nhật WorkflowSteps: WO/lịch 1 cấp = 6, tài liệu = 7.
-- Cắt APPROVE sai luồng: TC không APPROVE DAM/lịch 1 cấp; 6 không APPROVE DAM; 3 không duyệt DAM.
-- Phó 8,9 = clone quyền 6,7 (BFD tổ chức — cùng quyền với trưởng, khác tên).
-- Liên quan: approval.service.js (verifyApprover + thông báo), rbac.js, checklist.service.js.

USE warehouse_maintenance;

-- ── 1) Đổi tên & thêm Position ────────────────────────────────────────────
UPDATE Positions
SET PositionName = 'Trưởng phòng Bảo trì', Level = 3
WHERE PositionID = 6;

INSERT INTO Positions (PositionID, PositionName, Level) VALUES
  (7, 'Trưởng phòng Kỹ thuật - CN', 3),
  (8, 'Phó phòng Bảo trì', 3),
  (9, 'Phó phòng Kỹ thuật - CN', 3)
ON DUPLICATE KEY UPDATE PositionName = VALUES(PositionName), Level = VALUES(Level);

ALTER TABLE Positions AUTO_INCREMENT = 10;

-- Phó: clone quyền từ trưởng tương ứng
INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT 8, rp.PermissionName, rp.ResourceType
FROM Roles_Permissions rp WHERE rp.PositionID = 6;

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT 7, rp.PermissionName, rp.ResourceType
FROM Roles_Permissions rp WHERE rp.PositionID = 6;

-- ── 2) Tinh chỉnh APPROVE theo tuyến nghiệp vụ (DB) ───────────────────────
-- Trưởng phòng bảo trì (6) + Phó 8: không phê duyệt tài liệu số (DAM) — tuyến PKT
DELETE FROM Roles_Permissions
WHERE (PositionID IN (6, 8) AND ResourceType = 'DIGITAL_ASSET' AND PermissionName = 'APPROVE');

-- Trưởng ca (3): không duyệt 1 cấp lịch/DAM; vẫn bước 1 WO khẩn (đã cấp APPROVE WORK_ORDER bước 1)
DELETE FROM Roles_Permissions
WHERE PositionID = 3 AND ResourceType = 'MAINTENANCE_PLAN' AND PermissionName = 'APPROVE';
DELETE FROM Roles_Permissions
WHERE PositionID = 3 AND ResourceType = 'DIGITAL_ASSET' AND PermissionName = 'APPROVE';
DELETE FROM Roles_Permissions
WHERE PositionID = 3 AND ResourceType = 'CHECKLIST_TEMPLATE' AND PermissionName = 'APPROVE';

-- Trưởng/Phó PKT: không phê duyệt lịch/WO/checklist theo tuyến bảo trì
DELETE FROM Roles_Permissions
WHERE PositionID IN (7, 9) AND ResourceType = 'MAINTENANCE_PLAN' AND PermissionName = 'APPROVE';
DELETE FROM Roles_Permissions
WHERE PositionID IN (7, 9) AND ResourceType = 'WORK_ORDER' AND PermissionName = 'APPROVE';
DELETE FROM Roles_Permissions
WHERE PositionID IN (7, 9) AND ResourceType = 'CHECKLIST_TEMPLATE' AND PermissionName = 'APPROVE';

-- Giữ READ phục vụ màn hình; CHECKLIST_RESULT UPDATE: chỉ tuyến bảo trì 3,6,8 (xóa 7,9 nếu lỡ copy từ 6)
DELETE FROM Roles_Permissions
WHERE PositionID IN (7, 9) AND ResourceType = 'CHECKLIST_RESULT' AND PermissionName = 'UPDATE';

-- Phó 9: clone từ 7 (đã tỉa quyền ở trên) — cùng quyền Trưởng PKT
INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT 9, rp.PermissionName, rp.ResourceType
FROM Roles_Permissions rp WHERE rp.PositionID = 7;

-- ── 3) Workflow: bước 1 cho lịch + WO 1 cấp = Trưởng/Phó bảo trì (6) ─────
UPDATE WorkflowSteps ws
INNER JOIN WorkflowTemplates wt ON wt.WorkflowID = ws.WorkflowID
SET ws.PositionID = 6
WHERE ws.StepLevel = 1
  AND wt.DocumentType = 'MAINTENANCE_PLAN';

-- WO 1 cấp = Trưởng/Phó bảo trì (6)
UPDATE WorkflowSteps ws
INNER JOIN WorkflowTemplates wt ON wt.WorkflowID = ws.WorkflowID
SET ws.PositionID = 6
WHERE ws.StepLevel = 1
  AND wt.DocumentType = 'WORK_ORDER'
  AND wt.TotalLevels = 1
  AND wt.WorkflowName IN ('Phê duyệt Work Order thông thường', 'Phê duyệt Work Order');

-- Tài liệu số 1 cấp = Trưởng/Phó PKT (7)
UPDATE WorkflowSteps ws
INNER JOIN WorkflowTemplates wt ON wt.WorkflowID = ws.WorkflowID
SET ws.PositionID = 7
WHERE ws.StepLevel = 1
  AND wt.DocumentType = 'DIGITAL_ASSET';

-- B2 WO khẩn vẫn 6; verifyApprover sẽ cho phó 8 tương ứng bước 6
UPDATE WorkflowTemplates
SET Description = 'Kế hoạch bảo trì — 1 cấp: Trưởng/Phó phòng Bảo trì (6/8).'
WHERE DocumentType = 'MAINTENANCE_PLAN' AND TotalLevels = 1;

UPDATE WorkflowTemplates
SET Description = 'Tài liệu số — 1 cấp: Trưởng/Phó phòng Kỹ thuật (7/9).'
WHERE DocumentType = 'DIGITAL_ASSET' AND TotalLevels = 1;
