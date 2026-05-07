-- 068_rbac_asset_view_edit_delete.sql
-- Đồng bộ phân quyền ASSET với pattern Xem/Sửa/Xoá chuẩn theo nghiệp vụ:
--   QTV (4)              : đủ quyền (CREATE + UPDATE + DELETE)
--   Trưởng/Phó Bảo trì (6,8) + Trưởng/Phó PKT (7,9): đủ quyền
--   CV KTS (2)           : Xem + Sửa  (chỉ UPDATE; bỏ CREATE/DELETE)
--   Trưởng ca (3), KTV HT (1), BGĐ (5): chỉ xem
-- Liên quan: client/utils/rbac.js, server/routes/asset.routes.js (requirePermission ASSET:*).
-- Lý do: trước đây mig 056 đã thu hẹp tuyến bảo trì (3,6,8) chỉ READ ASSET và mig
-- 013 không cấp DELETE cho admin/PKT — kết quả là không role nào đủ quyền xoá.

USE warehouse_maintenance;

-- ── Reset toàn bộ CREATE/UPDATE/DELETE ASSET để áp lại nhất quán ─────────────
DELETE FROM Roles_Permissions
WHERE ResourceType = 'ASSET'
  AND PermissionName IN ('CREATE', 'UPDATE', 'DELETE');

-- ── Đảm bảo ai cũng READ được ASSET ─────────────────────────────────────────
INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(1, 'READ', 'ASSET'),
(2, 'READ', 'ASSET'),
(3, 'READ', 'ASSET'),
(4, 'READ', 'ASSET'),
(5, 'READ', 'ASSET'),
(6, 'READ', 'ASSET'),
(7, 'READ', 'ASSET'),
(8, 'READ', 'ASSET'),
(9, 'READ', 'ASSET');

-- ── CV KTS (2): chỉ UPDATE (Xem + Sửa) ───────────────────────────────────────
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(2, 'UPDATE', 'ASSET');

-- ── QTV (4) + Trưởng/Phó Bảo trì (6,8) + Trưởng/Phó PKT (7,9): đủ quyền ──────
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(4, 'CREATE', 'ASSET'),
(4, 'UPDATE', 'ASSET'),
(4, 'DELETE', 'ASSET'),
(6, 'CREATE', 'ASSET'),
(6, 'UPDATE', 'ASSET'),
(6, 'DELETE', 'ASSET'),
(7, 'CREATE', 'ASSET'),
(7, 'UPDATE', 'ASSET'),
(7, 'DELETE', 'ASSET'),
(8, 'CREATE', 'ASSET'),
(8, 'UPDATE', 'ASSET'),
(8, 'DELETE', 'ASSET'),
(9, 'CREATE', 'ASSET'),
(9, 'UPDATE', 'ASSET'),
(9, 'DELETE', 'ASSET');
