/**
 * productionLine.service.js — Nghiệp vụ quản lý dây chuyền sản xuất.
 * Dùng trong: controllers/productionLine.controller.js.
 * Liên quan: models/productionLine.model.js.
 */
import { createError } from '../utils/createError.js';
import * as model from '../models/productionLine.model.js';

export async function getAll() {
  return model.findAll();
}

export async function getById(id) {
  const line = await model.findById(id);
  if (!line) throw createError('Không tìm thấy dây chuyền', 404);
  return line;
}

export async function create({ lineName, description }) {
  if (!lineName?.trim()) throw createError('Tên dây chuyền không được để trống', 400);
  const exists = await model.findByName(lineName.trim());
  if (exists) throw createError('Tên dây chuyền đã tồn tại', 409);
  const id = await model.create({ lineName: lineName.trim(), description });
  return model.findById(id);
}

export async function update(id, { lineName, description }) {
  await getById(id);
  if (!lineName?.trim()) throw createError('Tên dây chuyền không được để trống', 400);
  const exists = await model.findByName(lineName.trim());
  if (exists && exists.lineId !== Number(id)) throw createError('Tên dây chuyền đã tồn tại', 409);
  await model.update(id, { lineName: lineName.trim(), description });
  return model.findById(id);
}

export async function remove(id) {
  await getById(id);
  const cnt = await model.countAssets(id);
  if (cnt > 0) throw createError(`Không thể xóa: có ${cnt} tài sản đang dùng dây chuyền này`, 409);
  await model.remove(id);
}
