-- ============================================================
-- 043_employee_skill_photo.sql
-- Employees: Bậc thợ (CraftLevel), Chuyên môn (Specialty),
--            Ghi chú kinh nghiệm (ExperienceNotes), Ảnh (PhotoPath)
-- GroupMembers: Chuyên môn (Specialty), Ghi chú vai trò trong nhóm (Notes)
-- Liên quan: models/employee.model.js, models/maintenanceGroup.model.js
-- ============================================================

ALTER TABLE Employees
  ADD COLUMN CraftLevel      TINYINT UNSIGNED NULL COMMENT 'Bậc thợ (1–7)' AFTER Phone,
  ADD COLUMN Specialty       VARCHAR(200)     NULL COMMENT 'Chuyên môn kỹ thuật' AFTER CraftLevel,
  ADD COLUMN ExperienceNotes TEXT             NULL COMMENT 'Ghi chú kinh nghiệm / chứng chỉ' AFTER Specialty,
  ADD COLUMN PhotoPath       VARCHAR(512)     NULL COMMENT 'Ảnh nhân viên (uploads/employees/...)' AFTER ExperienceNotes;

ALTER TABLE GroupMembers
  ADD COLUMN Specialty       VARCHAR(200) NULL COMMENT 'Chuyên môn trong nhóm' AFTER RoleNotes,
  ADD COLUMN Notes           TEXT         NULL COMMENT 'Ghi chú vai trò' AFTER Specialty;
