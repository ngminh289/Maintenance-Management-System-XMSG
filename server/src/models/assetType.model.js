/**
 * assetType.model.js — SQL thuần cho bảng AssetTypes (cây 2 cấp từ migration 048).
 * ParentTypeID NULL  = loại cha (abstract, không gán trực tiếp cho tài sản).
 * ParentTypeID != NULL = loại con (leaf — gán cho tài sản, có DefaultPMValue/Unit).
 * Dùng trong: services/assetType.service.js.
 */
import { getPool } from '../config/database.js';

const COLS = `
  t.AssetTypeID    AS assetTypeId,
  t.TypeName       AS typeName,
  t.ParentTypeID   AS parentTypeId,
  p.TypeName       AS parentTypeName,
  t.DefaultPMValue AS defaultPMValue,
  t.DefaultPMUnit  AS defaultPMUnit,
  t.Description    AS description`;

export async function findAll() {
  const [rows] = await getPool().query(
    `SELECT ${COLS}
     FROM AssetTypes t
     LEFT JOIN AssetTypes p ON p.AssetTypeID = t.ParentTypeID
     ORDER BY COALESCE(t.ParentTypeID, t.AssetTypeID), t.ParentTypeID IS NULL DESC, t.TypeName`,
  );
  return rows;
}

/** Chỉ trả về các loại CON (leaf) — dùng trong dropdown chọn loại tài sản. */
export async function findLeaves() {
  const [rows] = await getPool().query(
    `SELECT ${COLS}
     FROM AssetTypes t
     LEFT JOIN AssetTypes p ON p.AssetTypeID = t.ParentTypeID
     WHERE t.ParentTypeID IS NOT NULL
     ORDER BY p.TypeName, t.TypeName`,
  );
  return rows;
}

export async function findById(id) {
  const [rows] = await getPool().query(
    `SELECT ${COLS}
     FROM AssetTypes t
     LEFT JOIN AssetTypes p ON p.AssetTypeID = t.ParentTypeID
     WHERE t.AssetTypeID = ?`,
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

export async function countChildren(typeId) {
  const [rows] = await getPool().query(
    'SELECT COUNT(*) AS cnt FROM AssetTypes WHERE ParentTypeID = ?',
    [typeId],
  );
  return Number(rows[0].cnt);
}

export async function create({ typeName, parentTypeId, defaultPMValue, defaultPMUnit, description }) {
  const [result] = await getPool().query(
    'INSERT INTO AssetTypes (TypeName, ParentTypeID, DefaultPMValue, DefaultPMUnit, Description) VALUES (?, ?, ?, ?, ?)',
    [typeName, parentTypeId || null, defaultPMValue || null, defaultPMUnit || null, description || null],
  );
  return result.insertId;
}

export async function update(id, { typeName, parentTypeId, defaultPMValue, defaultPMUnit, description }) {
  const [result] = await getPool().query(
    'UPDATE AssetTypes SET TypeName = ?, ParentTypeID = ?, DefaultPMValue = ?, DefaultPMUnit = ?, Description = ? WHERE AssetTypeID = ?',
    [typeName, parentTypeId || null, defaultPMValue || null, defaultPMUnit || null, description || null, id],
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
