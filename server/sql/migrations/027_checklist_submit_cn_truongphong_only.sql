-- migrations/027_checklist_submit_cn_truongphong_only.sql
-- Chỉ Công nhân (1) và Trưởng phòng (6) nộp kết quả checklist quét QR; Trưởng ca (3) không CREATE.

DELETE FROM Roles_Permissions
WHERE PositionID = 3
  AND ResourceType = 'CHECKLIST_RESULT'
  AND PermissionName = 'CREATE';
