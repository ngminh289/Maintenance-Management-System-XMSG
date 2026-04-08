-- migrations/026_bfd5_checklist_roles_sync.sql
-- BFD §5: Đảm bảo Trưởng phòng (6) có cùng quyền checklist với Trưởng ca (3)
-- nếu DB cũ chưa qua bản sao đầy đủ từ 019.

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT 6, rp.PermissionName, rp.ResourceType
FROM Roles_Permissions rp
WHERE rp.PositionID = 3
  AND rp.ResourceType IN ('CHECKLIST_TEMPLATE', 'CHECKLIST_RESULT');
