/**
 * assetPhoto.model.js — Ảnh tài sản thiết bị (nhiều ảnh / tài sản).
 * Dùng trong: services/asset.service.js.
 * Liên quan: migrations/042_asset_photos.sql, config/upload.js (UPLOAD_ASSET_DIR)
 */
import { getPool } from '../config/database.js';

export async function listByAsset(assetId) {
  const [rows] = await getPool().query(
    `SELECT p.PhotoID    AS photoId,
            p.AssetID    AS assetId,
            p.FilePath   AS filePath,
            p.Caption    AS caption,
            p.UploadedBy AS uploadedBy,
            e.FullName   AS uploadedByName,
            p.CreatedAt  AS createdAt
     FROM AssetPhotos p
     LEFT JOIN Employees e ON e.EmployeeID = p.UploadedBy
     WHERE p.AssetID = ?
     ORDER BY p.PhotoID ASC`,
    [assetId],
  );
  return rows;
}

export async function findById(photoId) {
  const [rows] = await getPool().query(
    `SELECT PhotoID AS photoId, AssetID AS assetId,
            FilePath AS filePath, UploadedBy AS uploadedBy
     FROM AssetPhotos WHERE PhotoID = ?`,
    [photoId],
  );
  return rows[0] || null;
}

export async function insert(assetId, filePath, caption, uploadedBy) {
  const [r] = await getPool().query(
    'INSERT INTO AssetPhotos (AssetID, FilePath, Caption, UploadedBy) VALUES (?, ?, ?, ?)',
    [assetId, filePath, caption ?? null, uploadedBy ?? null],
  );
  return r.insertId;
}

export async function remove(photoId) {
  const [r] = await getPool().query(
    'DELETE FROM AssetPhotos WHERE PhotoID = ?',
    [photoId],
  );
  return r.affectedRows;
}
