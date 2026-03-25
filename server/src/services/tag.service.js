/**
 * tag.service.js — Nghiệp vụ quản lý Tags.
 * Liên quan: models/tag.model.js.
 */
import { createError } from '../utils/createError.js';
import * as model from '../models/tag.model.js';

export async function getAll() {
  return model.findAll();
}

export async function getById(id) {
  const tag = await model.findById(id);
  if (!tag) throw createError('Không tìm thấy tag', 404);
  return tag;
}

export async function create(tagName) {
  const existing = await model.findByName(tagName.trim());
  if (existing) throw createError('Tag đã tồn tại', 409);
  const id = await model.create(tagName.trim());
  return model.findById(id);
}

export async function update(id, tagName) {
  await getById(id);
  const existing = await model.findByName(tagName.trim());
  if (existing && existing.tagId !== Number(id)) throw createError('Tên tag đã tồn tại', 409);
  await model.update(id, tagName.trim());
  return model.findById(id);
}

export async function remove(id) {
  await getById(id);
  await model.remove(id);
}
