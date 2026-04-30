-- 066_rbac_kts_employee_and_truongca_checklist_submit.sql
-- 1) Cấp full quyền Nhân sự cho Chuyên viên KTS (PositionID=2) tương đương Admin trên resource EMPLOYEE.
-- 2) Cho Trưởng ca (PositionID=3) được nộp checklist hiện trường (CHECKLIST_RESULT:CREATE).

-- Đồng bộ quyền Nhân sự từ Admin (PositionID=4) sang Chuyên viên KTS (PositionID=2)
INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT
  2 AS PositionID,
  rp.PermissionName,
  rp.ResourceType
FROM Roles_Permissions rp
WHERE rp.PositionID = 4
  AND rp.ResourceType = 'EMPLOYEE';

-- Trưởng ca được nộp checklist
INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
VALUES (3, 'CREATE', 'CHECKLIST_RESULT');

