-- ============================================================
-- 012_consolidate_5roles.sql
-- Dọn sạch hoàn toàn về đúng 5 vai trò theo thiết kế BFD/DFD
-- của đề tài KLTN (Nhà máy Xi măng Sông Gianh).
--
-- 5 Vai trò:
--   1. Công nhân             (Level 1) — Hiện trường: quét QR, checklist, log giờ
--   2. Nhân viên Kỹ thuật    (Level 2) — CVKTS: soạn thảo, quản lý kỹ thuật
--   3. Trưởng ca/Trưởng phòng(Level 3) — Giám sát, phê duyệt, điều phối
--   4. Quản trị viên         (Level 4) — Admin hệ thống: RBAC, nhân sự
--   5. Ban Giám đốc          (Level 5) — Đọc báo cáo toàn hệ thống
--
-- Ma trận quyền theo bảng BFD chính thức của đề tài:
--   C=CREATE U=UPDATE D=DELETE R=READ A=APPROVE X=EXPORT
-- ============================================================

USE warehouse_maintenance;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ──────────────────────────────────────────────────────────
-- BƯỚC 1: Xoá toàn bộ dữ liệu phụ thuộc Positions
-- ──────────────────────────────────────────────────────────
DELETE FROM Roles_Permissions;
DELETE FROM WorkflowSteps;
DELETE FROM WorkflowTemplates;
-- Không xóa Employees để không mất tài khoản admin đang dùng

-- ──────────────────────────────────────────────────────────
-- BƯỚC 2: Cập nhật Positions thành đúng 5 role
-- Giữ nguyên PositionID để không break FK của Employees
-- Mapping cũ → mới:
--   1 (KTV L1)          → Công nhân             L1
--   2 (Trưởng ca L2)    → Nhân viên Kỹ thuật    L2
--   3 (Trưởng phòng L3) → Trưởng ca/phòng       L3
--   4 (Công nhân L1)    → (gộp vào ID 1)         —
--   5 (CVKTS L1)        → (gộp vào ID 2)         —
--   6 (Admin L3)        → Quản trị viên          L4
--   7 (BGĐ L3)          → Ban Giám đốc           L5
-- ──────────────────────────────────────────────────────────

-- Dời nhân viên có position cũ về position hợp nhất trước khi xóa
UPDATE Employees SET PositionID = 1 WHERE PositionID = 4; -- Công nhân vận hành → Công nhân
UPDATE Employees SET PositionID = 2 WHERE PositionID = 5; -- CVKTS → Nhân viên Kỹ thuật
UPDATE Employees SET PositionID = 3 WHERE PositionID = 3; -- Trưởng phòng giữ nguyên
UPDATE Employees SET PositionID = 4 WHERE PositionID = 6; -- Admin (tạm thời gán vào 4)

-- Cập nhật tên và level cho 5 vị trí chính
UPDATE Positions SET PositionName = 'Công nhân',              Level = 1 WHERE PositionID = 1;
UPDATE Positions SET PositionName = 'Nhân viên Kỹ thuật',    Level = 2 WHERE PositionID = 2;
UPDATE Positions SET PositionName = 'Trưởng ca / Trưởng phòng', Level = 3 WHERE PositionID = 3;
UPDATE Positions SET PositionName = 'Quản trị viên',          Level = 4 WHERE PositionID = 6;
UPDATE Positions SET PositionName = 'Ban Giám đốc',           Level = 5 WHERE PositionID = 7;

-- Dọn 2 position dư (4 = Công nhân vận hành, 5 = CVKTS cũ) sau khi đã migrate employees
DELETE FROM Positions WHERE PositionID IN (4, 5);

-- ──────────────────────────────────────────────────────────
-- BƯỚC 3: Tái tạo WorkflowTemplates + WorkflowSteps
-- Approver duy nhất: Trưởng ca/Trưởng phòng (PositionID = 3)
-- ──────────────────────────────────────────────────────────

INSERT INTO WorkflowTemplates (WorkflowID, WorkflowName, DocumentType, TotalLevels, Description) VALUES
    (1, 'Phê duyệt Work Order',       'WORK_ORDER',       1, 'Trưởng ca/phòng duyệt phiếu việc'),
    (2, 'Phê duyệt Tài liệu kỹ thuật','DIGITAL_ASSET',    1, 'Trưởng ca/phòng duyệt tài liệu'),
    (3, 'Phê duyệt Kế hoạch bảo trì', 'MAINTENANCE_PLAN', 1, 'Trưởng ca/phòng duyệt lịch bảo trì')
