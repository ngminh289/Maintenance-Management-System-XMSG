/**
 * documentFeedback.model.js — SQL cho DigitalAssetFeedback (góp ý / phản hồi tài liệu).
 * NV KT xem toàn bộ theo tài sản; người khác chỉ thấy phản hồi do mình gửi.
 * Liên quan: services/documentFeedback.service.js, migration 038.
 */
import { getPool } from '../config/database.js';

const ROW_SELECT = `
  f.FeedbackID       AS feedbackId,
  f.DigitalAssetID   AS digitalAssetId,
  f.CreatedBy        AS createdBy,
  ea.FullName        AS authorName,
  f.Body             AS body,
  f.Status           AS status,
  f.ReviewNote       AS reviewNote,
  f.ReviewedBy       AS reviewedBy,
  er.FullName        AS reviewerName,
  f.ReviewedAt       AS reviewedAt,
  f.CreatedAt        AS createdAt
`;

export async function insert({ digitalAssetId, createdBy, body }) {
  const [r] = await getPool().query(
    `INSERT INTO DigitalAssetFeedback (DigitalAssetID, CreatedBy, Body)
     VALUES (?, ?, ?)`,
    [digitalAssetId, createdBy, body],
  );
  return r.insertId;
}

export async function findById(feedbackId) {
  const [rows] = await getPool().query(
    `SELECT ${ROW_SELECT}
     FROM DigitalAssetFeedback f
     JOIN Employees ea ON ea.EmployeeID = f.CreatedBy
     LEFT JOIN Employees er ON er.EmployeeID = f.ReviewedBy
     WHERE f.FeedbackID = ?`,
    [feedbackId],
  );
  return rows[0] || null;
}

export async function listByAsset(digitalAssetId, { viewerEmployeeId, reviewerViewAll }) {
  const params = [digitalAssetId];
  let extra = '';
  if (!reviewerViewAll) {
    extra = ' AND f.CreatedBy = ?';
    params.push(viewerEmployeeId);
  }
  const [rows] = await getPool().query(
    `SELECT ${ROW_SELECT}
     FROM DigitalAssetFeedback f
     JOIN Employees ea ON ea.EmployeeID = f.CreatedBy
     LEFT JOIN Employees er ON er.EmployeeID = f.ReviewedBy
     WHERE f.DigitalAssetID = ? ${extra}
     ORDER BY f.CreatedAt DESC`,
    params,
  );
  return rows;
}

export async function listInbox({ status, limit, offset }) {
  const params = [];
  let where = 'WHERE 1=1';
  if (status) {
    where += ' AND f.Status = ?';
    params.push(status);
  }
  params.push(limit, offset);
  const [rows] = await getPool().query(
    `SELECT ${ROW_SELECT},
            da.FileName AS fileName,
            da.FilePath AS filePath,
            da.Status   AS documentStatus
     FROM DigitalAssetFeedback f
     JOIN DigitalAssets da ON da.DigitalAssetID = f.DigitalAssetID
     JOIN Employees ea ON ea.EmployeeID = f.CreatedBy
     LEFT JOIN Employees er ON er.EmployeeID = f.ReviewedBy
     ${where}
     ORDER BY f.CreatedAt DESC
     LIMIT ? OFFSET ?`,
    params,
  );
  return rows;
}

export async function countInbox({ status }) {
  const params = [];
  let where = 'WHERE 1=1';
  if (status) {
    where += ' AND f.Status = ?';
    params.push(status);
  }
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS cnt FROM DigitalAssetFeedback f ${where}`,
    params,
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function updateReview(feedbackId, { status, reviewNote, reviewedBy }) {
  await getPool().query(
    `UPDATE DigitalAssetFeedback
     SET Status = ?, ReviewNote = ?, ReviewedBy = ?, ReviewedAt = NOW()
     WHERE FeedbackID = ?`,
    [status, reviewNote ?? null, reviewedBy, feedbackId],
  );
}
