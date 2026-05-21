/**
 * scheduledChecklistSlot.model.js — SQL cho ScheduledChecklistSlots.
 * Mỗi slot = một lượt checklist bắt buộc gắn WO sinh từ lịch (mỗi TemplateID một slot).
 * Liên quan: maintenanceSchedule.service.js, checklist.service.js, stats.controller.js.
 */
import { getPool } from '../config/database.js';
import * as scheduleTemplateModel from './maintenanceScheduleChecklistTemplate.model.js';

const SLOT_SELECT = `
  SELECT s.SlotID AS slotId,
         s.ScheduleID AS scheduleId,
         s.AssetID AS assetId,
         s.DueDate AS dueDate,
         s.WorkOrderID AS workOrderId,
         s.TemplateID AS templateId,
         ct.TemplateName AS templateName,
         s.ChecklistID AS checklistId,
         s.FulfilledAt AS fulfilledAt,
         s.Status AS status
  FROM ScheduledChecklistSlots s
  LEFT JOIN ChecklistTemplates ct ON ct.TemplateID = s.TemplateID`;

/**
 * Tạo slot khi generateWorkOrder từ lịch. INSERT IGNORE tránh trùng nếu gọi lặp.
 * @deprecated Dùng insertSlotsForWorkOrder khi lịch có nhiều mẫu.
 */
export async function insertForScheduleWorkOrder({
  scheduleId,
  assetId,
  dueDate,
  workOrderId,
  templateId = null,
}) {
  const [result] = await getPool().query(
    `INSERT IGNORE INTO ScheduledChecklistSlots (ScheduleID, AssetID, DueDate, WorkOrderID, TemplateID, Status)
     VALUES (?, ?, ?, ?, ?, 'OPEN')`,
    [scheduleId, assetId, dueDate, workOrderId, templateId],
  );
  return result.affectedRows;
}

/** DB đã có unique (WorkOrderID, TemplateID) sau migration 074. */
export async function supportsMultipleSlotsPerWorkOrder() {
  const [rows] = await getPool().query(
    `SELECT 1 AS ok
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'ScheduledChecklistSlots'
       AND INDEX_NAME = 'uq_slot_work_order_template'
     LIMIT 1`,
  );
  return rows.length > 0;
}

/** INSERT một slot (không IGNORE) — dùng khi INSERT IGNORE không tạo được dòng thứ hai. */
async function insertSlotStrict({
  scheduleId,
  assetId,
  dueDate,
  workOrderId,
  templateId,
}) {
  try {
    const [result] = await getPool().query(
      `INSERT INTO ScheduledChecklistSlots (ScheduleID, AssetID, DueDate, WorkOrderID, TemplateID, Status)
       VALUES (?, ?, ?, ?, ?, 'OPEN')`,
      [scheduleId, assetId, dueDate, workOrderId, templateId],
    );
    return result.affectedRows;
  } catch (err) {
    if (err?.code === "ER_DUP_ENTRY") return 0;
    throw err;
  }
}

/** Tạo một slot cho mỗi templateId; bỏ qua nếu templateIds rỗng. */
export async function insertSlotsForWorkOrder({
  scheduleId,
  assetId,
  dueDate,
  workOrderId,
  templateIds = [],
}) {
  const ids = [...new Set(
    (templateIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0),
  )];
  if (!ids.length) return 0;
  let total = 0;
  for (const templateId of ids) {
    total += await insertForScheduleWorkOrder({
      scheduleId,
      assetId,
      dueDate,
      workOrderId,
      templateId,
    });
  }
  return total;
}

/**
 * Đồng bộ slot theo junction lịch — INSERT IGNORE + sửa slot legacy (TemplateID NULL).
 * Nguồn sự thật cho WO, nộp checklist và aggregateCompliance (báo cáo).
 */
