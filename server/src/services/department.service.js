/**
 * department.service.js — Nghiệp vụ Phòng ban: kiểm tra trùng tên, ràng buộc nhân viên.
 * Dùng trong: controllers/department.controller.js.
 * Liên quan: models/department.model.js.
 */
import { createError } from '../utils/createError.js';
import * as model from '../models/department.model.js';

export async function getAll() {
  return model.findAll();
}

export async function getById(id) {
  const dept = await model.findById(id);
  if (!dept) throw createError('Không tìm thấy phòng ban', 404);
  return dept;
}

export async function create({ departmentName, description }) {
  const exists = await model.findByName(departmentName.trim());
  if (exists) throw createError('Tên phòng ban đã tồn tại', 409);
  const id = await model.create({ departmentName: departmentName.trim(), description });
  return model.findById(id);
}

export async function update(id, { departmentName, description }) {
  await getById(id);
  const exists = await model.findByName(departmentName.trim());
  if (exists && exists.departmentId !== Number(id)) throw createError('Tên phòng ban đã tồn tại', 409);
  await model.update(id, { departmentName: departmentName.trim(), description });
  return model.findById(id);
}

export async function remove(id) {
  await getById(id);
  const empCount = await model.countEmployees(id);
  if (empCount > 0) throw createError(`Không thể xóa: phòng ban đang có ${empCount} nhân viên`, 409);
  await model.remove(id);
}
