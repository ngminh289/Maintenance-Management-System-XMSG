/**
 * assetMaintenanceHistory.model.js — Lịch sử bảo trì tài sản (WO hoàn thành).
 * Dùng trong: services/workOrderMaintenanceSync.service.js, assetCounter.controller (đọc).
 */
import { getPool } from '../config/database.js';

export async function create({
  assetId, workOrderId, scheduleId, woSource, completedDate, actualHours, totalRuntimeHours, description,
}) {
  const [result] = await getPool().query(
    `INSERT INTO AssetMaintenanceHistory
      (AssetID, WorkOrderID, ScheduleID, WoSource, CompletedDate, ActualHours, TotalRuntimeHours, Description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      assetId,
      workOrderId ?? null,
      scheduleId ?? null,
      woSource,
      completedDate,
      actualHours ?? null,
      totalRuntimeHours ?? null,
      description ? String(description).slice(0, 500) : null,
    ],
  );
  return result.insertId;
}

export async function findByAsset(assetId, limit = 80) {
  const [rows] = await getPool().query(
    `SELECT h.HistoryID AS historyId, h.WorkOrderID AS workOrderId, h.ScheduleID AS scheduleId,
            h.WoSource AS woSource, h.CompletedDate AS completedDate, h.ActualHours AS actualHours,
            h.TotalRuntimeHours AS totalRuntimeHours, h.Description AS description, h.CreatedAt AS createdAt
     FROM AssetMaintenanceHistory h
     WHERE h.AssetID = ?
     ORDER BY h.CompletedDate DESC, h.HistoryID DESC
     LIMIT ?`,
    [assetId, limit],
  );
  return rows;
}
