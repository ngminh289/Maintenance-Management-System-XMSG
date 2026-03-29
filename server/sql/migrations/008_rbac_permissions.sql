-- 008_rbac_permissions.sql
-- Xây dựng lại ma trận phân quyền theo RBAC (USER,RBAC.html).
-- Thay đổi:
--   1. "Trưởng phòng cơ điện" Level 3 → Level 2 (vai trò vận hành, không phải admin)
--   2. Xóa toàn bộ Roles_Permissions cũ, chèn lại đúng theo thiết kế
-- ResourceType chuẩn: ASSET | WORK_ORDER | DIGITAL_ASSET | MAINTENANCE_PLAN
--                     CHECKLIST_TEMPLATE | CHECKLIST_RESULT | RUNTIME_LOG
--                     EMPLOYEE | TAG | WORKFLOW | REPORT
USE warehouse_maintenance;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Sửa Level "Trưởng phòng cơ điện" 3 → 2 (vận hành, không phải admin)
-- ──────────────────────────────────────────────────────────────────────────────
UPDATE Positions SET Level = 2 WHERE PositionName = 'Trưởng phòng cơ điện';

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Xóa sạch phân quyền cũ
-- ──────────────────────────────────────────────────────────────────────────────
DELETE FROM Roles_Permissions;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Chèn lại theo RBAC (dùng subquery tránh hardcode ID)
-- ──────────────────────────────────────────────────────────────────────────────

-- === Kỹ thuật viên (Level 1) — Chuyên viên văn phòng / soạn thảo ===
-- Hồ sơ: tạo tài liệu, kế hoạch bảo trì, WO; đọc tài sản
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT PositionID, p.perm, p.res FROM Positions,
  (SELECT 'READ'   AS perm, 'ASSET'               AS res UNION ALL
   SELECT 'UPDATE',          'ASSET'               UNION ALL
   SELECT 'CREATE',          'WORK_ORDER'          UNION ALL
   SELECT 'READ',            'WORK_ORDER'          UNION ALL
   SELECT 'UPDATE',          'WORK_ORDER'          UNION ALL
   SELECT 'APPROVE',         'WORK_ORDER'          UNION ALL
   SELECT 'CREATE',          'DIGITAL_ASSET'       UNION ALL
   SELECT 'READ',            'DIGITAL_ASSET'       UNION ALL
   SELECT 'UPDATE',          'DIGITAL_ASSET'       UNION ALL
   SELECT 'CREATE',          'MAINTENANCE_PLAN'    UNION ALL
   SELECT 'READ',            'MAINTENANCE_PLAN'    UNION ALL
   SELECT 'UPDATE',          'MAINTENANCE_PLAN'    UNION ALL
   SELECT 'CREATE',          'CHECKLIST_TEMPLATE'  UNION ALL
   SELECT 'READ',            'CHECKLIST_TEMPLATE'  UNION ALL
   SELECT 'UPDATE',          'CHECKLIST_TEMPLATE'  UNION ALL
   SELECT 'READ',            'CHECKLIST_RESULT'    UNION ALL
   SELECT 'READ',            'RUNTIME_LOG'         UNION ALL
   SELECT 'READ',            'EMPLOYEE'            UNION ALL
   SELECT 'CREATE',          'TAG'                 UNION ALL
   SELECT 'READ',            'TAG'                 UNION ALL
   SELECT 'UPDATE',          'TAG'                 UNION ALL
   SELECT 'READ',            'REPORT') p
WHERE PositionName = 'Kỹ thuật viên';

-- === Chuyên viên kỹ thuật số (Level 1) — cùng profile Kỹ thuật viên ===
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT PositionID, p.perm, p.res FROM Positions,
  (SELECT 'READ'   AS perm, 'ASSET'               AS res UNION ALL
   SELECT 'UPDATE',          'ASSET'               UNION ALL
   SELECT 'CREATE',          'WORK_ORDER'          UNION ALL
   SELECT 'READ',            'WORK_ORDER'          UNION ALL
   SELECT 'UPDATE',          'WORK_ORDER'          UNION ALL
   SELECT 'APPROVE',         'WORK_ORDER'          UNION ALL
   SELECT 'CREATE',          'DIGITAL_ASSET'       UNION ALL
   SELECT 'READ',            'DIGITAL_ASSET'       UNION ALL
   SELECT 'UPDATE',          'DIGITAL_ASSET'       UNION ALL
   SELECT 'CREATE',          'MAINTENANCE_PLAN'    UNION ALL
   SELECT 'READ',            'MAINTENANCE_PLAN'    UNION ALL
   SELECT 'UPDATE',          'MAINTENANCE_PLAN'    UNION ALL
   SELECT 'CREATE',          'CHECKLIST_TEMPLATE'  UNION ALL
   SELECT 'READ',            'CHECKLIST_TEMPLATE'  UNION ALL
   SELECT 'UPDATE',          'CHECKLIST_TEMPLATE'  UNION ALL
   SELECT 'READ',            'CHECKLIST_RESULT'    UNION ALL
   SELECT 'READ',            'RUNTIME_LOG'         UNION ALL
   SELECT 'READ',            'EMPLOYEE'            UNION ALL
   SELECT 'CREATE',          'TAG'                 UNION ALL
   SELECT 'READ',            'TAG'                 UNION ALL
   SELECT 'UPDATE',          'TAG'                 UNION ALL
   SELECT 'READ',            'REPORT') p
