/**
 * scheduledChecklistSlot.model.js — SQL cho ScheduledChecklistSlots.
 * Một slot = một lượt checklist bắt buộc gắn WO sinh từ lịch (migration 051).
 * Liên quan: maintenanceSchedule.service.js, checklist.service.js, stats.controller.js.
 */
import { getPool } from '../config/database.js';

/**
 * Tạo slot khi generateWorkOrder từ lịch. INSERT IGNORE tránh trùng nếu gọi lặp.
 */
export async function insertForScheduleWorkOrder({
  scheduleId,
  assetId,
  dueDate,
  workOrderId,
}) {
  const [result] = await getPool().query(
    `INSERT IGNORE INTO ScheduledChecklistSlots (ScheduleID, AssetID, DueDate, WorkOrderID, Status)
     VALUES (?, ?, ?, ?, 'OPEN')`,
    [scheduleId, assetId, dueDate, workOrderId],
  );
  return result.affectedRows;
}

/**
 * Đánh dấu hoàn thành khi checklist được duyệt APPROVE và khớp WO slot.
 */
export async function fulfillByWorkOrder(workOrderId, checklistId) {
  const [result] = await getPool().query(
    `UPDATE ScheduledChecklistSlots
     SET ChecklistID = ?, FulfilledAt = NOW(), Status = 'FULFILLED'
     WHERE WorkOrderID = ? AND Status IN ('OPEN', 'OVERDUE')`,
    [checklistId, workOrderId],
  );
  return result.affectedRows;
}

/** Tổng hợp tỷ lệ hoàn thành theo khoảng DueDate */
export async function aggregateCompliance({ months = 12 } = {}) {
  const pool = getPool();
  const [[summary]] = await pool.query(
    `SELECT
       COUNT(*) AS totalSlots,
       SUM(Status = 'FULFILLED') AS fulfilledSlots,
       SUM(Status = 'OPEN') AS openSlots,
       SUM(Status = 'OVERDUE') AS overdueSlots,
       SUM(Status = 'WAIVED') AS waivedSlots
     FROM ScheduledChecklistSlots
     WHERE DueDate >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)`,
    [months],
  );
  const total = Number(summary?.totalSlots ?? 0);
  const fulfilled = Number(summary?.fulfilledSlots ?? 0);
  const ratePct =
    total > 0 ? Math.round((fulfilled / total) * 1000) / 10 : null;

  const summaryOut = {
    totalSlots: total,
    fulfilledSlots: fulfilled,
    openSlots: Number(summary?.openSlots ?? 0),
    overdueSlots: Number(summary?.overdueSlots ?? 0),
    waivedSlots: Number(summary?.waivedSlots ?? 0),
    completionRatePct: ratePct,
  };

  const [bySchedule] = await pool.query(
    `SELECT
       s.SlotID AS slotId,
       ms.ScheduleID AS scheduleId,
       ms.ScheduleName AS scheduleName,
       a.AssetName AS assetName,
       s.DueDate AS dueDate,
       s.WorkOrderID AS workOrderId,
       s.Status AS status,
       s.FulfilledAt AS fulfilledAt,
       s.ChecklistID AS checklistId
     FROM ScheduledChecklistSlots s
     JOIN MaintenanceSchedules ms ON ms.ScheduleID = s.ScheduleID
     JOIN Assets a ON a.AssetID = s.AssetID
     WHERE s.DueDate >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
     ORDER BY s.DueDate DESC, s.SlotID DESC
     LIMIT 200`,
    [months],
  );

  const [byScheduleSummary] = await pool.query(
    `SELECT
       ms.ScheduleID AS scheduleId,
       ms.ScheduleName AS scheduleName,
       a.AssetName AS assetName,
       COUNT(*) AS totalSlots,
       SUM(s.Status = 'FULFILLED') AS fulfilledSlots,
       SUM(s.Status = 'OVERDUE') AS overdueSlots,
       SUM(s.Status = 'OPEN') AS openSlots
     FROM ScheduledChecklistSlots s
     JOIN MaintenanceSchedules ms ON ms.ScheduleID = s.ScheduleID
     JOIN Assets a ON a.AssetID = ms.AssetID
     WHERE s.DueDate >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
     GROUP BY ms.ScheduleID, ms.ScheduleName, a.AssetName
     ORDER BY fulfilledSlots ASC, overdueSlots DESC`,
    [months],
  );

  return {
    months,
    summary: summaryOut,
    recentSlots: bySchedule,
    bySchedule: byScheduleSummary.map((r) => ({
      ...r,
      totalSlots: Number(r.totalSlots),
      fulfilledSlots: Number(r.fulfilledSlots),
      overdueSlots: Number(r.overdueSlots),
      openSlots: Number(r.openSlots),
      ratePct:
        Number(r.totalSlots) > 0
          ? Math.round(
              (Number(r.fulfilledSlots) / Number(r.totalSlots)) * 1000,
            ) / 10
          : null,
    })),
  };
}

/** Đồng bộ OPEN → OVERDUE theo ngày (gọi trước khi aggregate hoặc định kỳ) */
export async function refreshOverdueStatus() {
  const [result] = await getPool().query(
    `UPDATE ScheduledChecklistSlots
     SET Status = 'OVERDUE'
     WHERE Status = 'OPEN' AND DueDate < CURDATE()`,
  );
  return result.affectedRows;
}
