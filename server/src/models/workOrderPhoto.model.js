/**
 * workOrderPhoto.model.js — Ảnh hiện trường đính kèm phiếu công việc (nhiều ảnh / WO).
 * countByWorkOrder: snapshot lịch sử bảo trì khi đóng WO.
 * Dùng trong: workOrder.service.js, workOrderMaintenanceSync.service.js.
 */
import { getPool } from '../config/database.js';

export async function countByWorkOrder(woId) {
  const [rows] = await getPool().query(
    "SELECT COUNT(*) AS c FROM WorkOrderPhotos WHERE WO_ID = ?",
    [woId],
  );
  return Number(rows[0]?.c ?? 0);
}

export async function listByWo(woId) {
  const [rows] = await getPool().query(
    `SELECT p.PhotoID AS photoId, p.FilePath AS filePath, p.UploadedBy AS uploadedBy,
            e.FullName AS uploadedByName, p.CreatedAt AS createdAt
     FROM WorkOrderPhotos p
     LEFT JOIN Employees e ON e.EmployeeID = p.UploadedBy
     WHERE p.WO_ID = ?
     ORDER BY p.PhotoID ASC`,
    [woId],
  );
  return rows;
}

export async function findById(photoId) {
  const [rows] = await getPool().query(
    `SELECT PhotoID AS photoId, WO_ID AS woId, FilePath AS filePath, UploadedBy AS uploadedBy
     FROM WorkOrderPhotos WHERE PhotoID = ?`,
    [photoId],
  );
  return rows[0] || null;
}

export async function insertRow(woId, filePath, uploadedBy) {
  const [r] = await getPool().query(
    'INSERT INTO WorkOrderPhotos (WO_ID, FilePath, UploadedBy) VALUES (?, ?, ?)',
    [woId, filePath, uploadedBy ?? null],
  );
  return r.insertId;
}

export async function remove(photoId) {
  const [r] = await getPool().query('DELETE FROM WorkOrderPhotos WHERE PhotoID = ?', [photoId]);
  return r.affectedRows;
}
