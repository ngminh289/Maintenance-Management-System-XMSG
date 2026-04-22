-- 060_fix_departments_cleanup.sql
-- Sửa lỗi DB có phòng thừa: DepartmentID=3 "Phòng Kỹ Thuật" (sai), DepartmentID=4 "Ban Giám Đốc".
-- Chuẩn: chỉ 3 phòng ID 1,2,3 (orgUnits.js). Phòng 3 phải là "Ban giám đốc".
-- DepartmentName có UNIQUE → phải xóa dept 4 trước khi rename dept 3.

USE warehouse_maintenance;
SET FOREIGN_KEY_CHECKS = 0;

-- 1) Chuyển tất cả nhân viên đang ở dept 4 sang dept 3 (sẽ rename dept 3 sau)
UPDATE Employees SET DepartmentID = 3 WHERE DepartmentID = 4;

-- 2) Xóa dept 4 (Ban Giám Đốc cũ) — NV đã chuyển hết sang dept 3
DELETE FROM Departments WHERE DepartmentID = 4;

-- 3) Đổi tên dept 3: "Phòng Kỹ Thuật" → "Ban giám đốc"
UPDATE Departments
SET DepartmentName = 'Ban giám đốc',
    Description    = 'Giám đốc'
WHERE DepartmentID = 3;

-- 4) Xóa tất cả phòng ban thừa (ID > 3) nếu còn
DELETE FROM Departments WHERE DepartmentID > 3;

-- 5) Re-sync DepartmentID cho toàn bộ nhân viên theo PositionID (orgUnits.js)
UPDATE Employees SET DepartmentID = 1 WHERE PositionID IN (1, 3, 6, 8);
UPDATE Employees SET DepartmentID = 2 WHERE PositionID IN (2, 4, 7, 9);
UPDATE Employees SET DepartmentID = 3 WHERE PositionID = 5;

-- 6) Fallback: NV ở dept không tồn tại → Phòng bảo trì
UPDATE Employees SET DepartmentID = 1
WHERE DepartmentID NOT IN (1, 2, 3);

SET FOREIGN_KEY_CHECKS = 1;
