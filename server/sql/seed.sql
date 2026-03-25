-- ============================================================
-- seed.sql — Dữ liệu khởi tạo cho hệ thống bảo trì kho.
-- Tất cả dùng INSERT IGNORE → chạy lại an toàn (không trùng lặp).
-- Admin account được tạo bởi scripts/setup-db.js (cần bcrypt).
-- ============================================================

USE warehouse_maintenance;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------
-- Chức vụ (Positions) — Level: 1=Nhân viên, 2=Trưởng nhóm, 3=Quản lý
-- ----------------------------------------------------------
INSERT IGNORE INTO Positions (PositionName, Level) VALUES
    ('Kỹ thuật viên',        1),
    ('Trưởng ca bảo trì',    2),
    ('Trưởng phòng cơ điện', 3);

-- ----------------------------------------------------------
-- Phòng ban (Departments)
-- ----------------------------------------------------------
INSERT IGNORE INTO Departments (DepartmentName, Description) VALUES
    ('Phòng Cơ Điện',   'Quản lý bảo trì thiết bị cơ điện'),
    ('Phòng Sản Xuất',  'Vận hành dây chuyền sản xuất'),
    ('Phòng Kỹ Thuật',  'Giám sát kỹ thuật và an toàn'),
    ('Ban Giám Đốc',    'Lãnh đạo nhà máy');

-- ----------------------------------------------------------
-- Loại tài sản (AssetTypes)
-- ----------------------------------------------------------
INSERT IGNORE INTO AssetTypes (TypeName, Description, DefaultPMInterval) VALUES
    ('Máy nghiền Clinker',    'Máy nghiền bi nghiền nguyên liệu thô',          '720 giờ'),
    ('Lò nung Clinker',       'Lò quay nung xi măng ở nhiệt độ cao',           '2160 giờ'),
    ('Băng chuyền',           'Hệ thống vận chuyển vật liệu',                  '360 giờ'),
    ('Động cơ điện',          'Động cơ 3 pha dẫn động thiết bị sản xuất',      '1440 giờ'),
    ('Máy đóng bao xi măng',  'Máy đóng gói xi măng tự động',                  '480 giờ'),
    ('Silo chứa xi măng',     'Bồn chứa xi măng thành phẩm dung tích lớn',     '2160 giờ'),
    ('Máy nén khí',           'Cung cấp khí nén cho hệ thống vận hành',        '720 giờ'),
    ('Hệ thống lọc bụi',      'Xử lý khí thải và bụi từ lò nung',             '1080 giờ');

-- ----------------------------------------------------------
-- Vị trí (Locations) — Cây: Nhà máy → Phân xưởng → Khu vực
-- ----------------------------------------------------------
INSERT IGNORE INTO Locations (LocationID, LocationName, ParentLocationID, Description) VALUES
    (1, 'Nhà máy Xi măng Sông Gianh', NULL,  'Toàn bộ khuôn viên nhà máy');

INSERT IGNORE INTO Locations (LocationID, LocationName, ParentLocationID, Description) VALUES
    (2, 'Phân xưởng Lò nung',    1, 'Khu vực lò quay và hệ thống nung'),
    (3, 'Phân xưởng Nghiền',     1, 'Khu vực nghiền thô và nghiền xi măng'),
    (4, 'Phân xưởng Đóng bao',   1, 'Đóng gói và xuất hàng'),
    (5, 'Khu vực Kỹ thuật điện', 1, 'Trạm điện và tủ điều khiển');

INSERT IGNORE INTO Locations (LocationID, LocationName, ParentLocationID, Description) VALUES
    (6,  'Lò số 1',              2, NULL),
    (7,  'Lò số 2',              2, NULL),
    (8,  'Nghiền thô',           3, 'Máy nghiền bi thô'),
    (9,  'Nghiền xi măng',       3, 'Máy nghiền đứng xi măng'),
    (10, 'Trạm đóng bao A',      4, NULL),
    (11, 'Trạm đóng bao B',      4, NULL);

-- ----------------------------------------------------------
-- Mẫu Checklist (ChecklistTemplates) theo loại tài sản
-- ----------------------------------------------------------
INSERT IGNORE INTO ChecklistTemplates (AssetTypeID, TemplateName, Description) VALUES
    (3, 'Kiểm tra định kỳ Băng chuyền',  'Checklist kiểm tra hàng ngày băng chuyền'),
    (4, 'Kiểm tra Động cơ điện',         'Checklist kiểm tra nhiệt độ, rung và dầu'),
    (1, 'Kiểm tra Máy nghiền Clinker',   'Checklist trước và sau vận hành máy nghiền');

