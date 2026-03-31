-- 015_nvkt_no_wo_approve.sql
-- BFD: NV Kỹ thuật soạn phiếu / cập nhật; duyệt WO thuộc Trưởng ca (Ban GĐ chỉ READ — xem 016).
USE warehouse_maintenance;

DELETE FROM Roles_Permissions
WHERE PositionID = 2 AND ResourceType = 'WORK_ORDER' AND PermissionName = 'APPROVE';