WHERE PositionName = 'Chuyên viên kỹ thuật số';

-- === Công nhân vận hành (Level 1) — hiện trường / checklist / runtime ===
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT PositionID, p.perm, p.res FROM Positions,
  (SELECT 'READ'   AS perm, 'ASSET'               AS res UNION ALL
   SELECT 'READ',            'WORK_ORDER'          UNION ALL
   SELECT 'UPDATE',          'WORK_ORDER'          UNION ALL
   SELECT 'READ',            'DIGITAL_ASSET'       UNION ALL
   SELECT 'READ',            'MAINTENANCE_PLAN'    UNION ALL
   SELECT 'READ',            'CHECKLIST_TEMPLATE'  UNION ALL
   SELECT 'CREATE',          'CHECKLIST_RESULT'    UNION ALL
   SELECT 'READ',            'CHECKLIST_RESULT'    UNION ALL
   SELECT 'UPDATE',          'CHECKLIST_RESULT'    UNION ALL
   SELECT 'CREATE',          'RUNTIME_LOG'         UNION ALL
   SELECT 'READ',            'RUNTIME_LOG'         UNION ALL
   SELECT 'UPDATE',          'RUNTIME_LOG') p
WHERE PositionName = 'Công nhân vận hành';

-- === Trưởng ca bảo trì (Level 2) — Bộ phận Điều hành & Phê duyệt ===
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT PositionID, p.perm, p.res FROM Positions,
  (SELECT 'CREATE' AS perm, 'ASSET'               AS res UNION ALL
   SELECT 'READ',            'ASSET'               UNION ALL
   SELECT 'UPDATE',          'ASSET'               UNION ALL
   SELECT 'CREATE',          'WORK_ORDER'          UNION ALL
   SELECT 'READ',            'WORK_ORDER'          UNION ALL
   SELECT 'UPDATE',          'WORK_ORDER'          UNION ALL
   SELECT 'APPROVE',         'WORK_ORDER'          UNION ALL
   SELECT 'READ',            'DIGITAL_ASSET'       UNION ALL
   SELECT 'APPROVE',         'DIGITAL_ASSET'       UNION ALL
   SELECT 'CREATE',          'MAINTENANCE_PLAN'    UNION ALL
   SELECT 'READ',            'MAINTENANCE_PLAN'    UNION ALL
   SELECT 'UPDATE',          'MAINTENANCE_PLAN'    UNION ALL
   SELECT 'APPROVE',         'MAINTENANCE_PLAN'    UNION ALL
   SELECT 'CREATE',          'CHECKLIST_TEMPLATE'  UNION ALL
   SELECT 'READ',            'CHECKLIST_TEMPLATE'  UNION ALL
   SELECT 'UPDATE',          'CHECKLIST_TEMPLATE'  UNION ALL
   SELECT 'APPROVE',         'CHECKLIST_TEMPLATE'  UNION ALL
   SELECT 'CREATE',          'CHECKLIST_RESULT'    UNION ALL
   SELECT 'READ',            'CHECKLIST_RESULT'    UNION ALL
   SELECT 'UPDATE',          'CHECKLIST_RESULT'    UNION ALL
   SELECT 'READ',            'RUNTIME_LOG'         UNION ALL
   SELECT 'READ',            'EMPLOYEE'            UNION ALL
   SELECT 'READ',            'TAG'                 UNION ALL
   SELECT 'READ',            'REPORT') p
WHERE PositionName = 'Trưởng ca bảo trì';

