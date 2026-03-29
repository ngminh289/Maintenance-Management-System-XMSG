-- 007_positions_rbac.sql
-- Bổ sung chức vụ còn thiếu để đủ 5 vai trò theo thiết kế RBAC (USER,RBAC.html).
-- Mapping Level:
--   Level 1 = Nhân viên / Hiện trường     → được phép tự đăng ký
--   Level 2 = Trưởng ca / Điều hành       → chỉ admin tạo
--   Level 3 = Quản lý / Admin / Ban GĐ   → chỉ admin tạo
-- PositionID cũ (giữ nguyên): 1=Kỹ thuật viên, 2=Trưởng ca bảo trì, 3=Trưởng phòng cơ điện
USE warehouse_maintenance;

-- Thêm chức vụ Level 1 (nhân viên hiện trường — tự đăng ký được)
INSERT IGNORE INTO Positions (PositionName, Level) VALUES
    ('Công nhân vận hành', 1),
    ('Chuyên viên kỹ thuật số', 1);

-- Thêm chức vụ Level 3 (cấp cao — chỉ admin tạo)
INSERT IGNORE INTO Positions (PositionName, Level) VALUES
    ('Quản trị hệ thống', 3),
    ('Ban Giám đốc', 3);
