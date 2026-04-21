/**
 * productionLine.model.js — SQL thuần cho bảng ProductionLines (migration 048).
 * Thay thế ENUM cứng trong Assets.ProductionLine.
 * Dùng trong: services/productionLine.service.js.
 */
import { getPool } from '../config/database.js';

export async function findAll({ includeInactive = false } = {}) {
  const where = includeInactive ? '' : 'WHERE IsActive = 1';
  const [rows] = await getPool().query(
    `SELECT LineID AS lineId, LineName AS lineName, Description AS description, IsActive AS isActive
     FROM ProductionLines ${where} ORDER BY LineName`,
  );
  return rows;
}

export async function findById(id) {
  const [rows] = await getPool().query(
    'SELECT LineID AS lineId, LineName AS lineName, Description AS description, IsActive AS isActive FROM ProductionLines WHERE LineID = ?',
    [id],
  );
  return rows[0] || null;
}

export async function findByName(name) {
  const [rows] = await getPool().query(
    'SELECT LineID AS lineId FROM ProductionLines WHERE LineName = ?',
    [name],
  );
  return rows[0] || null;
}

export async function create({ lineName, description }) {
  const [result] = await getPool().query(
    'INSERT INTO ProductionLines (LineName, Description) VALUES (?, ?)',
    [lineName, description || null],
  );
  return result.insertId;
}

export async function update(id, { lineName, description }) {
  const [r] = await getPool().query(
    'UPDATE ProductionLines SET LineName = ?, Description = ? WHERE LineID = ?',
    [lineName, description || null, id],
  );
  return r.affectedRows;
}

export async function remove(id) {
  const [r] = await getPool().query('DELETE FROM ProductionLines WHERE LineID = ?', [id]);
  return r.affectedRows;
}

export async function countAssets(lineId) {
  const [rows] = await getPool().query(
    'SELECT COUNT(*) AS cnt FROM Assets WHERE ProductionLine = ?',
    [lineId],
  );
  return Number(rows[0].cnt);
}
