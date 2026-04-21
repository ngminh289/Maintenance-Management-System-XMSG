-- 058_rbac_pkt_work_order_readonly.sql
-- Trưởng/Phó phòng Kỹ thuật - CN (7, 9): chỉ READ phiếu việc — không tạo/sửa/trạng thái/phân công/ảnh/xóa.
-- Liên quan: workOrder.routes.js (UPDATE|CREATE|DELETE), client/utils/rbac.js.

USE warehouse_maintenance;

DELETE FROM Roles_Permissions
WHERE PositionID IN (7, 9)
  AND ResourceType = 'WORK_ORDER'
  AND PermissionName IN ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'SUBMIT', 'EXPORT');

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(7, 'READ', 'WORK_ORDER'),
(9, 'READ', 'WORK_ORDER');
