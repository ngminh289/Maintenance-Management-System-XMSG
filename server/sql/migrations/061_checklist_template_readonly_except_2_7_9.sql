-- 061_checklist_template_readonly_except_2_7_9.sql
-- Chốt RBAC cho mẫu checklist:
--   - Position 2, 7, 9: CREATE / READ / UPDATE / DELETE
--   - Mọi position còn lại: chỉ READ
-- Không dùng APPROVE cho CHECKLIST_TEMPLATE.

USE warehouse_maintenance;

DELETE FROM Roles_Permissions
WHERE ResourceType = 'CHECKLIST_TEMPLATE'
  AND PermissionName IN ('CREATE', 'UPDATE', 'DELETE', 'APPROVE');

DELETE FROM Roles_Permissions
WHERE ResourceType = 'CHECKLIST_TEMPLATE'
  AND PermissionName = 'READ';

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT p.PositionID, 'READ', 'CHECKLIST_TEMPLATE'
FROM Positions p;

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT p.PositionID, perms.PermissionName, 'CHECKLIST_TEMPLATE'
FROM Positions p
JOIN (
  SELECT 'CREATE' AS PermissionName
  UNION ALL SELECT 'READ'
  UNION ALL SELECT 'UPDATE'
  UNION ALL SELECT 'DELETE'
) perms
  ON 1 = 1
WHERE p.PositionID IN (2, 7, 9);
