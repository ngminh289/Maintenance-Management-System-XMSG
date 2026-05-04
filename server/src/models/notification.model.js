/**
 * notification.model.js — SQL thuần cho bảng Notifications.
 * ResourceType + ResourceID (migration 049): cho phép frontend navigate đến link.
 * Dùng trong: services/notification.service.js.
 */
import { getPool } from '../config/database.js';

const COLS = `NotiID AS notiId, RecipientID AS recipientId, Message AS message,
              Type AS type, ResourceType AS resourceType, ResourceID AS resourceId,
              IsRead AS isRead, CreatedAt AS createdAt`;

export async function create({ recipientId, message, type = 'SYSTEM_ALERT', resourceType = null, resourceId = null }) {
  const [result] = await getPool().query(
    'INSERT INTO Notifications (RecipientID, Message, Type, ResourceType, ResourceID) VALUES (?, ?, ?, ?, ?)',
    [recipientId, message, type, resourceType, resourceId],
  );
  return result.insertId;
}

export async function findByRecipient(
  recipientId,
  { onlyUnread = false, read = null, limit = 50, offset = 0 } = {},
) {
  const where = read === true
    ? "AND IsRead = TRUE"
    : (onlyUnread || read === false ? "AND IsRead = FALSE" : "");
  const [rows] = await getPool().query(
    `SELECT ${COLS} FROM Notifications
     WHERE RecipientID = ? ${where}
     ORDER BY CreatedAt DESC LIMIT ? OFFSET ?`,
    [recipientId, limit, offset],
  );
  return rows;
}

export async function countUnread(recipientId) {
  const [rows] = await getPool().query(
    'SELECT COUNT(*) AS cnt FROM Notifications WHERE RecipientID = ? AND IsRead = FALSE',
    [recipientId],
  );
  return Number(rows[0].cnt);
}

export async function countByRecipient(
  recipientId,
  { onlyUnread = false, read = null } = {},
) {
  const where = read === true
    ? "AND IsRead = TRUE"
    : (onlyUnread || read === false ? "AND IsRead = FALSE" : "");
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS cnt FROM Notifications WHERE RecipientID = ? ${where}`,
    [recipientId],
  );
  return Number(rows[0].cnt);
}

export async function markRead(notiId, recipientId) {
  const [result] = await getPool().query(
    'UPDATE Notifications SET IsRead = TRUE WHERE NotiID = ? AND RecipientID = ?',
    [notiId, recipientId],
  );
  return result.affectedRows;
}

export async function markAllRead(recipientId) {
  const [result] = await getPool().query(
    'UPDATE Notifications SET IsRead = TRUE WHERE RecipientID = ? AND IsRead = FALSE',
    [recipientId],
  );
  return result.affectedRows;
}

export async function markUnread(notiId, recipientId) {
  const [result] = await getPool().query(
    "UPDATE Notifications SET IsRead = FALSE WHERE NotiID = ? AND RecipientID = ?",
    [notiId, recipientId],
  );
  return result.affectedRows;
}

export async function markAllUnread(recipientId) {
  const [result] = await getPool().query(
    "UPDATE Notifications SET IsRead = FALSE WHERE RecipientID = ? AND IsRead = TRUE",
    [recipientId],
  );
  return result.affectedRows;
}
