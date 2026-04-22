/**
 * digitalAssetViewLog.model.js — Ghi nhận mở file tài liệu (POST /digital-assets/:id/view-log, GET /uploads/documents có JWT).
 * Phục vụ báo cáo: tần suất truy cập, tài liệu "hot".
 * Liên quan: digitalAsset.controller.js, uploadsDocuments.route.js, stats.controller.js.
 */
import { getPool } from '../config/database.js';

/**
 * @param {object} p
 * @param {number} p.digitalAssetId
 * @param {number} p.employeeId
 */
export async function insert(p) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO DigitalAssetViewLogs (DigitalAssetID, EmployeeID) VALUES (?, ?)`,
    [p.digitalAssetId, p.employeeId],
  );
}
