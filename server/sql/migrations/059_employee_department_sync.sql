-- 059_employee_department_sync.sql
-- Đồng bộ DepartmentID theo PositionID (orgUnits.js): sửa lệch kiểu Giám đốc (5) vẫn gắn Phòng bảo trì (1).
-- Chạy an toàn nhiều lần: cập nhật khi giá trị hiện tại khác chuẩn.
-- Liên quan: server/src/constants/orgUnits.js, employee.service.js.

USE warehouse_maintenance;

UPDATE Employees e
SET e.DepartmentID = CASE
  WHEN e.PositionID IN (1, 3, 6, 8) THEN 1
  WHEN e.PositionID IN (2, 4, 7, 9) THEN 2
  WHEN e.PositionID = 5 THEN 3
  ELSE e.DepartmentID
END
WHERE e.DepartmentID <> CASE
  WHEN e.PositionID IN (1, 3, 6, 8) THEN 1
  WHEN e.PositionID IN (2, 4, 7, 9) THEN 2
  WHEN e.PositionID = 5 THEN 3
  ELSE e.DepartmentID
END;
