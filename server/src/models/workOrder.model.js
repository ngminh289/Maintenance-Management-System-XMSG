/**
 * workOrder.model.js — SQL thuần cho bảng WorkOrders + WO_Assignments.
 * Dùng trong: services/workOrder.service.js.
 */
import { getPool } from '../config/database.js';

const COLS = `
  wo.WO_ID          AS woId,
  wo.ScheduleID     AS scheduleId,
  wo.AssetID        AS assetId,
  a.AssetName       AS assetName,
  at.TypeName       AS assetTypeName,
  l.LocationName    AS locationName,
  wo.Description    AS description,
  wo.PlannedDate    AS plannedDate,
  wo.ActualDate     AS actualDate,
  wo.EstimatedHours AS estimatedHours,
  wo.ActualHours    AS actualHours,
  wo.Status         AS status,
  wo.WO_Source      AS woSource,
  wo.Priority       AS priority,
  wo.CreatedBy      AS createdBy,
  wo.CreatedAt      AS createdAt`;

const BASE_JOIN = `
  FROM WorkOrders wo
  JOIN Assets a      ON a.AssetID       = wo.AssetID
  JOIN AssetTypes at ON at.AssetTypeID  = a.AssetTypeID
  JOIN Locations l   ON l.LocationID    = a.LocationID`;

export async function findAll({ status, assetId, priority, woSource, assignedTo, limit, offset } = {}) {
  const params = [];
  let join = BASE_JOIN;
  let where = 'WHERE 1=1';
  if (status)    { where += ' AND wo.Status = ?';    params.push(status); }
  if (assetId)   { where += ' AND wo.AssetID = ?';   params.push(assetId); }
  if (priority)  { where += ' AND wo.Priority = ?';  params.push(priority); }
  if (woSource)  { where += ' AND wo.WO_Source = ?'; params.push(woSource); }
  if (assignedTo) {
    join += ' JOIN WO_Assignments wa ON wa.WO_ID = wo.WO_ID';
    where += ' AND wa.EmployeeID = ?';
    params.push(assignedTo);
  }
  const pagination = limit != null ? 'LIMIT ? OFFSET ?' : '';
  if (limit != null) params.push(limit, offset);
  const [rows] = await getPool().query(
    `SELECT ${COLS} ${join} ${where} ORDER BY wo.Priority DESC, wo.PlannedDate ${pagination}`, params,
  );
  return rows;
}

export async function count({ status, assetId, priority, woSource, assignedTo } = {}) {
  const params = [];
  let join = 'FROM WorkOrders wo';
  let where = 'WHERE 1=1';
  if (status)   { where += ' AND wo.Status = ?';    params.push(status); }
  if (assetId)  { where += ' AND wo.AssetID = ?';   params.push(assetId); }
  if (priority) { where += ' AND wo.Priority = ?';  params.push(priority); }
  if (woSource) { where += ' AND wo.WO_Source = ?'; params.push(woSource); }
  if (assignedTo) {
    join += ' JOIN WO_Assignments wa ON wa.WO_ID = wo.WO_ID';
    where += ' AND wa.EmployeeID = ?';
    params.push(assignedTo);
  }
  const [rows] = await getPool().query(`SELECT COUNT(*) AS cnt ${join} ${where}`, params);
  return Number(rows[0].cnt);
}

export async function findById(id) {
  const [rows] = await getPool().query(
    `SELECT ${COLS} ${BASE_JOIN} WHERE wo.WO_ID = ?`, [id],
  );
  return rows[0] || null;
}

export async function getAssignments(woId) {
  const [rows] = await getPool().query(
    `SELECT e.EmployeeID AS employeeId, e.FullName AS fullName,
            p.PositionName AS positionName, e.Phone AS phone, e.Email AS email
     FROM WO_Assignments wa
     JOIN Employees e ON e.EmployeeID = wa.EmployeeID
     JOIN Positions p ON p.PositionID = e.PositionID
     WHERE wa.WO_ID = ?`,
    [woId],
  );
  return rows;
}

export async function create({ scheduleId, assetId, description, plannedDate, estimatedHours, status, woSource, priority, createdBy }) {
  const [result] = await getPool().query(
    `INSERT INTO WorkOrders (ScheduleID, AssetID, Description, PlannedDate, EstimatedHours, Status, WO_Source, Priority, CreatedBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [scheduleId || null, assetId, description || null, plannedDate, estimatedHours || null, status || 'PENDING_APPROVAL', woSource || 'MANUAL', priority || 'MEDIUM', createdBy || null],
  );
  return result.insertId;
}

export async function update(id, data) {
  const map = { description: 'Description', plannedDate: 'PlannedDate', actualDate: 'ActualDate', estimatedHours: 'EstimatedHours', actualHours: 'ActualHours', priority: 'Priority' };
  const setClauses = [];
  const params = [];
  for (const [key, col] of Object.entries(map)) {
    if (data[key] !== undefined) { setClauses.push(`${col} = ?`); params.push(data[key] ?? null); }
  }
  if (!setClauses.length) return 0;
  params.push(id);
  const [result] = await getPool().query(
    `UPDATE WorkOrders SET ${setClauses.join(', ')} WHERE WO_ID = ?`, params,
  );
  return result.affectedRows;
}

export async function updateStatus(id, status, { actualDate, actualHours } = {}) {
  const setClauses = ['Status = ?'];
  const params = [status];
  if (actualDate)  { setClauses.push('ActualDate = ?');  params.push(actualDate); }
  if (actualHours !== undefined) { setClauses.push('ActualHours = ?'); params.push(actualHours); }
  params.push(id);
  await getPool().query(`UPDATE WorkOrders SET ${setClauses.join(', ')} WHERE WO_ID = ?`, params);
}

export async function assign(woId, employeeId) {
  await getPool().query(
    'INSERT IGNORE INTO WO_Assignments (WO_ID, EmployeeID) VALUES (?, ?)',
    [woId, employeeId],
  );
}

export async function unassign(woId, employeeId) {
  await getPool().query(
    'DELETE FROM WO_Assignments WHERE WO_ID = ? AND EmployeeID = ?',
    [woId, employeeId],
  );
}

export async function remove(id) {
  const [result] = await getPool().query('DELETE FROM WorkOrders WHERE WO_ID = ?', [id]);
  return result.affectedRows;
}
