-- Migration 049: Thêm ResourceType + ResourceID vào Notifications
-- Cho phép frontend navigate đúng link khi click thông báo.
-- ResourceType: WORK_ORDER | DIGITAL_ASSET | MAINTENANCE_PLAN | CHECKLIST | MAINTENANCE_GROUP
-- ResourceID: ID tương ứng trong bảng nguồn

USE warehouse_maintenance;

ALTER TABLE Notifications
  ADD COLUMN ResourceType VARCHAR(50) NULL
    COMMENT 'Loại tài nguyên liên quan (WORK_ORDER, DIGITAL_ASSET, ...)' AFTER Type,
  ADD COLUMN ResourceID   INT          NULL
    COMMENT 'ID tài nguyên liên quan' AFTER ResourceType;

-- Index để filter nhanh nếu cần
ALTER TABLE Notifications
  ADD INDEX idx_resource (ResourceType, ResourceID);
