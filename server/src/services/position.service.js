/**
 * position.service.js — Nghiệp vụ Chức vụ: kiểm tra trùng tên, ràng buộc nhân viên.
 * Dùng trong: controllers/position.controller.js.
 * Liên quan: models/position.model.js.
 */
import { createError } from '../utils/createError.js';
import * as model from '../models/position.model.js';

export async function getAll() {
  return model.findAll();
}

export async function getById(id) {
  const pos = await model.findById(id);
  if (!pos) throw createError('Không tìm thấy chức vụ', 404);
  return pos;
}

export async function create({ positionName, level = 1 }) {
  const exists = await model.findByName(positionName.trim());
  if (exists) throw createError('Tên chức vụ đã tồn tại', 409);
  const id = await model.create({ positionName: positionName.trim(), level: Number(level) });
  return model.findById(id);
}

export async function update(id, { positionName, level }) {
  await getById(id);
  const exists = await model.findByName(positionName.trim());
  if (exists && exists.positionId !== Number(id)) throw createError('Tên chức vụ đã tồn tại', 409);
  await model.update(id, { positionName: positionName.trim(), level: Number(level) });
  return model.findById(id);
}

export async function remove(id) {
  await getById(id);
  const empCount = await model.countEmployees(id);
  if (empCount > 0) throw createError(`Không thể xóa: chức vụ đang có ${empCount} nhân viên`, 409);
  await model.remove(id);
}
