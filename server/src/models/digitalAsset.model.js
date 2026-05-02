/**
 * digitalAsset.model.js — SQL thuần cho DigitalAssets + AssetVersions.
 * DAM: mỗi tài liệu — v1 ghi vào AssetVersions ngay khi create; addVersion tăng số + lưu file mới.
 * UNIQUE (DigitalAssetID, VersionNumber); migration 036 backfill + ràng buộc.
 * Kho (draftPrivacy): APPROVED/ARCHIVED mọi người; DRAFT/REJECTED/PENDING chỉ chủ + Admin.
 * Người duyệt (Trưởng/Phó PKT) xem PENDING ở tab Phê duyệt, không phải mục Tài liệu số.
 * Dùng trong: services/digitalAsset.service.js.
 */
import { getPool } from '../config/database.js';

const COLS = `
  da.DigitalAssetID AS digitalAssetId,
  da.FileName       AS fileName,
  da.FileType       AS fileType,
  da.AssetID        AS assetId,
  a.AssetName       AS assetName,
  da.DocumentCategoryID AS documentCategoryId,
  dc.CategoryName   AS documentCategoryName,
  da.Description    AS description,
  da.UploadDate     AS uploadDate,
  da.UploadedBy     AS uploadedBy,
  e.FullName        AS uploaderName,
  da.CurrentVersion AS currentVersion,
  da.FilePath       AS filePath,
  da.FileSizeKB     AS fileSizeKB,
  da.Status         AS status,
  (SELECT al.Comment
   FROM ApprovalLogs al
   WHERE al.ResourceType = 'DIGITAL_ASSET' AND al.ResourceID = da.DigitalAssetID
     AND al.Status = 'REQUEST_CHANGES'
   ORDER BY al.ActionDate DESC LIMIT 1) AS lastReviseComment,
  (SELECT ev.FullName
   FROM ApprovalLogs al2
   JOIN Employees ev ON ev.EmployeeID = al2.ApproverID
   WHERE al2.ResourceType = 'DIGITAL_ASSET' AND al2.ResourceID = da.DigitalAssetID
     AND al2.Status = 'REQUEST_CHANGES'
   ORDER BY al2.ActionDate DESC LIMIT 1) AS lastReviserName`;

const BASE_JOIN = `
  FROM DigitalAssets da
  JOIN Employees e ON e.EmployeeID = da.UploadedBy
  LEFT JOIN Assets a ON a.AssetID = da.AssetID
  LEFT JOIN DocumentCategories dc ON dc.DocumentCategoryID = da.DocumentCategoryID`;

function buildListQuery(filters) {
  const {
    status,
    assetId,
    tagId,
    uploadedBy,
    documentCategoryId,
    q,
    draftPrivacy,
  } = filters;
  const params = [];
  let join = BASE_JOIN;
  let where = 'WHERE 1=1';
  if (status) {
    where += ' AND da.Status = ?';
    params.push(status);
  }
  if (assetId) {
    where += ' AND da.AssetID = ?';
    params.push(assetId);
  }
  if (uploadedBy) {
    where += ' AND da.UploadedBy = ?';
    params.push(uploadedBy);
  }
  if (documentCategoryId != null && documentCategoryId !== '') {
    where += ' AND da.DocumentCategoryID = ?';
    params.push(Number(documentCategoryId));
  }
  if (tagId) {
    join += ' JOIN AssetTags at2 ON at2.DigitalAssetID = da.DigitalAssetID';
    where += ' AND at2.TagID = ?';
    params.push(tagId);
  }
  const qTrim = q != null ? String(q).trim() : '';
  if (qTrim) {
    const like = `%${qTrim}%`;
    where += ` AND (
      da.FileName LIKE ? OR da.Description LIKE ? OR IFNULL(a.AssetName,'') LIKE ? OR e.FullName LIKE ?
      OR IFNULL(dc.CategoryName,'') LIKE ?
      OR EXISTS (
        SELECT 1 FROM AssetTags atq
        JOIN Tags tq ON tq.TagID = atq.TagID
        WHERE atq.DigitalAssetID = da.DigitalAssetID AND tq.TagName LIKE ?
      )
    )`;
    params.push(like, like, like, like, like, like);
  }
  if (draftPrivacy && Number.isFinite(Number(draftPrivacy.viewerEmployeeId))) {
    const isAdmin = draftPrivacy.isAdmin ? 1 : 0;
    const vid = Number(draftPrivacy.viewerEmployeeId);
    where += ` AND (
      da.Status IN ('APPROVED', 'ARCHIVED')
      OR ? = 1
      OR (da.Status IN ('DRAFT', 'REJECTED', 'PENDING') AND da.UploadedBy = ?)
    )`;
    params.push(isAdmin, vid);
  }
  return { join, where, params };
}

