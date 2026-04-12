/**
 * documentCategory.model.js — Bảng DocumentCategories (phân loại tài liệu DAM, 1–1 với DigitalAssets).
 * Dùng trong: services/documentCategory.service.js.
 */
import { getPool } from '../config/database.js';

export async function findAll() {
  const [rows] = await getPool().query(
    `SELECT DocumentCategoryID AS documentCategoryId, CategoryName AS categoryName,
            Description AS description, CreatedAt AS createdAt
     FROM DocumentCategories ORDER BY CategoryName`,
  );
  return rows;
}

export async function findById(id) {
  const [rows] = await getPool().query(
    `SELECT DocumentCategoryID AS documentCategoryId, CategoryName AS categoryName,
            Description AS description, CreatedAt AS createdAt
     FROM DocumentCategories WHERE DocumentCategoryID = ?`,
    [id],
  );
  return rows[0] || null;
}

export async function findByName(categoryName) {
  const [rows] = await getPool().query(
    `SELECT DocumentCategoryID AS documentCategoryId, CategoryName AS categoryName,
            Description AS description, CreatedAt AS createdAt
     FROM DocumentCategories WHERE CategoryName = ?`,
    [categoryName],
  );
  return rows[0] || null;
}

export async function create({ categoryName, description }) {
  const [result] = await getPool().query(
    'INSERT INTO DocumentCategories (CategoryName, Description) VALUES (?, ?)',
    [categoryName, description ?? null],
  );
  return result.insertId;
}

export async function update(id, { categoryName, description }) {
  const sets = [];
  const params = [];
  if (categoryName !== undefined) {
    sets.push('CategoryName = ?');
    params.push(categoryName);
  }
  if (description !== undefined) {
    sets.push('Description = ?');
    params.push(description ?? null);
  }
  if (!sets.length) return 0;
  params.push(id);
  const [r] = await getPool().query(
    `UPDATE DocumentCategories SET ${sets.join(', ')} WHERE DocumentCategoryID = ?`,
    params,
  );
  return r.affectedRows;
}

export async function remove(id) {
  const [r] = await getPool().query(
    'DELETE FROM DocumentCategories WHERE DocumentCategoryID = ?',
    [id],
  );
  return r.affectedRows;
}
