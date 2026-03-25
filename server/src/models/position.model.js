/**
 * position.model.js — SQL thuần cho bảng Positions.
 * Dùng trong: services/position.service.js, services/auth.service.js.
 */
import { getPool } from '../config/database.js';

const COLS = `PositionID AS positionId, PositionName AS positionName, Level AS level`;

export async function findAll() {
  const [rows] = await getPool().query(
    `SELECT ${COLS} FROM Positions ORDER BY Level, PositionName`,
  );
  return rows;
}

export async function findById(id) {
  const [rows] = await getPool().query(
    `SELECT ${COLS} FROM Positions WHERE PositionID = ?`,
    [id],
  );
  return rows[0] || null;
}

export async function findByName(name) {
  const [rows] = await getPool().query(
    'SELECT PositionID AS positionId FROM Positions WHERE PositionName = ?',
    [name],
  );
  return rows[0] || null;
}

export async function create({ positionName, level = 1 }) {
  const [result] = await getPool().query(
    'INSERT INTO Positions (PositionName, Level) VALUES (?, ?)',
    [positionName, level],
  );
  return result.insertId;
}

export async function update(id, { positionName, level }) {
  const [result] = await getPool().query(
    'UPDATE Positions SET PositionName = ?, Level = ? WHERE PositionID = ?',
    [positionName, level, id],
  );
  return result.affectedRows;
}

export async function remove(id) {
  const [result] = await getPool().query(
    'DELETE FROM Positions WHERE PositionID = ?',
    [id],
  );
  return result.affectedRows;
}

export async function countEmployees(positionId) {
  const [rows] = await getPool().query(
    'SELECT COUNT(*) AS cnt FROM Employees WHERE PositionID = ?',
    [positionId],
  );
  return Number(rows[0].cnt);
}
