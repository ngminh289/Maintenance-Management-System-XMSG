-- 051_scheduled_checklist_slots.sql
-- Mỗi lần tạo WO từ lịch (WO_Source=SCHEDULE) = 1 "lượt" yêu cầu checklist định kỳ.
-- Tỷ lệ hoàn thành = FULFILLED / tổng slot trong kỳ (theo DueDate).
-- FulfilledAt: khi TC/TP duyệt APPROVE checklist gắn đúng WorkOrderID của slot.
-- Liên quan: services/maintenanceSchedule.service.js (generateWorkOrder),
--            services/checklist.service.js (reviewChecklistResult),
--            models/scheduledChecklistSlot.model.js, stats.controller.js.
USE warehouse_maintenance;

CREATE TABLE IF NOT EXISTS ScheduledChecklistSlots (
    SlotID        BIGINT       AUTO_INCREMENT PRIMARY KEY,
    ScheduleID    INT          NOT NULL,
    AssetID       INT          NOT NULL,
    DueDate       DATE         NOT NULL COMMENT 'Ngay den han ky (NextDueDate tai thoi diem tao WO)',
    WorkOrderID   INT          NOT NULL,
    ChecklistID   INT          NULL,
    FulfilledAt   DATETIME     NULL,
    Status        ENUM('OPEN','FULFILLED','OVERDUE','WAIVED') NOT NULL DEFAULT 'OPEN',
    CreatedAt     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_slot_work_order (WorkOrderID),
    INDEX idx_schedule_due (ScheduleID, DueDate),
    INDEX idx_asset_due (AssetID, DueDate),
    INDEX idx_status_due (Status, DueDate),
    FOREIGN KEY (ScheduleID)  REFERENCES MaintenanceSchedules(ScheduleID) ON DELETE CASCADE,
    FOREIGN KEY (AssetID)     REFERENCES Assets(AssetID)                  ON DELETE CASCADE,
    FOREIGN KEY (WorkOrderID) REFERENCES WorkOrders(WO_ID)                ON DELETE CASCADE,
    FOREIGN KEY (ChecklistID) REFERENCES ChecklistResults(ChecklistID)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill: WO đã có từ lịch trước khi có bảng slot
INSERT IGNORE INTO ScheduledChecklistSlots (ScheduleID, AssetID, DueDate, WorkOrderID, ChecklistID, FulfilledAt, Status)
SELECT
    wo.ScheduleID,
    wo.AssetID,
    wo.PlannedDate,
    wo.WO_ID,
    (SELECT cr.ChecklistID FROM ChecklistResults cr
     WHERE cr.WO_ID = wo.WO_ID AND cr.ReviewStatus = 'APPROVED'
     ORDER BY cr.ReviewedAt DESC LIMIT 1),
    (SELECT cr.ReviewedAt FROM ChecklistResults cr
     WHERE cr.WO_ID = wo.WO_ID AND cr.ReviewStatus = 'APPROVED'
     ORDER BY cr.ReviewedAt DESC LIMIT 1),
    CASE
        WHEN EXISTS (
            SELECT 1 FROM ChecklistResults cr2
            WHERE cr2.WO_ID = wo.WO_ID AND cr2.ReviewStatus = 'APPROVED'
        ) THEN 'FULFILLED'
        WHEN wo.PlannedDate < CURDATE()
             AND NOT EXISTS (
                 SELECT 1 FROM ChecklistResults cr3
                 WHERE cr3.WO_ID = wo.WO_ID AND cr3.ReviewStatus = 'APPROVED'
             ) THEN 'OVERDUE'
        ELSE 'OPEN'
    END
FROM WorkOrders wo
WHERE wo.WO_Source = 'SCHEDULE'
  AND wo.ScheduleID IS NOT NULL;
