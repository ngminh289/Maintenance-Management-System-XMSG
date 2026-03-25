/**
 * auditLog.model.js — SQL thuần cho bảng AuditLogs.
 * Dùng trong: services/auditLog.service.js, utils/audit.js.
 */
import { getPool } from '../config/database.js';

export async function log({ employeeId, action, tableName, recordId, oldValue, newValue }) {
  await getPool().query(
    'INSERT INTO AuditLogs (EmployeeID, Action, TableName, RecordID, OldValue, NewValue) VALUES (?, ?, ?, ?, ?, ?)',
    [employeeId, action, tableName, recordId || null,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null],
  );
}

export async function findAll({ employeeId, action, tableName, from, to, limit, offset } = {}) {
  const params = [];
  let where = 'WHERE 1=1';
  if (employeeId) { where += ' AND al.EmployeeID = ?';  params.push(employeeId); }
  if (action)     { where += ' AND al.Action = ?';      params.push(action); }
  if (tableName)  { where += ' AND al.TableName = ?';   params.push(tableName); }
  if (from)       { where += ' AND al.Timestamp >= ?';  params.push(from); }
  if (to)         { where += ' AND al.Timestamp <= ?';  params.push(to); }
  const pagination = limit != null ? 'LIMIT ? OFFSET ?' : '';
  if (limit != null) params.push(limit, offset);
  const [rows] = await getPool().query(
    `SELECT al.AuditID AS auditId, al.EmployeeID AS employeeId, e.FullName AS employeeName,
            al.Action AS action, al.TableName AS tableName, al.RecordID AS recordId,
            al.OldValue AS oldValue, al.NewValue AS newValue, al.Timestamp AS timestamp
     FROM AuditLogs al
     JOIN Employees e ON e.EmployeeID = al.EmployeeID
     ${where} ORDER BY al.Timestamp DESC ${pagination}`,
    params,
  );
  return rows;
}

export async function count({ employeeId, action, tableName, from, to } = {}) {
  const params = [];
  let where = 'WHERE 1=1';
  if (employeeId) { where += ' AND EmployeeID = ?'; params.push(employeeId); }
  if (action)     { where += ' AND Action = ?';     params.push(action); }
  if (tableName)  { where += ' AND TableName = ?';  params.push(tableName); }
  if (from)       { where += ' AND Timestamp >= ?'; params.push(from); }
  if (to)         { where += ' AND Timestamp <= ?'; params.push(to); }
  const [rows] = await getPool().query(`SELECT COUNT(*) AS cnt FROM AuditLogs ${where}`, params);
  return Number(rows[0].cnt);
}
