-- Migration 046: Chuyên môn tổng của nhóm (thay cho chuyên môn từng thành viên)
-- Thêm Specialty vào MaintenanceGroups, xóa Specialty trong GroupMembers.

ALTER TABLE MaintenanceGroups
  ADD COLUMN Specialty VARCHAR(200) NULL
    COMMENT 'Chuyên môn tổng của nhóm (VD: Cơ khí, Điện, Hàn...)'
    AFTER Description;

ALTER TABLE GroupMembers
  DROP COLUMN Specialty;
