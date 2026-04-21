-- 057_rbac_pkt_same_as_kts_dam.sql
-- Trưởng/Phó PKT (7, 9) = cùng quyền tài nguyên số / tag như CV KTS (2); khác biệt duyệt+lưu trữ+xóa cứng đã có sẵn (APPROVE, DELETE DIGITAL_ASSET).
-- Sửa lệch sau 056 (đã gỡ CREATE/UPDATE/SUBMIT DAM và TAG C/U/D trên 7,9).
-- Liên quan: client/utils/rbac.js, digitalAsset.service.js (vẫn ràng buộc chủ sở hữu bản nháp).

USE warehouse_maintenance;

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(7, 'CREATE', 'DIGITAL_ASSET'),
(7, 'READ', 'DIGITAL_ASSET'),
(7, 'UPDATE', 'DIGITAL_ASSET'),
(7, 'SUBMIT', 'DIGITAL_ASSET'),
(9, 'CREATE', 'DIGITAL_ASSET'),
(9, 'READ', 'DIGITAL_ASSET'),
(9, 'UPDATE', 'DIGITAL_ASSET'),
(9, 'SUBMIT', 'DIGITAL_ASSET');

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(7, 'CREATE', 'TAG'),
(7, 'READ', 'TAG'),
(7, 'UPDATE', 'TAG'),
(7, 'DELETE', 'TAG'),
(9, 'CREATE', 'TAG'),
(9, 'READ', 'TAG'),
(9, 'UPDATE', 'TAG'),
(9, 'DELETE', 'TAG');

-- Phản hồi tài liệu: giống CV KTS (READ + UPDATE inbox), không CREATE góp ý
DELETE FROM Roles_Permissions
WHERE PositionID IN (7, 9)
  AND ResourceType = 'DOCUMENT_FEEDBACK'
  AND PermissionName = 'CREATE';

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(7, 'READ', 'DOCUMENT_FEEDBACK'),
(7, 'UPDATE', 'DOCUMENT_FEEDBACK'),
(9, 'READ', 'DOCUMENT_FEEDBACK'),
(9, 'UPDATE', 'DOCUMENT_FEEDBACK');