export async function ensureSlotsForWorkOrder({
  scheduleId,
  assetId,
  workOrderId,
  dueDate,
  templateIds: templateIdsIn,
}) {
  const templateRows =
    templateIdsIn != null
      ? templateIdsIn.map((id, i) => ({ templateId: Number(id), sortOrder: i }))
      : await scheduleTemplateModel.listByScheduleId(scheduleId);

  const templateIds = [
    ...new Set(
      templateRows
        .map((r) => Number(r.templateId))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  if (!templateIds.length) return 0;

  const pool = getPool();
  let existing = await findAllByWorkOrderId(workOrderId);
  let changed = 0;

  const hasTemplate = (tid) =>
    existing.some((s) => Number(s.templateId) === Number(tid));

  // Legacy: một dòng / WO, TemplateID NULL — gán lần lượt mẫu còn thiếu
  for (const slot of existing.filter((s) => s.templateId == null)) {
    const missing = templateIds.find((tid) => !hasTemplate(tid));
    if (!missing) continue;
    const [result] = await pool.query(
      `UPDATE ScheduledChecklistSlots
       SET TemplateID = ?
       WHERE SlotID = ? AND TemplateID IS NULL
         AND Status IN ('OPEN', 'OVERDUE')`,
      [missing, slot.slotId],
    );
    if (result.affectedRows) {
      changed += result.affectedRows;
      existing = await findAllByWorkOrderId(workOrderId);
    }
  }

  for (const templateId of templateIds) {
    if (hasTemplate(templateId)) continue;
    const inserted = await insertForScheduleWorkOrder({
      scheduleId,
      assetId,
      dueDate,
      workOrderId,
      templateId,
    });
    if (inserted > 0) {
      changed += inserted;
      existing = await findAllByWorkOrderId(workOrderId);
      continue;
    }

    const strict = await insertSlotStrict({
      scheduleId,
      assetId,
      dueDate,
      workOrderId,
      templateId,
    });
    if (strict > 0) {
      changed += strict;
      existing = await findAllByWorkOrderId(workOrderId);
    }
  }

  return changed;
}

/** Còn thiếu template nào trên WO sau ensure. */
export async function listMissingTemplateIdsForWorkOrder(scheduleId, workOrderId) {
  const templateIds = await scheduleTemplateModel.listTemplateIdsByScheduleId(
    scheduleId,
  );
  const slots = await findAllByWorkOrderId(workOrderId);
  const present = new Set(
    slots.map((s) => Number(s.templateId)).filter((id) => Number.isFinite(id)),
  );
  return templateIds.filter((tid) => !present.has(tid));
}

/** Lấy slot requirement theo phiếu việc (một bản ghi — tương thích cũ). */
export async function findByWorkOrderId(workOrderId) {
  const [rows] = await getPool().query(
    `${SLOT_SELECT}
     WHERE s.WorkOrderID = ?
     ORDER BY s.SlotID ASC
     LIMIT 1`,
    [workOrderId],
  );
  return rows[0] || null;
}

/** Tất cả slot checklist gắn một phiếu. */
export async function findAllByWorkOrderId(workOrderId) {
  const [rows] = await getPool().query(
    `${SLOT_SELECT}
     WHERE s.WorkOrderID = ?
     ORDER BY s.TemplateID ASC, s.SlotID ASC`,
    [workOrderId],
  );
  return rows;
}

/** Slot OPEN/OVERDUE cho WO + template cụ thể. */
export async function findOpenByWorkOrderAndTemplate(workOrderId, templateId) {
  const tid = Number(templateId);
  if (!Number.isFinite(tid) || tid < 1) return null;
  const [rows] = await getPool().query(
    `${SLOT_SELECT}
     WHERE s.WorkOrderID = ? AND s.TemplateID = ? AND s.Status IN ('OPEN', 'OVERDUE')
     LIMIT 1`,
    [workOrderId, tid],
  );
  return rows[0] || null;
}

/**
 * Đánh dấu hoàn thành khi checklist được duyệt APPROVE và khớp WO slot + template.
 */
export async function fulfillByWorkOrderAndTemplate(workOrderId, templateId, checklistId) {
  const tid = Number(templateId);
  if (!Number.isFinite(tid) || tid < 1) {
    return fulfillByWorkOrder(workOrderId, checklistId);
  }
  const [result] = await getPool().query(
    `UPDATE ScheduledChecklistSlots
     SET ChecklistID = ?, FulfilledAt = NOW(), Status = 'FULFILLED'
     WHERE WorkOrderID = ? AND TemplateID = ? AND Status IN ('OPEN', 'OVERDUE')`,
    [checklistId, workOrderId, tid],
  );
  return result.affectedRows;
}

/**
 * Đánh dấu hoàn thành (legacy: một slot / WO không có TemplateID).
 */
export async function fulfillByWorkOrder(workOrderId, checklistId) {
  const [result] = await getPool().query(
    `UPDATE ScheduledChecklistSlots
     SET ChecklistID = ?, FulfilledAt = NOW(), Status = 'FULFILLED'
     WHERE WorkOrderID = ? AND Status IN ('OPEN', 'OVERDUE')
     LIMIT 1`,
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
       s.TemplateID AS templateId,
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
