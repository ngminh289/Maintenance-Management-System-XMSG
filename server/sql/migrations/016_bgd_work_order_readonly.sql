-- 016_bgd_work_order_readonly.sql
-- Ban Giám đốc: WORK_ORDER chỉ READ (không APPROVE/DELETE). Duyệt tập trung Trưởng ca.
-- Liên quan: client/src/utils/rbac.js.
USE warehouse_maintenance;

DELETE FROM Roles_Permissions
WHERE PositionID = 5
  AND ResourceType = 'WORK_ORDER'
  AND PermissionName IN ('APPROVE', 'DELETE');
