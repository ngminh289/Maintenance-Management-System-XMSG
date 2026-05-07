-- 071_rbac_work_order_view_edit_delete.sql
-- Đồng bộ phân quyền WORK_ORDER theo bảng Xem/Sửa/Xoá:
--   QTV (4)             : đủ quyền (CRUD + APPROVE + DELETE + RESTORE)
--   Trưởng/Phó BT (6,8) : đủ quyền
--   Trưởng/Phó PKT (7,9): đủ quyền (đã có READ ở mig 058 — bổ sung CREATE/UPDATE/DELETE)
--   Trưởng ca (3)       : READ + UPDATE (chỉ sửa khi đã duyệt — service chặn)
--   CV KTS (2)          : CREATE + READ + UPDATE (sửa pre-approval — service chặn)
--   KTV HT (1), BGĐ (5) : chỉ READ
-- Liên quan: server/services/workOrder.service.js, client/utils/rbac.js.

USE warehouse_maintenance;

-- ── Reset CRUD WORK_ORDER (giữ APPROVE riêng — đã có ở mig 019/064) ─────────
DELETE FROM Roles_Permissions
WHERE ResourceType = 'WORK_ORDER'
  AND PermissionName IN ('CREATE', 'READ', 'UPDATE', 'DELETE');

-- READ: tất cả role 1..9
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(1, 'READ',   'WORK_ORDER'),
(2, 'READ',   'WORK_ORDER'),
(3, 'READ',   'WORK_ORDER'),
(4, 'READ',   'WORK_ORDER'),
(5, 'READ',   'WORK_ORDER'),
(6, 'READ',   'WORK_ORDER'),
(7, 'READ',   'WORK_ORDER'),
(8, 'READ',   'WORK_ORDER'),
(9, 'READ',   'WORK_ORDER');

-- KTV HT (1): UPDATE để chuyển trạng thái khi nhận việc / hoàn thành phiếu.
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(1, 'UPDATE', 'WORK_ORDER');

-- CV KTS (2): CREATE + UPDATE (service kiểm tra status pre-approval).
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(2, 'CREATE', 'WORK_ORDER'),
(2, 'UPDATE', 'WORK_ORDER');

-- TC (3): UPDATE (service chặn theo role+status — chỉ post-approval).
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(3, 'CREATE', 'WORK_ORDER'),
(3, 'UPDATE', 'WORK_ORDER');

-- QTV (4): đủ quyền.
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(4, 'CREATE', 'WORK_ORDER'),
(4, 'UPDATE', 'WORK_ORDER'),
(4, 'DELETE', 'WORK_ORDER');

-- Trưởng/Phó BT (6,8) + Trưởng/Phó PKT (7,9): đủ quyền.
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(6, 'CREATE', 'WORK_ORDER'),
(6, 'UPDATE', 'WORK_ORDER'),
(6, 'DELETE', 'WORK_ORDER'),
(7, 'CREATE', 'WORK_ORDER'),
(7, 'UPDATE', 'WORK_ORDER'),
(7, 'DELETE', 'WORK_ORDER'),
(8, 'CREATE', 'WORK_ORDER'),
(8, 'UPDATE', 'WORK_ORDER'),
(8, 'DELETE', 'WORK_ORDER'),
(9, 'CREATE', 'WORK_ORDER'),
(9, 'UPDATE', 'WORK_ORDER'),
(9, 'DELETE', 'WORK_ORDER');
