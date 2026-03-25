/**
 * location.model.js — SQL thuần cho bảng Locations (hỗ trợ self-referential).
 * Dùng trong: services/location.service.js.
 */
import { getPool } from '../config/database.js';

const COLS = `
  l.LocationID         AS locationId,
  l.LocationName       AS locationName,
  l.ParentLocationID   AS parentLocationId,
  p.LocationName       AS parentLocationName,
  l.Description        AS description`;

export async function findAll() {
  const [rows] = await getPool().query(
    `SELECT ${COLS}
     FROM Locations l
     LEFT JOIN Locations p ON p.LocationID = l.ParentLocationID
     ORDER BY l.ParentLocationID, l.LocationName`,
  );
  return rows;
}

export async function findById(id) {
  const [rows] = await getPool().query(
    `SELECT ${COLS}
     FROM Locations l
     LEFT JOIN Locations p ON p.LocationID = l.ParentLocationID
     WHERE l.LocationID = ?`,
    [id],
  );
  return rows[0] || null;
}

export async function create({ locationName, parentLocationId, description }) {
  const [result] = await getPool().query(
    'INSERT INTO Locations (LocationName, ParentLocationID, Description) VALUES (?, ?, ?)',
    [locationName, parentLocationId || null, description || null],
  );
  return result.insertId;
}

export async function update(id, { locationName, parentLocationId, description }) {
  const [result] = await getPool().query(
    'UPDATE Locations SET LocationName = ?, ParentLocationID = ?, Description = ? WHERE LocationID = ?',
    [locationName, parentLocationId || null, description || null, id],
  );
  return result.affectedRows;
}

export async function remove(id) {
  const [result] = await getPool().query(
    'DELETE FROM Locations WHERE LocationID = ?',
    [id],
  );
  return result.affectedRows;
}

export async function countChildren(locationId) {
  const [rows] = await getPool().query(
    'SELECT COUNT(*) AS cnt FROM Locations WHERE ParentLocationID = ?',
    [locationId],
  );
  return Number(rows[0].cnt);
}

export async function countAssets(locationId) {
  const [rows] = await getPool().query(
    'SELECT COUNT(*) AS cnt FROM Assets WHERE LocationID = ?',
    [locationId],
  );
  return Number(rows[0].cnt);
}