-- Câu hỏi cho Băng chuyền (TemplateID=1)
INSERT IGNORE INTO ChecklistTemplateItems (TemplateID, QuestionText, InputType, SortOrder, IsRequired) VALUES
    (1, 'Dây băng có bị đứt, rách không?',                      'PASS_FAIL', 1, TRUE),
    (1, 'Con lăn có bị kẹt, mòn không?',                        'PASS_FAIL', 2, TRUE),
    (1, 'Nhiệt độ vòng bi (°C)',                                 'RANGE',     3, TRUE),
    (1, 'Âm thanh bất thường (mô tả nếu có)',                   'TEXT',      4, FALSE),
    (1, 'Chụp ảnh tình trạng dây băng',                         'PHOTO',     5, FALSE);

-- Gán min/max cho câu hỏi nhiệt độ (ItemID sẽ là 3, nhưng dùng WHERE an toàn hơn)
UPDATE ChecklistTemplateItems
SET RangeMin = 20, RangeMax = 80, Unit = '°C'
WHERE TemplateID = 1 AND InputType = 'RANGE';

-- Câu hỏi cho Động cơ điện (TemplateID=2)
INSERT IGNORE INTO ChecklistTemplateItems (TemplateID, QuestionText, InputType, SortOrder, IsRequired) VALUES
    (2, 'Nhiệt độ vỏ động cơ (°C)',              'RANGE',     1, TRUE),
    (2, 'Độ rung (mm/s)',                         'RANGE',     2, TRUE),
    (2, 'Mức dầu bôi trơn đủ không?',            'PASS_FAIL', 3, TRUE),
    (2, 'Tiếng kêu bất thường?',                  'PASS_FAIL', 4, TRUE),
    (2, 'Chụp ảnh nhãn máy',                      'PHOTO',     5, FALSE);

UPDATE ChecklistTemplateItems
SET RangeMin = 20, RangeMax = 90, Unit = '°C'
WHERE TemplateID = 2 AND QuestionText LIKE '%nhiệt độ%';

UPDATE ChecklistTemplateItems
SET RangeMin = 0, RangeMax = 7.1, Unit = 'mm/s'
WHERE TemplateID = 2 AND QuestionText LIKE '%rung%';

-- ----------------------------------------------------------
-- Mẫu Workflow phê duyệt (WorkflowTemplates + WorkflowSteps)
-- Phải insert Positions trước — PositionID: 1=KTV, 2=Trưởng ca, 3=Trưởng phòng
-- ----------------------------------------------------------
INSERT IGNORE INTO WorkflowTemplates (WorkflowName, DocumentType, TotalLevels, Description) VALUES
    ('Phê duyệt Work Order thông thường', 'WORK_ORDER',       2, '2 cấp: Trưởng ca → Trưởng phòng'),
    ('Phê duyệt Tài liệu kỹ thuật',       'DIGITAL_ASSET',    2, '2 cấp dành cho tài liệu thông thường'),
    ('Phê duyệt Tài liệu nhạy cảm',       'DIGITAL_ASSET',    3, '3 cấp: KTV → Trưởng ca → Trưởng phòng'),
    ('Phê duyệt Kế hoạch bảo trì',        'MAINTENANCE_PLAN', 2, '2 cấp: Trưởng ca → Trưởng phòng');

INSERT IGNORE INTO WorkflowSteps (WorkflowID, StepLevel, PositionID) VALUES
    -- Work Order (2 cấp)
    (1, 1, 2),   -- Level 1: Trưởng ca
    (1, 2, 3),   -- Level 2: Trưởng phòng
    -- Tài liệu thông thường (2 cấp)
    (2, 1, 2),
    (2, 2, 3),
    -- Tài liệu nhạy cảm (3 cấp)
    (3, 1, 1),   -- Level 1: Kỹ thuật viên kiểm tra sơ bộ
    (3, 2, 2),   -- Level 2: Trưởng ca duyệt
    (3, 3, 3),   -- Level 3: Trưởng phòng duyệt cuối
    -- Kế hoạch bảo trì (2 cấp)
    (4, 1, 2),
    (4, 2, 3);

