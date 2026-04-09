/**
 * assetCounter.model.js — SQL thuần cho AssetCounters + AssetRuntimeLogs.
 * Dùng trong: services/assetCounter.service.js (luồng dự báo bảo trì giờ chạy).
 */
import { getPool } from "../config/database.js";

export async function findByAsset(assetId) {
  const [rows] = await getPool().query(
    `SELECT AssetID AS assetId, TotalAccumulatedHours AS totalAccumulatedHours,
            LastReadingValue AS lastReadingValue, AverageHoursPerDay AS averageHoursPerDay,
            EstimatedNextPMDate AS estimatedNextPMDate, LastMaintenanceTotal AS lastMaintenanceTotal,
            LastUpdated AS lastUpdated
     FROM AssetCounters WHERE AssetID = ?`,
    [assetId],
  );
  return rows[0] || null;
}

export async function upsert(
  assetId,
  {
    totalAccumulatedHours,
    lastReadingValue,
    averageHoursPerDay,
    estimatedNextPMDate,
    lastMaintenanceTotal,
  },
) {
  await getPool().query(
    `INSERT INTO AssetCounters (AssetID, TotalAccumulatedHours, LastReadingValue, AverageHoursPerDay, EstimatedNextPMDate, LastMaintenanceTotal)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       TotalAccumulatedHours = VALUES(TotalAccumulatedHours),
       LastReadingValue      = VALUES(LastReadingValue),
       AverageHoursPerDay    = VALUES(AverageHoursPerDay),
       EstimatedNextPMDate   = VALUES(EstimatedNextPMDate),
       LastMaintenanceTotal  = IF(VALUES(LastMaintenanceTotal) IS NOT NULL, VALUES(LastMaintenanceTotal), LastMaintenanceTotal)`,
    [
      assetId,
      totalAccumulatedHours,
      lastReadingValue,
      averageHoursPerDay ?? 0,
      estimatedNextPMDate ?? null,
      lastMaintenanceTotal ?? null,
    ],
  );
}

export async function setLastMaintenanceTotal(assetId, total) {
  await getPool().query(
    "UPDATE AssetCounters SET LastMaintenanceTotal = ? WHERE AssetID = ?",
    [total, assetId],
  );
}

export async function createRuntimeLog({
  assetId,
  readingValue,
  deltaHours,
  checklistId,
  dataSource = "MANUAL",
}) {
  const [result] = await getPool().query(
    `INSERT INTO AssetRuntimeLogs (AssetID, ReadingValue, DeltaHours, ChecklistID, DataSource)
     VALUES (?, ?, ?, ?, ?)`,
    [assetId, readingValue, deltaHours, checklistId || null, dataSource],
  );
  return result.insertId;
}

/** Tổng DeltaHours trong N ngày gần nhất để tính tốc độ trung bình */
export async function sumDeltaHoursLastDays(assetId, days = 30) {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(DeltaHours), 0) AS total,
            DATEDIFF(NOW(), MIN(CaptureTime)) AS actualDays
     FROM AssetRuntimeLogs
     WHERE AssetID = ? AND CaptureTime >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [assetId, days],
  );
  return rows[0];
}

export async function getHistory(assetId, limit = 30) {
  const [rows] = await getPool().query(
    `SELECT LogID AS logId, ReadingValue AS readingValue, DeltaHours AS deltaHours,
            DataSource AS dataSource, CaptureTime AS captureTime
     FROM AssetRuntimeLogs WHERE AssetID = ? ORDER BY CaptureTime DESC LIMIT ?`,
    [assetId, limit],
  );
  return rows;
}