ON DUPLICATE KEY UPDATE
    WorkflowName = VALUES(WorkflowName),
    TotalLevels  = VALUES(TotalLevels),
    Description  = VALUES(Description);

INSERT INTO WorkflowSteps (WorkflowID, StepLevel, PositionID) VALUES
    (1, 1, 3),  -- WO: Trưởng ca/phòng
    (2, 1, 3),  -- Tài liệu: Trưởng ca/phòng
    (3, 1, 3);  -- Kế hoạch: Trưởng ca/phòng

-- ──────────────────────────────────────────────────────────
-- BƯỚC 4: Ma trận phân quyền 5 role (theo bảng BFD chính thức)
-- PositionID: 1=Công nhân, 2=NV Kỹ thuật, 3=Trưởng ca/phòng,
--             6=Quản trị viên, 7=Ban Giám đốc
-- ──────────────────────────────────────────────────────────

-- ── CÔNG NHÂN (Level 1) ─────────────────────────────────
-- Quản lý TÀI SẢN: chỉ xem
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (1, 'READ', 'ASSET');
-- Lịch bảo trì: chỉ xem
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (1, 'READ', 'MAINTENANCE_PLAN');
-- Phiếu việc: xem + cập nhật trạng thái (bắt đầu/hoàn thành)
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (1, 'READ',   'WORK_ORDER');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (1, 'UPDATE', 'WORK_ORDER');
-- Ghi nhận vận hành (log giờ chạy máy)
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (1, 'CREATE', 'RUNTIME_LOG');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (1, 'UPDATE', 'RUNTIME_LOG');
-- Tài liệu số: chỉ xem (khi quét QR)
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (1, 'READ', 'DIGITAL_ASSET');
-- Checklist: xem mẫu + nộp kết quả
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (1, 'READ',   'CHECKLIST_TEMPLATE');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (1, 'CREATE', 'CHECKLIST_RESULT');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (1, 'READ',   'CHECKLIST_RESULT');

-- ── NHÂN VIÊN KỸ THUẬT (Level 2) ────────────────────────
-- Tài sản: xem + cập nhật thông tin kỹ thuật
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'READ',   'ASSET');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'UPDATE', 'ASSET');
-- Nhân sự: chỉ xem
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'READ', 'EMPLOYEE');
-- Kế hoạch bảo trì: soạn thảo + tạo
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'CREATE', 'MAINTENANCE_PLAN');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'READ',   'MAINTENANCE_PLAN');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'UPDATE', 'MAINTENANCE_PLAN');
-- Phiếu việc: tạo + cập nhật + submit duyệt
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'CREATE', 'WORK_ORDER');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'READ',   'WORK_ORDER');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'UPDATE', 'WORK_ORDER');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'APPROVE','WORK_ORDER');
-- Nhật ký vận hành: chỉ xem
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'READ', 'RUNTIME_LOG');
-- Kho tài liệu số: upload + versioning
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'CREATE', 'DIGITAL_ASSET');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'READ',   'DIGITAL_ASSET');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'UPDATE', 'DIGITAL_ASSET');
-- Tags: quản lý nhãn tài liệu
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'CREATE', 'TAG');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'READ',   'TAG');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'UPDATE', 'TAG');
-- Checklist: thiết kế mẫu
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'CREATE', 'CHECKLIST_TEMPLATE');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'READ',   'CHECKLIST_TEMPLATE');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'UPDATE', 'CHECKLIST_TEMPLATE');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'READ',   'CHECKLIST_RESULT');
-- Workflow: khởi tạo luồng duyệt
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'CREATE', 'WORKFLOW');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'READ',   'WORKFLOW');
-- Báo cáo: xem
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (2, 'READ', 'REPORT');

