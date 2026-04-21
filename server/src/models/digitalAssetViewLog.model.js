/**
 * digitalAssetViewLog.model.js — Mỗi lần user mở file tài liệu từ checklist (POST view-log).
 * Phục vụ báo cáo: tần suất truy cập, tài liệu "hot".
 * Liên quan: controllers/digitalAsset.controller.js, stats.controller.js.
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
