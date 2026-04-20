-- Migration 047: 3 thay đổi gộp
-- 1. Soft-delete nhóm bảo trì: IsActive thay vì xóa thật
-- 2. Thêm type thông báo cho nhóm bảo trì
-- 3. Field dây chuyền cho Assets

USE warehouse_maintenance;

-- 1. Soft-delete nhóm
ALTER TABLE MaintenanceGroups
  ADD COLUMN IsActive TINYINT(1) NOT NULL DEFAULT 1
    COMMENT '1 = đang hoạt động, 0 = đã giải thể (soft-delete)' AFTER Description;

-- 2. Mở rộng ENUM Type cho Notifications
ALTER TABLE Notifications
  MODIFY COLUMN Type ENUM(
    'MAINTENANCE_DUE',
    'APPROVAL_REQUEST',
    'WORK_ORDER_ASSIGNED',
    'WORK_ORDER_COMPLETED',
    'SYSTEM_ALERT',
    'TASK_OVERDUE',
    'DOCUMENT_FEEDBACK_NEW',
    'DOCUMENT_FEEDBACK_STATUS',
    'MAINTENANCE_GROUP_JOINED',
    'MAINTENANCE_GROUP_LEADER'
  ) NOT NULL DEFAULT 'SYSTEM_ALERT';

-- 3. Dây chuyền / Dùng chung cho Assets
ALTER TABLE Assets
  ADD COLUMN ProductionLine ENUM('Dây chuyền', 'Dùng chung') NULL
    COMMENT 'Thuộc dây chuyền hay dùng chung toàn nhà máy' AFTER Description;
