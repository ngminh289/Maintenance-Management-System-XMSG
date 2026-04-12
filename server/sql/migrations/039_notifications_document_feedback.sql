-- 039_notifications_document_feedback.sql
-- Loại thông báo riêng cho luồng phản hồi tài liệu (DAM).
-- DOCUMENT_FEEDBACK_NEW: gửi tới mọi NV Kỹ thuật khi có góp ý mới.
-- DOCUMENT_FEEDBACK_STATUS: gửi tới người góp ý khi KT cập nhật trạng thái / ghi chú.
USE warehouse_maintenance;

ALTER TABLE Notifications
  MODIFY COLUMN Type ENUM(
    'MAINTENANCE_DUE',
    'APPROVAL_REQUEST',
    'WORK_ORDER_ASSIGNED',
    'WORK_ORDER_COMPLETED',
    'SYSTEM_ALERT',
    'TASK_OVERDUE',
    'DOCUMENT_FEEDBACK_NEW',
    'DOCUMENT_FEEDBACK_STATUS'
  ) NOT NULL DEFAULT 'SYSTEM_ALERT';
