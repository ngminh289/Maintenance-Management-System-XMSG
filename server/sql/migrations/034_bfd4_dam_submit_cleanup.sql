-- 034_bfd4_dam_submit_cleanup.sql
-- BFD §4 — Phê duyệt tài liệu số (DAM):
--   Chuyên viên / NV Kỹ thuật (Position 2) gửi duyệt (SUBMIT).
--   Quản trị viên (4) chỉ READ kho tài liệu — gỡ SUBMIT DIGITAL_ASSET nếu còn sót từ migration 017.
--   Đảm bảo Position 2 luôn có SUBMIT DIGITAL_ASSET (INSERT IGNORE an toàn khi chạy lặp).
USE warehouse_maintenance;

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(2, 'SUBMIT', 'DIGITAL_ASSET');

DELETE FROM Roles_Permissions
WHERE PositionID = 4
  AND PermissionName = 'SUBMIT'
  AND ResourceType = 'DIGITAL_ASSET';
