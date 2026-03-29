-- 010_fix_role_permissions.sql
-- Sửa lại toàn bộ RBAC theo nghiệp vụ thực tế nhà máy bảo trì.
-- Vấn đề trong 008: KTV thiếu CREATE CHECKLIST_RESULT + RUNTIME_LOG
--                   KTV sai khi có APPROVE WORK_ORDER, CREATE MAINTENANCE_PLAN...
-- Ma trận thiết kế lại từ đầu theo đúng công việc thực tế của từng chức vụ.
USE warehouse_maintenance;

-- Xóa sạch để viết lại hoàn toàn
DELETE FROM Roles_Permissions;

-- ===========================================================================
-- KTV — Kỹ thuật viên (Level 1)
-- Công việc thực tế: ra hiện trường, quét QR, điền checklist, ghi giờ chạy,
--   nhận và hoàn thành WO được giao, tạo WO sự cố khi phát hiện hỏng hóc.
-- ===========================================================================
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT p.PositionID, t.perm, t.res
FROM Positions p,
  (SELECT 'READ'   AS perm, 'ASSET'              AS res UNION ALL
   SELECT 'READ',            'WORK_ORDER'         UNION ALL
   SELECT 'CREATE',          'WORK_ORDER'         UNION ALL  -- tạo WO sự cố (CORRECTIVE)
   SELECT 'UPDATE',          'WORK_ORDER'         UNION ALL  -- nhận việc, cập nhật tiến độ, hoàn thành
   SELECT 'READ',            'DIGITAL_ASSET'      UNION ALL  -- đọc SOP, hướng dẫn bảo trì
   SELECT 'READ',            'MAINTENANCE_PLAN'   UNION ALL  -- xem lịch PM sắp tới
   SELECT 'READ',            'CHECKLIST_TEMPLATE' UNION ALL  -- lấy mẫu khi quét QR
   SELECT 'CREATE',          'CHECKLIST_RESULT'   UNION ALL  -- nộp kết quả kiểm tra ← QUAN TRỌNG
   SELECT 'READ',            'CHECKLIST_RESULT'   UNION ALL
   SELECT 'CREATE',          'RUNTIME_LOG'        UNION ALL  -- ghi giờ chạy ← QUAN TRỌNG
   SELECT 'READ',            'RUNTIME_LOG') t
WHERE p.PositionName = 'Kỹ thuật viên';

-- ===========================================================================
-- Công nhân vận hành (Level 1)
-- Công việc: vận hành máy, kiểm tra hàng ngày, ghi giờ chạy.
-- KHÔNG tạo WO (không trách nhiệm sửa chữa).
-- ===========================================================================
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT p.PositionID, t.perm, t.res
FROM Positions p,
  (SELECT 'READ'   AS perm, 'ASSET'              AS res UNION ALL
   SELECT 'READ',            'WORK_ORDER'         UNION ALL  -- xem WO liên quan máy mình vận hành
   SELECT 'READ',            'DIGITAL_ASSET'      UNION ALL  -- đọc hướng dẫn vận hành
   SELECT 'READ',            'MAINTENANCE_PLAN'   UNION ALL  -- biết lịch bảo trì để phối hợp dừng máy
   SELECT 'READ',            'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'CREATE',          'CHECKLIST_RESULT'   UNION ALL  -- kiểm tra hàng ngày
   SELECT 'READ',            'CHECKLIST_RESULT'   UNION ALL
   SELECT 'CREATE',          'RUNTIME_LOG'        UNION ALL  -- ghi giờ vận hành
   SELECT 'READ',            'RUNTIME_LOG') t
WHERE p.PositionName = 'Công nhân vận hành';

-- ===========================================================================
-- CVKTS — Chuyên viên kỹ thuật số (Level 1)
-- Công việc: quản lý tài liệu kỹ thuật số, lập kế hoạch bảo trì,
--   tạo template checklist, quản lý tag phân loại.
-- KHÔNG tạo/duyệt WO (không trực tiếp tham gia sửa chữa).
-- ===========================================================================
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT p.PositionID, t.perm, t.res
FROM Positions p,
  (SELECT 'READ'   AS perm, 'ASSET'              AS res UNION ALL
   SELECT 'READ',            'WORK_ORDER'         UNION ALL  -- theo dõi tiến độ WO
   SELECT 'CREATE',          'DIGITAL_ASSET'      UNION ALL  -- upload tài liệu, SOP
   SELECT 'READ',            'DIGITAL_ASSET'      UNION ALL
   SELECT 'UPDATE',          'DIGITAL_ASSET'      UNION ALL
   SELECT 'CREATE',          'MAINTENANCE_PLAN'   UNION ALL  -- lập kế hoạch PM
   SELECT 'READ',            'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'UPDATE',          'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'CREATE',          'CHECKLIST_TEMPLATE' UNION ALL  -- thiết kế mẫu kiểm tra
   SELECT 'READ',            'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'UPDATE',          'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'READ',            'CHECKLIST_RESULT'   UNION ALL  -- phân tích kết quả
   SELECT 'READ',            'RUNTIME_LOG'        UNION ALL  -- xem giờ chạy để điều chỉnh lịch
   SELECT 'CREATE',          'TAG'                UNION ALL
   SELECT 'READ',            'TAG'                UNION ALL
   SELECT 'UPDATE',          'TAG'                UNION ALL
   SELECT 'READ',            'REPORT') t
