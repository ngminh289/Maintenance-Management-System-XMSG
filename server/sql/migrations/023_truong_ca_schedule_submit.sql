-- 023_truong_ca_schedule_submit.sql — Trưởng ca (Position 3) gửi lịch bảo trì nháp vào phê duyệt (MAINTENANCE_PLAN:SUBMIT).
-- Trước đây chỉ NVKT (2) + Admin (4) có SUBMIT; TC có CREATE/UPDATE nhưng không thấy nút Gửi trên UI.
USE warehouse_maintenance;

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
  (3, 'SUBMIT', 'MAINTENANCE_PLAN');