-- ── TRƯỞNG CA / TRƯỞNG PHÒNG (Level 3) ─────────────────
-- Tài sản: toàn quyền (C/U/D theo bảng BFD)
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'CREATE', 'ASSET');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'READ',   'ASSET');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'UPDATE', 'ASSET');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'DELETE', 'ASSET');
-- Nhân sự: chỉ xem
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'READ', 'EMPLOYEE');
-- Kế hoạch bảo trì: toàn quyền + phê duyệt
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'CREATE', 'MAINTENANCE_PLAN');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'READ',   'MAINTENANCE_PLAN');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'UPDATE', 'MAINTENANCE_PLAN');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'APPROVE','MAINTENANCE_PLAN');
-- Phiếu việc: toàn quyền + phê duyệt
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'CREATE', 'WORK_ORDER');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'READ',   'WORK_ORDER');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'UPDATE', 'WORK_ORDER');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'APPROVE','WORK_ORDER');
-- Nhật ký vận hành: xem
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'READ', 'RUNTIME_LOG');
-- Tài liệu số: xem + phê duyệt
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'READ',   'DIGITAL_ASSET');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'APPROVE','DIGITAL_ASSET');
-- Tags: chỉ xem
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'READ', 'TAG');
-- Checklist: quản lý mẫu + phê duyệt + xác nhận kết quả
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'CREATE', 'CHECKLIST_TEMPLATE');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'READ',   'CHECKLIST_TEMPLATE');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'UPDATE', 'CHECKLIST_TEMPLATE');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'APPROVE','CHECKLIST_TEMPLATE');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'CREATE', 'CHECKLIST_RESULT');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'READ',   'CHECKLIST_RESULT');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'UPDATE', 'CHECKLIST_RESULT');
-- Workflow: xem + phê duyệt
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'READ',   'WORKFLOW');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'APPROVE','WORKFLOW');
-- Báo cáo: xem
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (3, 'READ', 'REPORT');

-- ── QUẢN TRỊ VIÊN (Level 4) ─────────────────────────────
-- Tài sản: chỉ xem (Admin không trực tiếp vận hành)
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (6, 'READ', 'ASSET');
-- Nhân sự: toàn quyền (đây là nghiệp vụ chính của Admin)
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (6, 'CREATE', 'EMPLOYEE');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (6, 'READ',   'EMPLOYEE');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (6, 'UPDATE', 'EMPLOYEE');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (6, 'DELETE', 'EMPLOYEE');
-- Kế hoạch + phiếu: xem
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (6, 'READ', 'MAINTENANCE_PLAN');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (6, 'READ', 'WORK_ORDER');
-- Nhật ký vận hành: xem
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (6, 'READ', 'RUNTIME_LOG');
-- Tài liệu số + checklist: xem
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (6, 'READ', 'DIGITAL_ASSET');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (6, 'READ', 'CHECKLIST_TEMPLATE');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (6, 'READ', 'CHECKLIST_RESULT');
-- Tags: xem + cập nhật (quản lý danh mục nhãn)
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (6, 'READ',   'TAG');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (6, 'UPDATE', 'TAG');
-- Workflow: quản lý cấu hình luồng phê duyệt
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (6, 'CREATE', 'WORKFLOW');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (6, 'READ',   'WORKFLOW');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (6, 'UPDATE', 'WORKFLOW');
-- Báo cáo: xem
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (6, 'READ', 'REPORT');

-- ── BAN GIÁM ĐỐC (Level 5) ──────────────────────────────
-- Tài sản: chỉ xem
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (7, 'READ', 'ASSET');
-- Nhân sự: chỉ xem
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (7, 'READ', 'EMPLOYEE');
-- Kế hoạch: chỉ xem
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (7, 'READ', 'MAINTENANCE_PLAN');
-- Phiếu việc: xem + phê duyệt cuối + xóa (R/A/D theo bảng BFD)
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (7, 'READ',   'WORK_ORDER');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (7, 'APPROVE','WORK_ORDER');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (7, 'DELETE', 'WORK_ORDER');
-- Nhật ký vận hành: chỉ xem
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (7, 'READ', 'RUNTIME_LOG');
-- Tài liệu số: chỉ xem
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (7, 'READ', 'DIGITAL_ASSET');
-- Tags: chỉ xem
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (7, 'READ', 'TAG');
-- Workflow: chỉ xem
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (7, 'READ', 'WORKFLOW');
-- Báo cáo: xem toàn hệ thống + xuất
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (7, 'READ',   'REPORT');
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (7, 'EXPORT', 'REPORT');

SET FOREIGN_KEY_CHECKS = 1;