WHERE p.PositionName = 'Chuyên viên kỹ thuật số';

-- ===========================================================================
-- Trưởng ca bảo trì (Level 2)
-- Công việc: giám sát ca, phân công KTV, duyệt WO kế hoạch, xác nhận kết quả,
--   duyệt lịch PM, duyệt template checklist, lập tài sản mới.
-- ===========================================================================
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT p.PositionID, t.perm, t.res
FROM Positions p,
  (SELECT 'CREATE' AS perm, 'ASSET'              AS res UNION ALL
   SELECT 'READ',            'ASSET'              UNION ALL
   SELECT 'UPDATE',          'ASSET'              UNION ALL
   SELECT 'CREATE',          'WORK_ORDER'         UNION ALL  -- tạo WO kế hoạch
   SELECT 'READ',            'WORK_ORDER'         UNION ALL
   SELECT 'UPDATE',          'WORK_ORDER'         UNION ALL  -- phân công, điều chỉnh
   SELECT 'APPROVE',         'WORK_ORDER'         UNION ALL  -- duyệt WO thông thường
   SELECT 'READ',            'DIGITAL_ASSET'      UNION ALL
   SELECT 'APPROVE',         'DIGITAL_ASSET'      UNION ALL  -- duyệt tài liệu kỹ thuật
   SELECT 'CREATE',          'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'READ',            'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'UPDATE',          'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'APPROVE',         'MAINTENANCE_PLAN'   UNION ALL  -- duyệt lịch PM
   SELECT 'CREATE',          'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'READ',            'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'UPDATE',          'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'APPROVE',         'CHECKLIST_TEMPLATE' UNION ALL  -- phê duyệt mẫu checklist
   SELECT 'CREATE',          'CHECKLIST_RESULT'   UNION ALL  -- tạo kết quả khi cần
   SELECT 'READ',            'CHECKLIST_RESULT'   UNION ALL
   SELECT 'UPDATE',          'CHECKLIST_RESULT'   UNION ALL  -- xác nhận / hiệu chỉnh kết quả
   SELECT 'READ',            'RUNTIME_LOG'        UNION ALL
   SELECT 'READ',            'EMPLOYEE'           UNION ALL
   SELECT 'CREATE',          'TAG'                UNION ALL
   SELECT 'READ',            'TAG'                UNION ALL
   SELECT 'UPDATE',          'TAG'                UNION ALL
   SELECT 'READ',            'REPORT') t
WHERE p.PositionName = 'Trưởng ca bảo trì';

-- ===========================================================================
-- Trưởng phòng cơ điện (Level 2)
-- Công việc: toàn quyền vận hành, duyệt WO khẩn cấp, quản lý nhân sự ca,
--   xóa/hủy dữ liệu sai, xuất báo cáo.
-- ===========================================================================
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT p.PositionID, t.perm, t.res
FROM Positions p,
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
-- Công việc: quản lý tài khoản, phân quyền, cấu hình workflow.
-- KHÔNG tham gia nghiệp vụ vận hành, bảo trì.
-- ===========================================================================
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT p.PositionID, t.perm, t.res
FROM Positions p,
  (SELECT 'CREATE' AS perm, 'ASSET'              AS res UNION ALL  -- nhập master data tài sản
   SELECT 'READ',            'ASSET'              UNION ALL
   SELECT 'UPDATE',          'ASSET'              UNION ALL
   SELECT 'DELETE',          'ASSET'              UNION ALL
   SELECT 'READ',            'WORK_ORDER'         UNION ALL         -- chỉ đọc, không thao tác
   SELECT 'READ',            'DIGITAL_ASSET'      UNION ALL
   SELECT 'READ',            'MAINTENANCE_PLAN'   UNION ALL
   SELECT 'READ',            'CHECKLIST_TEMPLATE' UNION ALL
   SELECT 'READ',            'CHECKLIST_RESULT'   UNION ALL
   SELECT 'READ',            'RUNTIME_LOG'        UNION ALL
   SELECT 'CREATE',          'EMPLOYEE'           UNION ALL         -- quản lý tài khoản
   SELECT 'READ',            'EMPLOYEE'           UNION ALL
   SELECT 'UPDATE',          'EMPLOYEE'           UNION ALL
   SELECT 'DELETE',          'EMPLOYEE'           UNION ALL
   SELECT 'EXPORT',          'EMPLOYEE'           UNION ALL
   SELECT 'CREATE',          'WORKFLOW'           UNION ALL         -- cấu hình quy trình
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
-- Công việc: xem báo cáo tổng hợp, phê duyệt WO cấp cao (nếu cần).
-- ===========================================================================
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT p.PositionID, t.perm, t.res
FROM Positions p,
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
