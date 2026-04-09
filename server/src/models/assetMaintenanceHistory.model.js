/**
 * assetMaintenanceHistory.model.js — Lịch sử bảo trì tài sản (WO hoàn thành).
 * Snapshot fieldNotes/partsNotes/technicianSummary/photoCount — hiển thị QR không cần mở WO.
 * Dùng trong: services/workOrderMaintenanceSync.service.js, assetCounter.controller (đọc).
 */
import { getPool } from '../config/database.js';

export async function create({
  assetId,
  workOrderId,
  scheduleId,
  woSource,
  completedDate,
  actualHours,
  totalRuntimeHours,
  description,
  fieldNotes,
  partsNotes,
  technicianSummary,
  photoCount,
}) {
  const [result] = await getPool().query(
    `INSERT INTO AssetMaintenanceHistory
      (AssetID, WorkOrderID, ScheduleID, WoSource, CompletedDate, ActualHours, TotalRuntimeHours, Description,
       FieldNotes, PartsNotes, TechnicianSummary, PhotoCount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      assetId,
      workOrderId ?? null,
      scheduleId ?? null,
      woSource,
      completedDate,
      actualHours ?? null,
      totalRuntimeHours ?? null,
      description ? String(description).slice(0, 500) : null,
      fieldNotes != null && String(fieldNotes).trim() !== ""
        ? String(fieldNotes).trim()
        : null,
      partsNotes != null && String(partsNotes).trim() !== ""
        ? String(partsNotes).trim()
        : null,
      technicianSummary != null && String(technicianSummary).trim() !== ""
        ? String(technicianSummary).trim().slice(0, 500)
        : null,
      photoCount != null && Number.isFinite(Number(photoCount))
        ? Number(photoCount)
        : null,
    ],
  );
  return result.insertId;
}

export async function findByAsset(assetId, limit = 80) {
  const [rows] = await getPool().query(
    `SELECT h.HistoryID AS historyId, h.WorkOrderID AS workOrderId, h.ScheduleID AS scheduleId,
            h.WoSource AS woSource, h.CompletedDate AS completedDate, h.ActualHours AS actualHours,
            h.TotalRuntimeHours AS totalRuntimeHours, h.Description AS description,
            h.FieldNotes AS fieldNotes, h.PartsNotes AS partsNotes,
            h.TechnicianSummary AS technicianSummary, h.PhotoCount AS photoCount,
            h.CreatedAt AS createdAt
     FROM AssetMaintenanceHistory h
     WHERE h.AssetID = ?
     ORDER BY h.CompletedDate DESC, h.HistoryID DESC
     LIMIT ?`,
    [assetId, limit],
  );
  return rows;
}
