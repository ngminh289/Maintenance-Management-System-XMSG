-- 075_backfill_missing_checklist_slots.sql
-- Bổ sung slot thiếu: mỗi (WorkOrderID, TemplateID) từ MaintenanceScheduleChecklistTemplates.
-- Dùng cho WO đã tạo trước khi lịch có đủ N mẫu; báo cáo aggregateCompliance đếm theo slot.
USE warehouse_maintenance;

INSERT IGNORE INTO ScheduledChecklistSlots (
    ScheduleID,
    AssetID,
    DueDate,
    WorkOrderID,
    TemplateID,
    Status
)
SELECT
    wo.ScheduleID,
    wo.AssetID,
    COALESCE(
        NULLIF(wo.PlannedDate, '0000-00-00'),
        NULLIF(ms.NextDueDate, '0000-00-00'),
        NULLIF(ms.StartDate, '0000-00-00'),
        CURDATE()
    ),
    wo.WO_ID,
    msct.TemplateID,
    'OPEN'
FROM WorkOrders wo
JOIN MaintenanceScheduleChecklistTemplates msct
  ON msct.ScheduleID = wo.ScheduleID
JOIN MaintenanceSchedules ms ON ms.ScheduleID = wo.ScheduleID
LEFT JOIN ScheduledChecklistSlots s
  ON s.WorkOrderID = wo.WO_ID AND s.TemplateID = msct.TemplateID
WHERE wo.IsDeleted = 0
  AND wo.ScheduleID IS NOT NULL
  AND wo.Status NOT IN ('COMPLETED', 'CANCELLED')
  AND (
    wo.WO_Source = 'SCHEDULE'
    OR wo.WO_Source = 'PREDICTIVE_SCHEDULE'
    OR (wo.WO_Source = 'PREDICTIVE' AND wo.ScheduleID IS NOT NULL)
  )
  AND s.SlotID IS NULL;
