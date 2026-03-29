-- 011_extend_resource_types.sql
-- Mở rộng ENUM ResourceType trong Roles_Permissions để hỗ trợ đầy đủ các resource.
-- Schema gốc chỉ có: ASSET, DIGITAL_ASSET, WORK_ORDER, MAINTENANCE_PLAN, EMPLOYEE, INVENTORY
-- Thiếu: CHECKLIST_TEMPLATE, CHECKLIST_RESULT, RUNTIME_LOG, TAG, WORKFLOW, REPORT
-- Migration này cũng xóa sạch data cũ (bị truncated do enum thiếu) và insert lại đúng.
USE warehouse_maintenance;

-- 1. Mở rộng ENUM
ALTER TABLE Roles_Permissions
  MODIFY COLUMN ResourceType ENUM(
    'ASSET', 'DIGITAL_ASSET', 'WORK_ORDER', 'MAINTENANCE_PLAN',
    'CHECKLIST_TEMPLATE', 'CHECKLIST_RESULT', 'RUNTIME_LOG',
    'EMPLOYEE', 'TAG', 'WORKFLOW', 'REPORT', 'INVENTORY'
  ) NOT NULL;

-- 2. Xóa sạch data cũ (bao gồm các row bị truncate thành empty string từ migration 008/010)
DELETE FROM Roles_Permissions;

-- ===========================================================================
-- KTV — Kỹ thuật viên (Level 1)
-- ===========================================================================
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT p.PositionID, t.perm, t.res FROM Positions p,
  (SELECT 'READ'   AS perm, 'ASSET'              AS res UNION ALL
   SELECT 'READ',            'WORK_ORDER'         UNION ALL
   SELECT 'CREATE',          'WORK_ORDER'         UNION ALL
   SELECT 'UPDATE',          'WORK_ORDER'         UNION ALL
   SELECT 'READ',            'DIGITAL_ASSET'      UNION ALL
   SELECT 'READ',            'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'READ',            'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'CREATE',          'CHECKLIST_RESULT'   UNION ALL
   SELECT 'READ',            'CHECKLIST_RESULT'   UNION ALL
   SELECT 'CREATE',          'RUNTIME_LOG'        UNION ALL
   SELECT 'READ',            'RUNTIME_LOG') t
WHERE p.PositionName = 'Kỹ thuật viên';

-- ===========================================================================
-- Công nhân vận hành (Level 1)
-- ===========================================================================
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT p.PositionID, t.perm, t.res FROM Positions p,
  (SELECT 'READ'   AS perm, 'ASSET'              AS res UNION ALL
   SELECT 'READ',            'WORK_ORDER'         UNION ALL
   SELECT 'READ',            'DIGITAL_ASSET'      UNION ALL
   SELECT 'READ',            'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'READ',            'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'CREATE',          'CHECKLIST_RESULT'   UNION ALL
   SELECT 'READ',            'CHECKLIST_RESULT'   UNION ALL
   SELECT 'CREATE',          'RUNTIME_LOG'        UNION ALL
   SELECT 'READ',            'RUNTIME_LOG') t
WHERE p.PositionName = 'Công nhân vận hành';

-- ===========================================================================
-- CVKTS — Chuyên viên kỹ thuật số (Level 1)
-- ===========================================================================
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT p.PositionID, t.perm, t.res FROM Positions p,
  (SELECT 'READ'   AS perm, 'ASSET'              AS res UNION ALL
   SELECT 'READ',            'WORK_ORDER'         UNION ALL
   SELECT 'CREATE',          'DIGITAL_ASSET'      UNION ALL
   SELECT 'READ',            'DIGITAL_ASSET'      UNION ALL
   SELECT 'UPDATE',          'DIGITAL_ASSET'      UNION ALL
   SELECT 'CREATE',          'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'READ',            'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'UPDATE',          'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'CREATE',          'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'READ',            'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'UPDATE',          'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'READ',            'CHECKLIST_RESULT'   UNION ALL
   SELECT 'READ',            'RUNTIME_LOG'        UNION ALL
   SELECT 'CREATE',          'TAG'                UNION ALL
   SELECT 'READ',            'TAG'                UNION ALL
   SELECT 'UPDATE',          'TAG'                UNION ALL
   SELECT 'READ',            'REPORT') t
WHERE p.PositionName = 'Chuyên viên kỹ thuật số';

-- ===========================================================================
-- Trưởng ca bảo trì (Level 2)
-- ===========================================================================
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT p.PositionID, t.perm, t.res FROM Positions p,
  (SELECT 'CREATE' AS perm, 'ASSET'              AS res UNION ALL
   SELECT 'READ',            'ASSET'              UNION ALL
   SELECT 'UPDATE',          'ASSET'              UNION ALL
   SELECT 'CREATE',          'WORK_ORDER'         UNION ALL
   SELECT 'READ',            'WORK_ORDER'         UNION ALL
   SELECT 'UPDATE',          'WORK_ORDER'         UNION ALL
   SELECT 'APPROVE',         'WORK_ORDER'         UNION ALL
   SELECT 'READ',            'DIGITAL_ASSET'      UNION ALL
   SELECT 'APPROVE',         'DIGITAL_ASSET'      UNION ALL
   SELECT 'CREATE',          'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'READ',            'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'UPDATE',          'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'APPROVE',         'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'CREATE',          'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'READ',            'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'UPDATE',          'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'APPROVE',         'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'CREATE',          'CHECKLIST_RESULT'   UNION ALL
   SELECT 'READ',            'CHECKLIST_RESULT'   UNION ALL
   SELECT 'UPDATE',          'CHECKLIST_RESULT'   UNION ALL
   SELECT 'READ',            'RUNTIME_LOG'        UNION ALL
   SELECT 'READ',            'EMPLOYEE'           UNION ALL
   SELECT 'CREATE',          'TAG'                UNION ALL
   SELECT 'READ',            'TAG'                UNION ALL
   SELECT 'UPDATE',          'TAG'                UNION ALL
   SELECT 'READ',            'REPORT') t
