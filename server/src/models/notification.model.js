/**
 * notification.model.js — SQL thuần cho bảng Notifications.
 * Dùng trong: services/notification.service.js.
 */
import { getPool } from '../config/database.js';

const COLS = `NotiID AS notiId, RecipientID AS recipientId, Message AS message,
              Type AS type, IsRead AS isRead, CreatedAt AS createdAt`;

export async function create({ recipientId, message, type = 'SYSTEM_ALERT' }) {
  const [result] = await getPool().query(
    'INSERT INTO Notifications (RecipientID, Message, Type) VALUES (?, ?, ?)',
    [recipientId, message, type],
  );
  return result.insertId;
}

export async function findByRecipient(recipientId, { onlyUnread = false, limit = 50, offset = 0 } = {}) {
  const where = onlyUnread ? 'AND IsRead = FALSE' : '';
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
