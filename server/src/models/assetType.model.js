/**
 * assetType.model.js — SQL thuần cho bảng AssetTypes.
 * Dùng trong: services/assetType.service.js.
 */
import { getPool } from '../config/database.js';

const COLS = `AssetTypeID AS assetTypeId, TypeName AS typeName, Description AS description, DefaultPMInterval AS defaultPMInterval`;

export async function findAll() {
  const [rows] = await getPool().query(
    `SELECT ${COLS} FROM AssetTypes ORDER BY TypeName`,
  );
  return rows;
}

export async function findById(id) {
  const [rows] = await getPool().query(
    `SELECT ${COLS} FROM AssetTypes WHERE AssetTypeID = ?`,
    [id],
  );
  return rows[0] || null;
}

export async function findByName(name) {
  const [rows] = await getPool().query(
    'SELECT AssetTypeID AS assetTypeId FROM AssetTypes WHERE TypeName = ?',
    [name],
  );
  return rows[0] || null;
}

export async function create({ typeName, description, defaultPMInterval }) {
  const [result] = await getPool().query(
    'INSERT INTO AssetTypes (TypeName, Description, DefaultPMInterval) VALUES (?, ?, ?)',
    [typeName, description || null, defaultPMInterval || null],
  );
  return result.insertId;
}

export async function update(id, { typeName, description, defaultPMInterval }) {
  const [result] = await getPool().query(
    'UPDATE AssetTypes SET TypeName = ?, Description = ?, DefaultPMInterval = ? WHERE AssetTypeID = ?',
    [typeName, description || null, defaultPMInterval || null, id],
  );
  return result.affectedRows;
}

export async function remove(id) {
  const [result] = await getPool().query(
    'DELETE FROM AssetTypes WHERE AssetTypeID = ?',
    [id],
  );
  return result.affectedRows;
}

export async function countAssets(assetTypeId) {
  const [rows] = await getPool().query(
    'SELECT COUNT(*) AS cnt FROM Assets WHERE AssetTypeID = ?',
    [assetTypeId],
  );
  return Number(rows[0].cnt);
}
