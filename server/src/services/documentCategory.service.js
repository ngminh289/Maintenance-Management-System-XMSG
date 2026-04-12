/**
 * documentCategory.service.js — CRUD phân loại tài liệu (NV KT).
 * Liên quan: models/documentCategory.model.js.
 */
import { createError } from '../utils/createError.js';
import * as model from '../models/documentCategory.model.js';

export async function getAll() {
  return model.findAll();
}

export async function getById(id) {
  const row = await model.findById(id);
  if (!row) throw createError('Không tìm thấy phân loại', 404);
  return row;
}

export async function create({ categoryName, description }) {
  const name = String(categoryName ?? '').trim();
  if (!name) throw createError('Tên phân loại không được để trống', 400);
  const existing = await model.findByName(name);
  if (existing) throw createError('Tên phân loại đã tồn tại', 409);
  const insertId = await model.create({ categoryName: name, description });
  return model.findById(insertId);
}

export async function update(id, { categoryName, description }) {
  await getById(id);
  const patch = {};
  if (categoryName !== undefined) {
    const name = String(categoryName).trim();
    if (!name) throw createError('Tên phân loại không được để trống', 400);
    const existing = await model.findByName(name);
    if (existing && existing.documentCategoryId !== Number(id)) {
      throw createError('Tên phân loại đã tồn tại', 409);
    }
    patch.categoryName = name;
  }
  if (description !== undefined) patch.description = description;
  if (Object.keys(patch).length) await model.update(id, patch);
  return model.findById(id);
}

export async function remove(id) {
  await getById(id);
  await model.remove(id);
}