-- ----------------------------------------------------------
-- Phân quyền (Roles_Permissions) — Ma trận đầy đủ
-- PositionID: 1=Kỹ thuật viên, 2=Trưởng ca, 3=Trưởng phòng
-- ----------------------------------------------------------
INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
    -- Kỹ thuật viên: chỉ đọc + cập nhật trạng thái tài sản
    (1, 'READ',   'ASSET'),
    (1, 'UPDATE', 'ASSET'),
    (1, 'READ',   'WORK_ORDER'),
    (1, 'UPDATE', 'WORK_ORDER'),
    (1, 'READ',   'DIGITAL_ASSET'),
    (1, 'CREATE', 'DIGITAL_ASSET'),
    (1, 'READ',   'MAINTENANCE_PLAN'),

    -- Trưởng ca: tất cả quyền trên + tạo/phê duyệt
    (2, 'CREATE', 'ASSET'),
    (2, 'READ',   'ASSET'),
    (2, 'UPDATE', 'ASSET'),
    (2, 'CREATE', 'WORK_ORDER'),
    (2, 'READ',   'WORK_ORDER'),
    (2, 'UPDATE', 'WORK_ORDER'),
    (2, 'APPROVE','WORK_ORDER'),
    (2, 'CREATE', 'DIGITAL_ASSET'),
    (2, 'READ',   'DIGITAL_ASSET'),
    (2, 'UPDATE', 'DIGITAL_ASSET'),
    (2, 'APPROVE','DIGITAL_ASSET'),
    (2, 'CREATE', 'MAINTENANCE_PLAN'),
    (2, 'READ',   'MAINTENANCE_PLAN'),
    (2, 'UPDATE', 'MAINTENANCE_PLAN'),
    (2, 'APPROVE','MAINTENANCE_PLAN'),
    (2, 'READ',   'EMPLOYEE'),

    -- Trưởng phòng: toàn quyền
    (3, 'CREATE', 'ASSET'),
    (3, 'READ',   'ASSET'),
    (3, 'UPDATE', 'ASSET'),
    (3, 'DELETE', 'ASSET'),
    (3, 'EXPORT', 'ASSET'),
    (3, 'CREATE', 'WORK_ORDER'),
    (3, 'READ',   'WORK_ORDER'),
    (3, 'UPDATE', 'WORK_ORDER'),
    (3, 'DELETE', 'WORK_ORDER'),
    (3, 'APPROVE','WORK_ORDER'),
    (3, 'EXPORT', 'WORK_ORDER'),
    (3, 'CREATE', 'DIGITAL_ASSET'),
    (3, 'READ',   'DIGITAL_ASSET'),
    (3, 'UPDATE', 'DIGITAL_ASSET'),
    (3, 'DELETE', 'DIGITAL_ASSET'),
    (3, 'APPROVE','DIGITAL_ASSET'),
    (3, 'EXPORT', 'DIGITAL_ASSET'),
    (3, 'CREATE', 'MAINTENANCE_PLAN'),
    (3, 'READ',   'MAINTENANCE_PLAN'),
    (3, 'UPDATE', 'MAINTENANCE_PLAN'),
    (3, 'DELETE', 'MAINTENANCE_PLAN'),
    (3, 'APPROVE','MAINTENANCE_PLAN'),
    (3, 'CREATE', 'EMPLOYEE'),
    (3, 'READ',   'EMPLOYEE'),
    (3, 'UPDATE', 'EMPLOYEE'),
    (3, 'DELETE', 'EMPLOYEE'),
    (3, 'EXPORT', 'EMPLOYEE'),
    (3, 'READ',   'INVENTORY'),
    (3, 'EXPORT', 'INVENTORY');

-- ----------------------------------------------------------
-- Tags — Nhãn tài liệu thường dùng
-- ----------------------------------------------------------
INSERT IGNORE INTO Tags (TagName) VALUES
    ('Bản vẽ kỹ thuật'),
    ('An toàn lao động'),
    ('Hướng dẫn sửa chữa'),
    ('Biên bản kiểm tra'),
    ('Hướng dẫn vận hành'),
    ('Checklist bảo trì'),
    ('Báo cáo sự cố'),
    ('Quy trình khắc phục');

-- ----------------------------------------------------------
-- RetentionPolicies — Chính sách giữ dữ liệu
-- ----------------------------------------------------------
INSERT IGNORE INTO RetentionPolicies (PolicyName, RetentionDays, TargetTable, ActionAfter, Description) VALUES
    ('Xóa AuditLogs cũ',        365, 'AuditLogs',     'ANONYMIZE', 'Ẩn danh sau 1 năm'),
    ('Dọn Notifications cũ',    90,  'Notifications',  'DELETE',    'Xóa thông báo đã đọc sau 90 ngày'),
    ('Lưu trữ RuntimeLogs',     730, 'AssetRuntimeLogs','ARCHIVE',  'Chuyển sang bảng archive sau 2 năm');

SET FOREIGN_KEY_CHECKS = 1;
