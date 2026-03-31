/**
 * employee.service.js — Nghiệp vụ quản lý Nhân viên (admin CRUD + đổi mật khẩu).
 * Dùng trong: controllers/employee.controller.js.
 * Liên quan: models/employee.model.js, utils/paginate.js.
 */
import bcrypt from 'bcrypt';
import { createError } from '../utils/createError.js';
import { getPagination, paginatedResult } from '../utils/paginate.js';
import * as model from '../models/employee.model.js';

const BCRYPT_ROUNDS = 12;

export async function getAll(query) {
  const { page, limit, offset } = getPagination(query);
  const filters = {
    departmentId: query.departmentId ? Number(query.departmentId) : undefined,
    positionId: query.positionId ? Number(query.positionId) : undefined,
    isActive: query.isActive !== undefined ? query.isActive === 'true' : undefined,
    search: query.search?.trim() || undefined,
  };

  const [items, total] = await Promise.all([
    model.findAll({ ...filters, limit, offset }),
    model.count(filters),
  ]);
  return paginatedResult(items, total, page, limit);
}

export async function getById(id) {
  const emp = await model.findById(id);
  if (!emp) throw createError('Không tìm thấy nhân viên', 404);
  return emp;
}

export async function create({ fullName, username, email, phone, password, positionId, departmentId }) {
  const existing = await model.findByUsernameOrEmail(username, email);
  if (existing) throw createError('Username hoặc email đã tồn tại', 409);

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const id = await model.create({
    fullName, username, passwordHash, email,
    phone: phone || null, positionId, departmentId,
    emailVerified: true,
    isActive: true,
    wasEverActivated: true,
  });
  return model.findById(id);
}

export async function update(id, fields) {
  await getById(id);
  if (fields.email) {
    const existing = await model.findByUsernameOrEmail('__none__', fields.email);
    if (existing && existing.employeeId !== Number(id)) throw createError('Email đã được dùng', 409);
  }
  await model.update(id, fields);
  return model.findById(id);
}

export async function deactivate(id) {
  await getById(id);
  await model.setActive(id, false);
}

export async function activate(id) {
  await getById(id);
  await model.setActive(id, true);
}

export async function changePassword(id, { currentPassword, newPassword }) {
  const found = await getById(id);
  const emp = await model.findByUsernameOrEmail('__none__', found.email);
  if (!emp) throw createError('Không tìm thấy nhân viên', 404);

  const match = await bcrypt.compare(currentPassword, emp.passwordHash);
  if (!match) throw createError('Mật khẩu hiện tại không đúng', 401);

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await model.updatePassword(id, hash);
}
