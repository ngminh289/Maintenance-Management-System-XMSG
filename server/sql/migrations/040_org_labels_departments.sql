-- 040_org_labels_departments.sql
-- Đổi tên chức vụ (Công nhân → KTV hiện trường; NV KT → CV KTS; BGD → Giám đốc; QTV → Admin).
-- Chuẩn hóa 3 phòng ban; gán Employees theo PositionID; xóa phòng thừa (DepartmentID > 3).

SET NAMES utf8mb4;

UPDATE Positions SET PositionName = 'KTV hiện trường' WHERE PositionID = 1;
UPDATE Positions SET PositionName = 'Chuyên viên kỹ thuật số' WHERE PositionID = 2;
UPDATE Positions SET PositionName = 'Admin' WHERE PositionID = 4;
UPDATE Positions SET PositionName = 'Giám đốc' WHERE PositionID = 5;

UPDATE Employees SET DepartmentID = 1 WHERE PositionID IN (1, 3, 6);
UPDATE Employees SET DepartmentID = 2 WHERE PositionID IN (2, 4);
UPDATE Employees SET DepartmentID = 3 WHERE PositionID = 5;

UPDATE Departments
SET DepartmentName = 'Phòng bảo trì',
    Description = 'KTV hiện trường, Trưởng ca, Trưởng phòng'
WHERE DepartmentID = 1;

UPDATE Departments
SET DepartmentName = 'Phòng kỹ thuật - công nghệ',
    Description = 'Chuyên viên kỹ thuật số, Admin'
WHERE DepartmentID = 2;

UPDATE Departments
SET DepartmentName = 'Ban giám đốc',
    Description = 'Giám đốc'
WHERE DepartmentID = 3;

UPDATE Employees SET DepartmentID = 1 WHERE DepartmentID > 3 AND PositionID IN (1, 3, 6);
UPDATE Employees SET DepartmentID = 2 WHERE DepartmentID > 3 AND PositionID IN (2, 4);
UPDATE Employees SET DepartmentID = 3 WHERE DepartmentID > 3 AND PositionID = 5;
UPDATE Employees SET DepartmentID = 1 WHERE DepartmentID > 3;

DELETE FROM Departments WHERE DepartmentID > 3;