-- === Trưởng phòng cơ điện (Level 2) — cùng profile Trưởng ca nhưng thêm DELETE ===
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT PositionID, p.perm, p.res FROM Positions,
  (SELECT 'CREATE' AS perm, 'ASSET'               AS res UNION ALL
   SELECT 'READ',            'ASSET'               UNION ALL
   SELECT 'UPDATE',          'ASSET'               UNION ALL
   SELECT 'DELETE',          'ASSET'               UNION ALL
   SELECT 'CREATE',          'WORK_ORDER'          UNION ALL
   SELECT 'READ',            'WORK_ORDER'          UNION ALL
   SELECT 'UPDATE',          'WORK_ORDER'          UNION ALL
   SELECT 'APPROVE',         'WORK_ORDER'          UNION ALL
   SELECT 'DELETE',          'WORK_ORDER'          UNION ALL
   SELECT 'READ',            'DIGITAL_ASSET'       UNION ALL
   SELECT 'APPROVE',         'DIGITAL_ASSET'       UNION ALL
   SELECT 'CREATE',          'MAINTENANCE_PLAN'    UNION ALL
   SELECT 'READ',            'MAINTENANCE_PLAN'    UNION ALL
   SELECT 'UPDATE',          'MAINTENANCE_PLAN'    UNION ALL
   SELECT 'APPROVE',         'MAINTENANCE_PLAN'    UNION ALL
   SELECT 'DELETE',          'MAINTENANCE_PLAN'    UNION ALL
   SELECT 'CREATE',          'CHECKLIST_TEMPLATE'  UNION ALL
   SELECT 'READ',            'CHECKLIST_TEMPLATE'  UNION ALL
   SELECT 'UPDATE',          'CHECKLIST_TEMPLATE'  UNION ALL
   SELECT 'APPROVE',         'CHECKLIST_TEMPLATE'  UNION ALL
   SELECT 'DELETE',          'CHECKLIST_TEMPLATE'  UNION ALL
   SELECT 'CREATE',          'CHECKLIST_RESULT'    UNION ALL
   SELECT 'READ',            'CHECKLIST_RESULT'    UNION ALL
   SELECT 'UPDATE',          'CHECKLIST_RESULT'    UNION ALL
   SELECT 'READ',            'RUNTIME_LOG'         UNION ALL
   SELECT 'CREATE',          'EMPLOYEE'            UNION ALL
   SELECT 'READ',            'EMPLOYEE'            UNION ALL
   SELECT 'UPDATE',          'EMPLOYEE'            UNION ALL
   SELECT 'READ',            'TAG'                 UNION ALL
   SELECT 'READ',            'REPORT'              UNION ALL
   SELECT 'EXPORT',          'REPORT') p
WHERE PositionName = 'Trưởng phòng cơ điện';

-- === Quản trị hệ thống (Level 3) — IT Admin, hạn chế vận hành ===
-- Chỉ quản lý hệ thống: nhân viên, workflow, tags; READ hoặc A/D trên operational data
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT PositionID, p.perm, p.res FROM Positions,
  (SELECT 'CREATE' AS perm, 'ASSET'               AS res UNION ALL
   SELECT 'READ',            'ASSET'               UNION ALL
   SELECT 'UPDATE',          'ASSET'               UNION ALL
   SELECT 'DELETE',          'ASSET'               UNION ALL
   SELECT 'READ',            'WORK_ORDER'          UNION ALL
   SELECT 'APPROVE',         'WORK_ORDER'          UNION ALL
   SELECT 'DELETE',          'WORK_ORDER'          UNION ALL
   SELECT 'READ',            'DIGITAL_ASSET'       UNION ALL
   SELECT 'READ',            'MAINTENANCE_PLAN'    UNION ALL
   SELECT 'READ',            'CHECKLIST_TEMPLATE'  UNION ALL
   SELECT 'READ',            'CHECKLIST_RESULT'    UNION ALL
   SELECT 'READ',            'RUNTIME_LOG'         UNION ALL
   SELECT 'CREATE',          'EMPLOYEE'            UNION ALL
   SELECT 'READ',            'EMPLOYEE'            UNION ALL
   SELECT 'UPDATE',          'EMPLOYEE'            UNION ALL
   SELECT 'DELETE',          'EMPLOYEE'            UNION ALL
   SELECT 'EXPORT',          'EMPLOYEE'            UNION ALL
   SELECT 'READ',            'TAG'                 UNION ALL
   SELECT 'UPDATE',          'TAG'                 UNION ALL
   SELECT 'CREATE',          'WORKFLOW'            UNION ALL
   SELECT 'READ',            'WORKFLOW'            UNION ALL
   SELECT 'UPDATE',          'WORKFLOW'            UNION ALL
   SELECT 'READ',            'REPORT') p
WHERE PositionName = 'Quản trị hệ thống';

-- === Ban Giám đốc (Level 3) — Executive, chủ yếu Read Full ===
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT PositionID, p.perm, p.res FROM Positions,
  (SELECT 'READ'   AS perm, 'ASSET'               AS res UNION ALL
   SELECT 'READ',            'WORK_ORDER'          UNION ALL
   SELECT 'APPROVE',         'WORK_ORDER'          UNION ALL
   SELECT 'DELETE',          'WORK_ORDER'          UNION ALL
   SELECT 'READ',            'DIGITAL_ASSET'       UNION ALL
   SELECT 'READ',            'MAINTENANCE_PLAN'    UNION ALL
   SELECT 'READ',            'RUNTIME_LOG'         UNION ALL
   SELECT 'READ',            'EMPLOYEE'            UNION ALL
   SELECT 'READ',            'TAG'                 UNION ALL
   SELECT 'READ',            'REPORT'              UNION ALL
   SELECT 'EXPORT',          'REPORT') p
WHERE PositionName = 'Ban Giám đốc';
