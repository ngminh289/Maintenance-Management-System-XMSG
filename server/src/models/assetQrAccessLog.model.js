/**
 * assetQrAccessLog.model.js — Ghi mỗi lần user tải thông tin QR / checklist (getQRInfo).
 * Phục vụ báo cáo: lượt mở màn hình tại hiện trường theo tài sản, nhân sự, thời gian.
 * Liên quan: services/checklist.service.js, controllers/stats.controller.js.
 */
import { getPool } from '../config/database.js';

/**
 * @param {object} p
 * @param {number} p.assetId
 * @param {number} p.employeeId
 */
export async function insert(p) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO AssetQrAccessLogs (AssetID, EmployeeID) VALUES (?, ?)`,
    [p.assetId, p.employeeId],
  );
}
