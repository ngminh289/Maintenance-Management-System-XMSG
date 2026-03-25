/**
 * retentionPolicy.service.js — Nghiệp vụ chính sách lưu trữ dữ liệu.
 * Liên quan: models/retentionPolicy.model.js.
 */
import { createError } from '../utils/createError.js';
import * as model from '../models/retentionPolicy.model.js';

export async function getAll() {
  return model.findAll();
}

export async function getById(id) {
  const p = await model.findById(id);
  if (!p) throw createError('Không tìm thấy chính sách lưu trữ', 404);
  return p;
}

export async function create(data) {
  const id = await model.create(data);
  return model.findById(id);
}

export async function update(id, data) {
  await getById(id);
  await model.update(id, data);
  return model.findById(id);
}

export async function remove(id) {
  await getById(id);
  await model.remove(id);
}
