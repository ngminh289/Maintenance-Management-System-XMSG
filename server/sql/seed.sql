-- ============================================================
-- seed.sql — Dữ liệu khởi tạo cho hệ thống bảo trì kho.
-- Tất cả dùng INSERT IGNORE → chạy lại an toàn (không trùng lặp).
-- Admin account được tạo bởi scripts/setup-db.js (cần bcrypt).
-- ============================================================

USE warehouse_maintenance;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------
-- Chức vụ (Positions) — 6 dòng: TC (3) và Trưởng phòng (6) tách bạch cho duyệt 2 cấp WO khẩn
-- Quyền chi tiết: migrations (sau 019, Position 6 có bản sao quyền từ 3). PositionID tường minh.
-- ----------------------------------------------------------
INSERT IGNORE INTO Positions (PositionID, PositionName, Level) VALUES
    (1, 'Công nhân',                  1),
    (2, 'Nhân viên Kỹ thuật',        2),
    (3, 'Trưởng ca',                  3),
    (4, 'Quản trị viên',              4),
    (5, 'Ban Giám đốc',               5),
    (6, 'Trưởng phòng',               3);

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
-- WO khẩn cấp: bước 1 → Position 3 (Trưởng ca), bước 2 → Position 6 (Trưởng phòng)
-- ----------------------------------------------------------
INSERT IGNORE INTO WorkflowTemplates (WorkflowID, WorkflowName, DocumentType, TotalLevels, Description) VALUES
    (1, 'Phê duyệt Work Order thông thường', 'WORK_ORDER',       1, 'Trưởng ca duyệt phiếu việc (WO lịch / LOW|MEDIUM)'),
    (2, 'Phê duyệt Tài liệu kỹ thuật',       'DIGITAL_ASSET',    1, 'Trưởng ca duyệt tài liệu'),
    (3, 'Phê duyệt Kế hoạch bảo trì',        'MAINTENANCE_PLAN', 1, 'Trưởng ca duyệt lịch bảo trì'),
    (4, 'Phê duyệt WO khẩn cấp',             'WORK_ORDER',       2, 'WO PREDICTIVE/CORRECTIVE hoặc HIGH|EMERGENCY — 2 cấp duyệt');

INSERT IGNORE INTO WorkflowSteps (WorkflowID, StepLevel, PositionID) VALUES
    (1, 1, 3),
    (2, 1, 3),
    (3, 1, 3),
    (4, 1, 3),
    (4, 2, 6);

-- Roles_Permissions được quản lý hoàn toàn bởi migrations (011_extend_resource_types.sql).
-- Không insert ở đây để tránh conflict với RBAC đã được thiết kế lại đúng nghiệp vụ.

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
