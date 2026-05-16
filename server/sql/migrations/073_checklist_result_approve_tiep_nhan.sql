-- 073_checklist_result_approve_tiep_nhan.sql
-- Tiếp nhận checklist = CHECKLIST_RESULT:APPROVE (menu + thông báo).
-- DB cũ chỉ có UPDATE cho TC/TP — sao chép sang APPROVE; Trưởng phòng (6) đồng bộ từ Trưởng ca (3).

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT rp.PositionID, 'APPROVE', 'CHECKLIST_RESULT'
FROM Roles_Permissions rp
WHERE rp.ResourceType = 'CHECKLIST_RESULT'
  AND rp.PermissionName = 'UPDATE'
  AND rp.PositionID IN (3, 6);

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT 6, 'APPROVE', 'CHECKLIST_RESULT'
FROM Roles_Permissions rp
WHERE rp.PositionID = 3
  AND rp.ResourceType = 'CHECKLIST_RESULT'
  AND rp.PermissionName = 'APPROVE'
  AND NOT EXISTS (
    SELECT 1 FROM Roles_Permissions x
    WHERE x.PositionID = 6 AND x.ResourceType = 'CHECKLIST_RESULT' AND x.PermissionName = 'APPROVE'
  );
