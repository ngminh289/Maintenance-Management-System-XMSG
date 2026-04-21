-- 056_rbac_pkt_dam_asset_checklist_schedule.sql
-- PKT (7,9) ngang CV KTS (2) trên tài sản + mẫu checklist + tạo/gửi lịch bảo trì; chỉ PKT duyệt/xóa tài nguyên số (DAM).
-- Tuyến bảo trì (3,6,8): ASSET + CHECKLIST_TEMPLATE chỉ READ; không tạo/sửa/gửi lịch — vẫn APPROVE lịch (6,8).
-- CV KTS giữ CRUD/SUBMIT DAM; PKT đồng quyền soạn DAM như KTS — bổ sung 057 (APPROVE/DELETE thêm cho PKT).
-- Liên quan: digitalAsset.routes (force DELETE), digitalAsset.service (chủ sở hữu bản nháp), client/utils/rbac.js.

USE warehouse_maintenance;

-- ── 1) Tài sản: bảo trì chỉ đọc ───────────────────────────────────────────
DELETE FROM Roles_Permissions
WHERE PositionID IN (3, 6, 8)
  AND ResourceType = 'ASSET'
  AND PermissionName IN ('CREATE', 'UPDATE', 'DELETE');

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(3, 'READ', 'ASSET'),
(6, 'READ', 'ASSET'),
(8, 'READ', 'ASSET');

-- CV KTS + Trưởng/Phó PKT: CUR (không DELETE — giữ như baseline NV KT)
-- PKT: CUR tài sản (không DELETE — bỏ hẳn nếu lỡ clone từ tuyến bảo trì)
DELETE FROM Roles_Permissions
WHERE PositionID IN (7, 9)
  AND ResourceType = 'ASSET'
  AND PermissionName = 'DELETE';

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(2, 'CREATE', 'ASSET'),
(7, 'CREATE', 'ASSET'),
(7, 'READ', 'ASSET'),
(7, 'UPDATE', 'ASSET'),
(9, 'CREATE', 'ASSET'),
(9, 'READ', 'ASSET'),
(9, 'UPDATE', 'ASSET');

-- ── 2) Mẫu checklist: bảo trì chỉ đọc ─────────────────────────────────────
DELETE FROM Roles_Permissions
WHERE PositionID IN (3, 6, 8)
  AND ResourceType = 'CHECKLIST_TEMPLATE'
  AND PermissionName IN ('CREATE', 'UPDATE', 'DELETE', 'APPROVE');

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(3, 'READ', 'CHECKLIST_TEMPLATE'),
(6, 'READ', 'CHECKLIST_TEMPLATE'),
(8, 'READ', 'CHECKLIST_TEMPLATE');

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(2, 'DELETE', 'CHECKLIST_TEMPLATE'),
(7, 'CREATE', 'CHECKLIST_TEMPLATE'),
(7, 'READ', 'CHECKLIST_TEMPLATE'),
(7, 'UPDATE', 'CHECKLIST_TEMPLATE'),
(7, 'DELETE', 'CHECKLIST_TEMPLATE'),
(9, 'CREATE', 'CHECKLIST_TEMPLATE'),
(9, 'READ', 'CHECKLIST_TEMPLATE'),
(9, 'UPDATE', 'CHECKLIST_TEMPLATE'),
(9, 'DELETE', 'CHECKLIST_TEMPLATE');

-- ── 3) Lịch bảo trì: chỉ 2,7,9 lập / sửa / gửi; 3,6,8 đọc + duyệt (6,8) ───
DELETE FROM Roles_Permissions
WHERE PositionID IN (3, 6, 8)
  AND ResourceType = 'MAINTENANCE_PLAN'
  AND PermissionName IN ('CREATE', 'UPDATE', 'SUBMIT', 'DELETE');

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(3, 'READ', 'MAINTENANCE_PLAN'),
(6, 'READ', 'MAINTENANCE_PLAN'),
(8, 'READ', 'MAINTENANCE_PLAN');

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(2, 'DELETE', 'MAINTENANCE_PLAN'),
(7, 'CREATE', 'MAINTENANCE_PLAN'),
(7, 'READ', 'MAINTENANCE_PLAN'),
(7, 'UPDATE', 'MAINTENANCE_PLAN'),
(7, 'SUBMIT', 'MAINTENANCE_PLAN'),
(7, 'DELETE', 'MAINTENANCE_PLAN'),
(9, 'CREATE', 'MAINTENANCE_PLAN'),
(9, 'READ', 'MAINTENANCE_PLAN'),
(9, 'UPDATE', 'MAINTENANCE_PLAN'),
(9, 'SUBMIT', 'MAINTENANCE_PLAN'),
(9, 'DELETE', 'MAINTENANCE_PLAN');

-- ── 4) Tài nguyên số + tag PKT: xem migration 057 (đồng bộ đầy đủ như CV KTS) ──
INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(7, 'DELETE', 'DIGITAL_ASSET'),
(9, 'DELETE', 'DIGITAL_ASSET');

-- Phân loại tài liệu: cùng quyền quản trị danh mục với CV KTS
INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(7, 'CREATE', 'DOCUMENT_CATEGORY'),
(7, 'READ', 'DOCUMENT_CATEGORY'),
(7, 'UPDATE', 'DOCUMENT_CATEGORY'),
(7, 'DELETE', 'DOCUMENT_CATEGORY'),
(9, 'CREATE', 'DOCUMENT_CATEGORY'),
(9, 'READ', 'DOCUMENT_CATEGORY'),
(9, 'UPDATE', 'DOCUMENT_CATEGORY'),
(9, 'DELETE', 'DOCUMENT_CATEGORY');

-- Admin: hỗ trợ vận hành — duyệt/lưu trữ + xóa cứng DAM (route requirePermission)
INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(4, 'APPROVE', 'DIGITAL_ASSET'),
(4, 'DELETE', 'DIGITAL_ASSET');
