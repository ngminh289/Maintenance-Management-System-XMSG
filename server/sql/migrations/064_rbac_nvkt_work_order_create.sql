-- 064_rbac_nvkt_work_order_create.sql
-- Đảm bảo Chuyên viên KTS (PositionID=2) có quyền tạo Work Order.
-- Đồng bộ với UI: canDo('WORK_ORDER:CREATE') và nút tạo WO từ lịch bảo trì.

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
VALUES (2, 'CREATE', 'WORK_ORDER');

