/**
 * tag.model.js — SQL thuần cho bảng Tags + AssetTags.
 * Dùng trong: services/tag.service.js, services/digitalAsset.service.js.
 */
import { getPool } from '../config/database.js';

export async function findAll() {
  const [rows] = await getPool().query(
    'SELECT TagID AS tagId, TagName AS tagName FROM Tags ORDER BY TagName',
  );
  return rows;
}

export async function findById(id) {
  const [rows] = await getPool().query(
    'SELECT TagID AS tagId, TagName AS tagName FROM Tags WHERE TagID = ?', [id],
  );
  return rows[0] || null;
}

export async function findByName(tagName) {
  const [rows] = await getPool().query(
    'SELECT TagID AS tagId, TagName AS tagName FROM Tags WHERE TagName = ?', [tagName],
  );
  return rows[0] || null;
}

export async function create(tagName) {
  const [result] = await getPool().query('INSERT INTO Tags (TagName) VALUES (?)', [tagName]);
  return result.insertId;
}

export async function update(id, tagName) {
  const [result] = await getPool().query('UPDATE Tags SET TagName = ? WHERE TagID = ?', [tagName, id]);
  return result.affectedRows;
}

export async function remove(id) {
  const [result] = await getPool().query('DELETE FROM Tags WHERE TagID = ?', [id]);
  return result.affectedRows;
}

// ─── AssetTags (M:N DigitalAssets ↔ Tags) ─────────────────────────────────────

export async function getTagsByDigitalAsset(digitalAssetId) {
  const [rows] = await getPool().query(
    `SELECT t.TagID AS tagId, t.TagName AS tagName
     FROM AssetTags at JOIN Tags t ON t.TagID = at.TagID
     WHERE at.DigitalAssetID = ? ORDER BY t.TagName`,
    [digitalAssetId],
  );
  return rows;
}

export async function addTag(digitalAssetId, tagId) {
  await getPool().query(
    'INSERT IGNORE INTO AssetTags (DigitalAssetID, TagID) VALUES (?, ?)',
    [digitalAssetId, tagId],
  );
}

export async function removeTag(digitalAssetId, tagId) {
  await getPool().query(
    'DELETE FROM AssetTags WHERE DigitalAssetID = ? AND TagID = ?',
    [digitalAssetId, tagId],
  );
}
