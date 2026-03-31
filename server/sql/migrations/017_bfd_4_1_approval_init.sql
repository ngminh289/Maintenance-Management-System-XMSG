-- 017_bfd_4_1_approval_init.sql
-- BFD 4.1 Khởi tạo luồng phê duyệt: NV KT (C) SUBMIT lịch/tài liệu; Trưởng ca không SUBMIT (chỉ duyệt sau);
-- Admin (C/U): SUBMIT + tạo WO + sửa tài liệu; mẫu Workflow chỉ Admin (bỏ CREATE WORKFLOW của NV KT).
USE warehouse_maintenance;

ALTER TABLE Roles_Permissions
MODIFY COLUMN PermissionName ENUM(
  'CREATE','READ','UPDATE','DELETE','APPROVE','EXPORT','SUBMIT'
) NOT NULL;

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(2, 'SUBMIT', 'MAINTENANCE_PLAN'),
(2, 'SUBMIT', 'DIGITAL_ASSET'),
(4, 'SUBMIT', 'MAINTENANCE_PLAN'),
(4, 'SUBMIT', 'DIGITAL_ASSET'),
(4, 'CREATE', 'WORK_ORDER'),
(4, 'UPDATE', 'DIGITAL_ASSET'),
(4, 'DELETE', 'WORKFLOW');

DELETE FROM Roles_Permissions
WHERE PositionID = 2 AND ResourceType = 'WORKFLOW' AND PermissionName = 'CREATE';
