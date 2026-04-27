/**
 * assetDowntimeEvent.model.js — SQL thuần cho bảng AssetDowntimeEvents.
 * Dùng để ghi planned/unplanned downtime với mốc bắt đầu-kết thúc chuẩn.
 * Liên quan: services/asset.service.js, services/workOrder.service.js, controllers/stats.controller.js.
 */
import { getPool } from "../config/database.js";

export async function createEvent({
  assetId,
  downtimeType,
  workOrderId = null,
  source,
  reason = null,
  createdBy = null,
  startAt = new Date(),
}) {
  const [result] = await getPool().query(
    `INSERT INTO AssetDowntimeEvents
      (AssetID, DowntimeType, WorkOrderID, StartAt, Source, Reason, CreatedBy)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [assetId, downtimeType, workOrderId, startAt, source, reason, createdBy],
  );
  return result.insertId;
}

export async function findOpenByWorkOrder(workOrderId) {
  const [rows] = await getPool().query(
    `SELECT
       EventID AS eventId,
       AssetID AS assetId,
       DowntimeType AS downtimeType,
       WorkOrderID AS workOrderId,
       StartAt AS startAt,
       Source AS source,
       Reason AS reason
     FROM AssetDowntimeEvents
     WHERE WorkOrderID = ? AND EndAt IS NULL
     ORDER BY EventID DESC
     LIMIT 1`,
    [workOrderId],
  );
  return rows[0] || null;
}

export async function findOpenByAssetAndType(assetId, downtimeType) {
  const [rows] = await getPool().query(
    `SELECT
       EventID AS eventId,
       AssetID AS assetId,
       DowntimeType AS downtimeType,
       WorkOrderID AS workOrderId,
       StartAt AS startAt,
       Source AS source,
       Reason AS reason
     FROM AssetDowntimeEvents
     WHERE AssetID = ? AND DowntimeType = ? AND EndAt IS NULL
     ORDER BY EventID DESC
     LIMIT 1`,
    [assetId, downtimeType],
  );
  return rows[0] || null;
}

export async function closeEvent(eventId, endAt = new Date()) {
  await getPool().query(
    `UPDATE AssetDowntimeEvents
     SET EndAt = ?, DurationHours = ROUND(TIMESTAMPDIFF(SECOND, StartAt, ?) / 3600, 4)
     WHERE EventID = ? AND EndAt IS NULL`,
    [endAt, endAt, eventId],
  );
}