WHERE p.PositionName = 'Trưởng ca bảo trì';

-- ===========================================================================
-- Trưởng phòng cơ điện (Level 2)
-- ===========================================================================
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT p.PositionID, t.perm, t.res FROM Positions p,
  (SELECT 'CREATE' AS perm, 'ASSET'              AS res UNION ALL
   SELECT 'READ',            'ASSET'              UNION ALL
   SELECT 'UPDATE',          'ASSET'              UNION ALL
   SELECT 'DELETE',          'ASSET'              UNION ALL
   SELECT 'CREATE',          'WORK_ORDER'         UNION ALL
   SELECT 'READ',            'WORK_ORDER'         UNION ALL
   SELECT 'UPDATE',          'WORK_ORDER'         UNION ALL
   SELECT 'APPROVE',         'WORK_ORDER'         UNION ALL
   SELECT 'DELETE',          'WORK_ORDER'         UNION ALL
   SELECT 'CREATE',          'DIGITAL_ASSET'      UNION ALL
   SELECT 'READ',            'DIGITAL_ASSET'      UNION ALL
   SELECT 'UPDATE',          'DIGITAL_ASSET'      UNION ALL
   SELECT 'APPROVE',         'DIGITAL_ASSET'      UNION ALL
   SELECT 'DELETE',          'DIGITAL_ASSET'      UNION ALL
   SELECT 'CREATE',          'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'READ',            'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'UPDATE',          'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'APPROVE',         'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'DELETE',          'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'CREATE',          'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'READ',            'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'UPDATE',          'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'APPROVE',         'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'DELETE',          'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'CREATE',          'CHECKLIST_RESULT'   UNION ALL
   SELECT 'READ',            'CHECKLIST_RESULT'   UNION ALL
   SELECT 'UPDATE',          'CHECKLIST_RESULT'   UNION ALL
   SELECT 'CREATE',          'RUNTIME_LOG'        UNION ALL
   SELECT 'READ',            'RUNTIME_LOG'        UNION ALL
   SELECT 'UPDATE',          'RUNTIME_LOG'        UNION ALL
   SELECT 'CREATE',          'EMPLOYEE'           UNION ALL
   SELECT 'READ',            'EMPLOYEE'           UNION ALL
   SELECT 'UPDATE',          'EMPLOYEE'           UNION ALL
   SELECT 'CREATE',          'TAG'                UNION ALL
   SELECT 'READ',            'TAG'                UNION ALL
   SELECT 'UPDATE',          'TAG'                UNION ALL
   SELECT 'READ',            'REPORT'             UNION ALL
   SELECT 'EXPORT',          'REPORT') t
WHERE p.PositionName = 'Trưởng phòng cơ điện';

-- ===========================================================================
-- Quản trị hệ thống (Level 3) — IT Admin
-- ===========================================================================
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT p.PositionID, t.perm, t.res FROM Positions p,
  (SELECT 'CREATE' AS perm, 'ASSET'              AS res UNION ALL
   SELECT 'READ',            'ASSET'              UNION ALL
   SELECT 'UPDATE',          'ASSET'              UNION ALL
   SELECT 'DELETE',          'ASSET'              UNION ALL
   SELECT 'READ',            'WORK_ORDER'         UNION ALL
   SELECT 'READ',            'DIGITAL_ASSET'      UNION ALL
   SELECT 'READ',            'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'READ',            'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'READ',            'CHECKLIST_RESULT'   UNION ALL
   SELECT 'READ',            'RUNTIME_LOG'        UNION ALL
   SELECT 'CREATE',          'EMPLOYEE'           UNION ALL
   SELECT 'READ',            'EMPLOYEE'           UNION ALL
   SELECT 'UPDATE',          'EMPLOYEE'           UNION ALL
   SELECT 'DELETE',          'EMPLOYEE'           UNION ALL
   SELECT 'EXPORT',          'EMPLOYEE'           UNION ALL
   SELECT 'CREATE',          'WORKFLOW'           UNION ALL
   SELECT 'READ',            'WORKFLOW'           UNION ALL
   SELECT 'UPDATE',          'WORKFLOW'           UNION ALL
   SELECT 'DELETE',          'WORKFLOW'           UNION ALL
   SELECT 'CREATE',          'TAG'                UNION ALL
   SELECT 'READ',            'TAG'                UNION ALL
   SELECT 'UPDATE',          'TAG'                UNION ALL
   SELECT 'DELETE',          'TAG'                UNION ALL
   SELECT 'READ',            'REPORT') t
WHERE p.PositionName = 'Quản trị hệ thống';

-- ===========================================================================
-- Ban Giám đốc (Level 3) — Executive
-- ===========================================================================
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT p.PositionID, t.perm, t.res FROM Positions p,
  (SELECT 'READ'   AS perm, 'ASSET'              AS res UNION ALL
   SELECT 'READ',            'WORK_ORDER'         UNION ALL
   SELECT 'READ',            'DIGITAL_ASSET'      UNION ALL
   SELECT 'READ',            'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'READ',            'CHECKLIST_RESULT'   UNION ALL
   SELECT 'READ',            'RUNTIME_LOG'        UNION ALL
   SELECT 'READ',            'EMPLOYEE'           UNION ALL
   SELECT 'READ',            'TAG'                UNION ALL
   SELECT 'READ',            'REPORT'             UNION ALL
   SELECT 'EXPORT',          'REPORT') t
WHERE p.PositionName = 'Ban Giám đốc';
