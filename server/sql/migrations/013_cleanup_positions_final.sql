-- ============================================================
-- 013_cleanup_positions_final.sql
-- Reset hoàn toàn về 5 positions sạch với PositionID 1–5.
-- Giải quyết tình trạng DB cũ có positions thừa do seed/migrations chạy lặp.
-- ============================================================

USE warehouse_maintenance;
SET FOREIGN_KEY_CHECKS = 0;

-- ── Bước 1: Dọn Roles_Permissions và WorkflowSteps ──────────────────────────
DELETE FROM Roles_Permissions;
DELETE FROM WorkflowSteps;
DELETE FROM WorkflowTemplates;

-- ── Bước 2: Map tất cả nhân viên về PositionID cuối cùng đúng ───────────────
-- Bất kỳ PositionID Level=4+ → 4 (Quản trị viên)
-- Bất kỳ PositionID Level=5+ → 5 (Ban Giám đốc)
-- Level=3 → 3
-- Level=2 → 2
-- Level=1 → 1
UPDATE Employees e
JOIN Positions p ON e.PositionID = p.PositionID
SET e.PositionID = CASE
    WHEN p.Level >= 5 THEN 5
    WHEN p.Level >= 4 THEN 4
    WHEN p.Level >= 3 THEN 3
    WHEN p.Level >= 2 THEN 2
    ELSE 1
END;

-- ── Bước 3: Xóa hoàn toàn Positions và reset AUTO_INCREMENT ─────────────────
DELETE FROM Positions;
ALTER TABLE Positions AUTO_INCREMENT = 1;

-- ── Bước 4: Insert 5 positions sạch với PositionID tường minh 1–5 ───────────
INSERT INTO Positions (PositionID, PositionName, Level) VALUES
    (1, 'Công nhân',                   1),
    (2, 'Nhân viên Kỹ thuật',         2),
    (3, 'Trưởng ca / Trưởng phòng',   3),
    (4, 'Quản trị viên',               4),
    (5, 'Ban Giám đốc',                5);

-- ── Bước 5: Tái tạo WorkflowTemplates (1 cấp, Trưởng ca/phòng duyệt) ────────
INSERT INTO WorkflowTemplates (WorkflowID, WorkflowName, DocumentType, TotalLevels, Description) VALUES
    (1, 'Phê duyệt Work Order',        'WORK_ORDER',       1, 'Trưởng ca/phòng duyệt phiếu việc'),
    (2, 'Phê duyệt Tài liệu kỹ thuật', 'DIGITAL_ASSET',    1, 'Trưởng ca/phòng duyệt tài liệu'),
    (3, 'Phê duyệt Kế hoạch bảo trì',  'MAINTENANCE_PLAN', 1, 'Trưởng ca/phòng duyệt lịch bảo trì');

INSERT INTO WorkflowSteps (WorkflowID, StepLevel, PositionID) VALUES
    (1, 1, 3),
    (2, 1, 3),
    (3, 1, 3);

-- ── Bước 6: Ma trận phân quyền 5 role ────────────────────────────────────────

-- CÔNG NHÂN (1): hiện trường
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(1,'READ',   'ASSET'),
(1,'READ',   'MAINTENANCE_PLAN'),
(1,'READ',   'WORK_ORDER'),
(1,'UPDATE', 'WORK_ORDER'),
(1,'CREATE', 'RUNTIME_LOG'),
(1,'UPDATE', 'RUNTIME_LOG'),
(1,'READ',   'DIGITAL_ASSET'),
(1,'READ',   'CHECKLIST_TEMPLATE'),
(1,'CREATE', 'CHECKLIST_RESULT'),
(1,'READ',   'CHECKLIST_RESULT');

