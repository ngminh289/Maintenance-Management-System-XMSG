-- Migration 045: Đánh dấu trưởng nhóm cố định trong GroupMembers
-- IsGroupLeader = 1: người này là trưởng nhóm mặc định của nhóm (khác WO_Assignments.IsGroupLeader là per-WO).
-- Dùng trong: maintenanceGroup.model.js, EmployeesPage.jsx (GroupsTab).

ALTER TABLE GroupMembers
  ADD COLUMN IsGroupLeader TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Trưởng nhóm cố định của nhóm (1 người / nhóm)' AFTER Notes;
