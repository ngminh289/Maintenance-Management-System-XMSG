/**
 * digitalAsset.model.js — SQL thuần cho DigitalAssets + AssetVersions.
 * Dùng trong: services/digitalAsset.service.js.
 */
import { getPool } from '../config/database.js';

const COLS = `
  da.DigitalAssetID AS digitalAssetId,
  da.FileName       AS fileName,
  da.FileType       AS fileType,
  da.AssetID        AS assetId,
  a.AssetName       AS assetName,
  da.Description    AS description,
  da.UploadDate     AS uploadDate,
  da.UploadedBy     AS uploadedBy,
  e.FullName        AS uploaderName,
  da.CurrentVersion AS currentVersion,
  da.FilePath       AS filePath,
  da.FileSizeKB     AS fileSizeKB,
  da.Status         AS status`;

const BASE_JOIN = `
  FROM DigitalAssets da
  JOIN Employees e ON e.EmployeeID = da.UploadedBy
  LEFT JOIN Assets a ON a.AssetID = da.AssetID`;

export async function findAll({ status, assetId, tagId, uploadedBy, limit, offset } = {}) {
  const params = [];
  let join = BASE_JOIN;
  let where = 'WHERE 1=1';
  if (status)     { where += ' AND da.Status = ?';      params.push(status); }
  if (assetId)    { where += ' AND da.AssetID = ?';     params.push(assetId); }
  if (uploadedBy) { where += ' AND da.UploadedBy = ?';  params.push(uploadedBy); }
  if (tagId) {
    join += ' JOIN AssetTags at2 ON at2.DigitalAssetID = da.DigitalAssetID';
    where += ' AND at2.TagID = ?';
    params.push(tagId);
  }
  const pagination = limit != null ? 'LIMIT ? OFFSET ?' : '';
  if (limit != null) params.push(limit, offset);
  const [rows] = await getPool().query(
    `SELECT ${COLS} ${join} ${where} ORDER BY da.UploadDate DESC ${pagination}`, params,
  );
  return rows;
}

export async function count({ status, assetId, tagId, uploadedBy } = {}) {
  const params = [];
  let join = 'FROM DigitalAssets da';
  let where = 'WHERE 1=1';
  if (status)     { where += ' AND da.Status = ?';     params.push(status); }
  if (assetId)    { where += ' AND da.AssetID = ?';    params.push(assetId); }
  if (uploadedBy) { where += ' AND da.UploadedBy = ?'; params.push(uploadedBy); }
  if (tagId) {
    join += ' JOIN AssetTags at2 ON at2.DigitalAssetID = da.DigitalAssetID';
    where += ' AND at2.TagID = ?';
    params.push(tagId);
  }
  const [rows] = await getPool().query(`SELECT COUNT(*) AS cnt ${join} ${where}`, params);
  return Number(rows[0].cnt);
}

export async function findById(id) {
  const [rows] = await getPool().query(`SELECT ${COLS} ${BASE_JOIN} WHERE da.DigitalAssetID = ?`, [id]);
  return rows[0] || null;
}

export async function create({ fileName, fileType, assetId, description, uploadedBy, filePath, fileSizeKB }) {
  const [result] = await getPool().query(
    `INSERT INTO DigitalAssets (FileName, FileType, AssetID, Description, UploadedBy, FilePath, FileSizeKB)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [fileName, fileType, assetId || null, description || null, uploadedBy, filePath, fileSizeKB || null],
  );
  return result.insertId;
}

export async function update(id, { description, assetId }) {
  const sets = [];
  const params = [];
  if (description !== undefined) { sets.push('Description = ?'); params.push(description ?? null); }
  if (assetId !== undefined)     { sets.push('AssetID = ?');     params.push(assetId ?? null); }
  if (!sets.length) return 0;
  params.push(id);
  const [result] = await getPool().query(`UPDATE DigitalAssets SET ${sets.join(', ')} WHERE DigitalAssetID = ?`, params);
  return result.affectedRows;
}

export async function updateStatus(id, status) {
  await getPool().query('UPDATE DigitalAssets SET Status = ? WHERE DigitalAssetID = ?', [status, id]);
}

/** Lưu phiên bản mới + cập nhật FilePath, CurrentVersion */
export async function addVersion({ digitalAssetId, filePath, fileSizeKB, changedBy, changeNote }) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const [[cur]] = await conn.query(
      'SELECT CurrentVersion FROM DigitalAssets WHERE DigitalAssetID = ? FOR UPDATE',
      [digitalAssetId],
    );
    const newVer = (cur?.CurrentVersion ?? 0) + 1;
    await conn.query(
      'INSERT INTO AssetVersions (DigitalAssetID, VersionNumber, FilePath, ChangedBy, ChangeNote) VALUES (?, ?, ?, ?, ?)',
      [digitalAssetId, newVer, filePath, changedBy, changeNote || null],
    );
    await conn.query(
      'UPDATE DigitalAssets SET CurrentVersion = ?, FilePath = ?, FileSizeKB = ?, Status = ? WHERE DigitalAssetID = ?',
      [newVer, filePath, fileSizeKB || null, 'DRAFT', digitalAssetId],
    );
    await conn.commit();
    return newVer;
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
}

export async function getVersions(digitalAssetId) {
  const [rows] = await getPool().query(
    `SELECT av.VersionID AS versionId, av.VersionNumber AS versionNumber,
            av.FilePath AS filePath, av.ChangeDate AS changeDate,
            av.ChangeNote AS changeNote, e.FullName AS changedByName
     FROM AssetVersions av
     JOIN Employees e ON e.EmployeeID = av.ChangedBy
     WHERE av.DigitalAssetID = ? ORDER BY av.VersionNumber DESC`,
    [digitalAssetId],
  );
  return rows;
}

export async function remove(id) {
  const [result] = await getPool().query('DELETE FROM DigitalAssets WHERE DigitalAssetID = ?', [id]);
  return result.affectedRows;
}
