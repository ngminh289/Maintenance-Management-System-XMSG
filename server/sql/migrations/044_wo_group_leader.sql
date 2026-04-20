-- ============================================================
-- 044_wo_group_leader.sql
-- WO_Assignments: thêm IsGroupLeader — trưởng nhóm phiếu việc.
-- Trưởng nhóm: người bắt đầu phiếu (WAITING→IN_PROGRESS), ghi chú vật tư.
-- Phân công cá nhân: IsGroupLeader = 1 (mặc định là leader chính mình).
-- Phân công nhóm: 1 người được chỉ định IsGroupLeader = 1.
-- Liên quan: models/workOrder.model.js, services/workOrderFieldAssign.service.js.
-- ============================================================

ALTER TABLE WO_Assignments
  ADD COLUMN IsGroupLeader TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Trưởng nhóm phiếu việc — chỉ leader mới bắt đầu và ghi chú vật tư';