/** Tra cứu tài liệu theo basename file (GET /uploads/documents/:filename) — ghi view-log. */
export async function findDigitalAssetIdByDocumentBasename(basename) {
  const bn = basename != null ? String(basename).trim() : '';
  if (!bn) return null;
  const likeEnd = `%/${bn}`;
  const likeWin = `%\\\\${bn}`;
  const likeUploads = `uploads/documents/${bn}`;
  const likeUrlTail = `%/${bn}`;
  const [rows] = await getPool().query(
    `SELECT da.DigitalAssetID AS id
     FROM DigitalAssets da
     WHERE da.FilePath = ? OR da.FilePath LIKE ? OR da.FilePath LIKE ? OR da.FilePath = ?
        OR (da.FilePath LIKE 'http%' AND da.FilePath LIKE ?)
     LIMIT 1`,
    [bn, likeEnd, likeWin, likeUploads, likeUrlTail],
  );
  return rows[0]?.id ?? null;
}

/** Lấy FilePath để redirect Cloudinary hoặc đọc file local (legacy). */
export async function findDocumentPathByBasename(basename) {
  const bn = basename != null ? String(basename).trim() : '';
  if (!bn) return null;
  const likeEnd = `%/${bn}`;
  const likeWin = `%\\\\${bn}`;
  const likeUploads = `uploads/documents/${bn}`;
  const likeUrlTail = `%/${bn}`;
  const [rows] = await getPool().query(
    `SELECT da.FilePath AS filePath
     FROM DigitalAssets da
     WHERE da.FilePath = ? OR da.FilePath LIKE ? OR da.FilePath LIKE ? OR da.FilePath = ?
        OR (da.FilePath LIKE 'http%' AND da.FilePath LIKE ?)
     LIMIT 1`,
    [bn, likeEnd, likeWin, likeUploads, likeUrlTail],
  );
  return rows[0]?.filePath ?? null;
}

export async function findAll(filters = {}) {
  const { limit, offset } = filters;
  const { join, where, params } = buildListQuery(filters);
  const pagination = limit != null ? 'LIMIT ? OFFSET ?' : '';
  const listParams = [...params];
  if (limit != null) listParams.push(limit, offset);
  const [rows] = await getPool().query(
    `SELECT ${COLS} ${join} ${where} ORDER BY da.UploadDate DESC ${pagination}`,
    listParams,
  );
  return rows;
}

export async function count(filters = {}) {
  const { join, where, params } = buildListQuery(filters);
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS cnt ${join} ${where}`,
    params,
  );
  return Number(rows[0].cnt);
}

export async function findById(id) {
  const [rows] = await getPool().query(
    `SELECT ${COLS} ${BASE_JOIN} WHERE da.DigitalAssetID = ?`,
    [id],
  );
  return rows[0] || null;
}

export async function create({
  fileName,
  fileType,
  assetId,
  documentCategoryId,
  description,
  uploadedBy,
  filePath,
  fileSizeKB,
}) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO DigitalAssets (FileName, FileType, AssetID, DocumentCategoryID, Description, UploadedBy, FilePath, FileSizeKB)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fileName,
        fileType,
        assetId || null,
        documentCategoryId != null && documentCategoryId !== '' ? Number(documentCategoryId) : null,
        description || null,
        uploadedBy,
        filePath,
        fileSizeKB || null,
      ],
    );
    const id = result.insertId;
    await conn.query(
      `INSERT INTO AssetVersions (DigitalAssetID, VersionNumber, FilePath, ChangedBy, ChangeNote)
       VALUES (?, 1, ?, ?, NULL)`,
      [id, filePath, uploadedBy],
    );
    await conn.commit();
    return id;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function update(id, { description, assetId, documentCategoryId }) {
  const sets = [];
  const params = [];
  if (description !== undefined) {
    sets.push('Description = ?');
    params.push(description ?? null);
  }
  if (assetId !== undefined) {
    sets.push('AssetID = ?');
    params.push(assetId ?? null);
  }
  if (documentCategoryId !== undefined) {
    sets.push('DocumentCategoryID = ?');
    const v = documentCategoryId;
    params.push(v === null || v === '' ? null : Number(v));
  }
  if (!sets.length) return 0;
  params.push(id);
  const [result] = await getPool().query(
    `UPDATE DigitalAssets SET ${sets.join(', ')} WHERE DigitalAssetID = ?`,
    params,
  );
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
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
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
