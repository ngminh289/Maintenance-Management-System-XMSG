/**
 * maintenanceSchedule.model.js — SQL thuần cho bảng MaintenanceSchedules.
 * Dùng trong: services/maintenanceSchedule.service.js.
 */
import { getPool } from '../config/database.js';

const COLS = `
  ms.ScheduleID      AS scheduleId,
  ms.AssetID         AS assetId,
  a.AssetName        AS assetName,
  at.TypeName        AS assetTypeName,
  ms.MaintenanceType AS maintenanceType,
  ms.Description     AS description,
  ms.FrequencyValue  AS frequencyValue,
  ms.FrequencyUnit   AS frequencyUnit,
  ms.StartDate       AS startDate,
  ms.EndDate         AS endDate,
  ms.EstimatedTime   AS estimatedTime,
  ms.Priority        AS priority,
  ms.Status          AS status,
  ms.DigitalAssetID  AS digitalAssetId,
  ms.CreatedBy       AS createdBy,
  ms.CreatedAt       AS createdAt`;

const BASE_JOIN = `
  FROM MaintenanceSchedules ms
  JOIN Assets a    ON a.AssetID       = ms.AssetID
  JOIN AssetTypes at ON at.AssetTypeID = a.AssetTypeID`;

export async function findAll({ assetId, status, maintenanceType, priority, limit, offset } = {}) {
  const params = [];
  let where = 'WHERE 1=1';
  if (assetId)          { where += ' AND ms.AssetID = ?';         params.push(assetId); }
  if (status)           { where += ' AND ms.Status = ?';          params.push(status); }
  if (maintenanceType)  { where += ' AND ms.MaintenanceType = ?'; params.push(maintenanceType); }
  if (priority)         { where += ' AND ms.Priority = ?';        params.push(priority); }
  const pagination = limit != null ? 'LIMIT ? OFFSET ?' : '';
  if (limit != null)    { params.push(limit, offset); }
  const [rows] = await getPool().query(
    `SELECT ${COLS} ${BASE_JOIN} ${where} ORDER BY ms.StartDate DESC ${pagination}`, params,
  );
  return rows;
}

export async function count({ assetId, status, maintenanceType, priority } = {}) {
  const params = [];
  let where = 'WHERE 1=1';
  if (assetId)         { where += ' AND AssetID = ?';         params.push(assetId); }
  if (status)          { where += ' AND Status = ?';          params.push(status); }
  if (maintenanceType) { where += ' AND MaintenanceType = ?'; params.push(maintenanceType); }
  if (priority)        { where += ' AND Priority = ?';        params.push(priority); }
  const [rows] = await getPool().query(`SELECT COUNT(*) AS cnt FROM MaintenanceSchedules ${where}`, params);
  return Number(rows[0].cnt);
}

export async function findById(id) {
  const [rows] = await getPool().query(
    `SELECT ${COLS} ${BASE_JOIN} WHERE ms.ScheduleID = ?`, [id],
  );
  return rows[0] || null;
}

/** Lấy lịch bảo trì kiểu HOURS cho một tài sản (dùng để tính ngưỡng giờ) */
export async function findHourlyByAsset(assetId) {
  const [rows] = await getPool().query(
    `SELECT ScheduleID AS scheduleId, FrequencyValue AS frequencyValue
     FROM MaintenanceSchedules
     WHERE AssetID = ? AND FrequencyUnit = 'HOURS' AND Status = 'PENDING'
     ORDER BY FrequencyValue`,
    [assetId],
  );
  return rows;
}

export async function create(data) {
  const { assetId, maintenanceType, description, frequencyValue, frequencyUnit, startDate, endDate, estimatedTime, priority, digitalAssetId, createdBy } = data;
  const [result] = await getPool().query(
    `INSERT INTO MaintenanceSchedules
     (AssetID, MaintenanceType, Description, FrequencyValue, FrequencyUnit, StartDate, EndDate, EstimatedTime, Priority, DigitalAssetID, CreatedBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [assetId, maintenanceType, description, frequencyValue || null, frequencyUnit || 'HOURS', startDate, endDate || null, estimatedTime || null, priority || 'MEDIUM', digitalAssetId || null, createdBy || null],
  );
  return result.insertId;
}

export async function update(id, data) {
  const map = { description: 'Description', frequencyValue: 'FrequencyValue', frequencyUnit: 'FrequencyUnit', startDate: 'StartDate', endDate: 'EndDate', estimatedTime: 'EstimatedTime', priority: 'Priority', status: 'Status' };
  const setClauses = [];
  const params = [];
  for (const [key, col] of Object.entries(map)) {
    if (data[key] !== undefined) { setClauses.push(`${col} = ?`); params.push(data[key] ?? null); }
  }
  if (!setClauses.length) return 0;
  params.push(id);
  const [result] = await getPool().query(
    `UPDATE MaintenanceSchedules SET ${setClauses.join(', ')} WHERE ScheduleID = ?`, params,
  );
  return result.affectedRows;
}

export async function updateStatus(id, status) {
  await getPool().query('UPDATE MaintenanceSchedules SET Status = ? WHERE ScheduleID = ?', [status, id]);
}

export async function remove(id) {
  const [result] = await getPool().query('DELETE FROM MaintenanceSchedules WHERE ScheduleID = ?', [id]);
  return result.affectedRows;
}