-- NHÂN VIÊN KỸ THUẬT (2): soạn thảo
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(2,'READ',   'ASSET'),
(2,'UPDATE', 'ASSET'),
(2,'READ',   'EMPLOYEE'),
(2,'CREATE', 'MAINTENANCE_PLAN'),
(2,'READ',   'MAINTENANCE_PLAN'),
(2,'UPDATE', 'MAINTENANCE_PLAN'),
(2,'CREATE', 'WORK_ORDER'),
(2,'READ',   'WORK_ORDER'),
(2,'UPDATE', 'WORK_ORDER'),
(2,'READ',   'RUNTIME_LOG'),
(2,'CREATE', 'DIGITAL_ASSET'),
(2,'READ',   'DIGITAL_ASSET'),
(2,'UPDATE', 'DIGITAL_ASSET'),
(2,'CREATE', 'TAG'),
(2,'READ',   'TAG'),
(2,'UPDATE', 'TAG'),
(2,'CREATE', 'CHECKLIST_TEMPLATE'),
(2,'READ',   'CHECKLIST_TEMPLATE'),
(2,'UPDATE', 'CHECKLIST_TEMPLATE'),
(2,'READ',   'CHECKLIST_RESULT'),
(2,'CREATE', 'WORKFLOW'),
(2,'READ',   'WORKFLOW'),
(2,'READ',   'REPORT');

-- TRƯỞNG CA / TRƯỞNG PHÒNG (3): giám sát + phê duyệt
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(3,'CREATE', 'ASSET'),
(3,'READ',   'ASSET'),
(3,'UPDATE', 'ASSET'),
(3,'DELETE', 'ASSET'),
(3,'READ',   'EMPLOYEE'),
(3,'CREATE', 'MAINTENANCE_PLAN'),
(3,'READ',   'MAINTENANCE_PLAN'),
(3,'UPDATE', 'MAINTENANCE_PLAN'),
(3,'APPROVE','MAINTENANCE_PLAN'),
(3,'CREATE', 'WORK_ORDER'),
(3,'READ',   'WORK_ORDER'),
(3,'UPDATE', 'WORK_ORDER'),
(3,'APPROVE','WORK_ORDER'),
(3,'READ',   'RUNTIME_LOG'),
(3,'READ',   'DIGITAL_ASSET'),
(3,'APPROVE','DIGITAL_ASSET'),
(3,'READ',   'TAG'),
(3,'CREATE', 'CHECKLIST_TEMPLATE'),
(3,'READ',   'CHECKLIST_TEMPLATE'),
(3,'UPDATE', 'CHECKLIST_TEMPLATE'),
(3,'APPROVE','CHECKLIST_TEMPLATE'),
(3,'CREATE', 'CHECKLIST_RESULT'),
(3,'READ',   'CHECKLIST_RESULT'),
(3,'UPDATE', 'CHECKLIST_RESULT'),
(3,'READ',   'WORKFLOW'),
(3,'APPROVE','WORKFLOW'),
(3,'READ',   'REPORT');

-- QUẢN TRỊ VIÊN (4): admin hệ thống
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(4,'READ',   'ASSET'),
(4,'CREATE', 'EMPLOYEE'),
(4,'READ',   'EMPLOYEE'),
(4,'UPDATE', 'EMPLOYEE'),
(4,'DELETE', 'EMPLOYEE'),
(4,'READ',   'MAINTENANCE_PLAN'),
(4,'READ',   'WORK_ORDER'),
(4,'READ',   'RUNTIME_LOG'),
(4,'READ',   'DIGITAL_ASSET'),
(4,'READ',   'CHECKLIST_TEMPLATE'),
(4,'READ',   'CHECKLIST_RESULT'),
(4,'READ',   'TAG'),
(4,'UPDATE', 'TAG'),
(4,'CREATE', 'WORKFLOW'),
(4,'READ',   'WORKFLOW'),
(4,'UPDATE', 'WORKFLOW'),
(4,'READ',   'REPORT');

-- BAN GIÁM ĐỐC (5): đọc toàn bộ + export báo cáo
INSERT INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(5,'READ',   'ASSET'),
(5,'READ',   'EMPLOYEE'),
(5,'READ',   'MAINTENANCE_PLAN'),
(5,'READ',   'WORK_ORDER'),
(5,'APPROVE','WORK_ORDER'),
(5,'DELETE', 'WORK_ORDER'),
(5,'READ',   'RUNTIME_LOG'),
(5,'READ',   'DIGITAL_ASSET'),
(5,'READ',   'TAG'),
(5,'READ',   'WORKFLOW'),
(5,'READ',   'REPORT'),
(5,'EXPORT', 'REPORT');

SET FOREIGN_KEY_CHECKS = 1;
