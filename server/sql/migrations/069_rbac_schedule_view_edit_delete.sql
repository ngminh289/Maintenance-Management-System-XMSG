-- 069_rbac_schedule_view_edit_delete.sql
-- Đồng bộ phân quyền MAINTENANCE_PLAN với pattern Xem/Sửa/Xoá theo nghiệp vụ:
--   QTV (4)             : đủ quyền
--   Trưởng/Phó BT (6,8) : đủ quyền (CREATE/UPDATE/SUBMIT/DELETE; APPROVE đã có ở mig 056)
--   CV KTS (2)          : CREATE/UPDATE/SUBMIT/DELETE — service kiểm tra status để chỉ
--                         cho thao tác trước khi phê duyệt (DRAFT/REJECTED).
--   Trưởng ca (3)       : READ + UPDATE — service mở UPDATE post-approval cho TC.
--   KTV HT (1), BGĐ (5) : chỉ READ.
--   PKT (7,9)           : đủ quyền (cũ ở mig 056); migration 069 reaffirm.
-- Liên quan: server/services/maintenanceSchedule.service.js (kiểm tra role + status),
--           client/utils/rbac.js (phân biệt TC vs TP qua canDo).

USE warehouse_maintenance;

-- ── Reset CRUD MAINTENANCE_PLAN để áp lại nhất quán (giữ APPROVE riêng) ─────
DELETE FROM Roles_Permissions
WHERE ResourceType = 'MAINTENANCE_PLAN'
  AND PermissionName IN ('CREATE', 'READ', 'UPDATE', 'SUBMIT', 'DELETE');

-- ── READ: tất cả role 1..9 đều xem được ─────────────────────────────────────
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(1, 'READ',   'MAINTENANCE_PLAN'),
(2, 'READ',   'MAINTENANCE_PLAN'),
(3, 'READ',   'MAINTENANCE_PLAN'),
(4, 'READ',   'MAINTENANCE_PLAN'),
(5, 'READ',   'MAINTENANCE_PLAN'),
(6, 'READ',   'MAINTENANCE_PLAN'),
(7, 'READ',   'MAINTENANCE_PLAN'),
(8, 'READ',   'MAINTENANCE_PLAN'),
(9, 'READ',   'MAINTENANCE_PLAN');

-- ── Trưởng ca (3): chỉ thêm UPDATE — service kiểm tra status post-approval ──
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(3, 'UPDATE', 'MAINTENANCE_PLAN');

-- ── CV KTS (2): CRUD + SUBMIT — service chặn nếu status đã rời DRAFT/REJECTED ──
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(2, 'CREATE', 'MAINTENANCE_PLAN'),
(2, 'UPDATE', 'MAINTENANCE_PLAN'),
(2, 'SUBMIT', 'MAINTENANCE_PLAN'),
(2, 'DELETE', 'MAINTENANCE_PLAN');

-- ── QTV (4): đủ quyền (READ đã có ở trên) ───────────────────────────────────
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(4, 'CREATE', 'MAINTENANCE_PLAN'),
(4, 'UPDATE', 'MAINTENANCE_PLAN'),
(4, 'SUBMIT', 'MAINTENANCE_PLAN'),
(4, 'DELETE', 'MAINTENANCE_PLAN');

-- ── Trưởng/Phó BT (6,8) + Trưởng/Phó PKT (7,9): đủ quyền ────────────────────
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(6, 'CREATE', 'MAINTENANCE_PLAN'),
(6, 'UPDATE', 'MAINTENANCE_PLAN'),
(6, 'SUBMIT', 'MAINTENANCE_PLAN'),
(6, 'DELETE', 'MAINTENANCE_PLAN'),
(7, 'CREATE', 'MAINTENANCE_PLAN'),
(7, 'UPDATE', 'MAINTENANCE_PLAN'),
(7, 'SUBMIT', 'MAINTENANCE_PLAN'),
(7, 'DELETE', 'MAINTENANCE_PLAN'),
(8, 'CREATE', 'MAINTENANCE_PLAN'),
(8, 'UPDATE', 'MAINTENANCE_PLAN'),
(8, 'SUBMIT', 'MAINTENANCE_PLAN'),
(8, 'DELETE', 'MAINTENANCE_PLAN'),
(9, 'CREATE', 'MAINTENANCE_PLAN'),
(9, 'UPDATE', 'MAINTENANCE_PLAN'),
(9, 'SUBMIT', 'MAINTENANCE_PLAN'),
(9, 'DELETE', 'MAINTENANCE_PLAN');
