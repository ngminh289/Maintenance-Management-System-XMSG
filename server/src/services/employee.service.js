/**
 * employee.service.js — Nghiệp vụ quản lý Nhân viên.
 * Trường mở rộng: CraftLevel, Specialty, ExperienceNotes, PhotoPath (migration 043).
 * Ảnh: PATCH /api/employees/:id/photo — chính mình hoặc EMPLOYEE:UPDATE.
 * Lịch nghỉ: chỉ Level chức vụ ≥ 4.
 * Dùng trong: controllers/employee.controller.js.
 */
import bcrypt from "bcrypt";
import { createError }                    from "../utils/createError.js";
import { getPagination, paginatedResult } from "../utils/paginate.js";
import * as model from "../models/employee.model.js";
import { MIN_ADMIN_POSITION_LEVEL } from "../constants/positions.js";
import { departmentIdForPosition }  from "../constants/orgUnits.js";
import { normalizeLocalDateTimeForMysql } from "../utils/dateTimeMysql.js";
import { deleteStoredFile } from "../utils/storageUrl.js";

const BCRYPT_ROUNDS = 12;

export async function getAll(query, { requesterLevel } = {}) {
  const { page, limit, offset } = getPagination(query);
  // Khi requesterLevel < 4 (không phải admin): chỉ thấy nhân viên level ≤ mình
  const maxLevel = (requesterLevel != null && requesterLevel < 4)
    ? requesterLevel
    : undefined;
  const filters = {
    departmentId: query.departmentId ? Number(query.departmentId) : undefined,
    positionId:   query.positionId   ? Number(query.positionId)   : undefined,
    isActive:     query.isActive !== undefined ? query.isActive === "true" : undefined,
    search:       query.search?.trim()    || undefined,
    specialty:    query.specialty?.trim() || undefined,
    craftLevel:   query.craftLevel ? Number(query.craftLevel) : undefined,
    maxLevel,
  };

  const [items, total] = await Promise.all([
    model.findAll({ ...filters, limit, offset }),
    model.count(filters),
  ]);
  return paginatedResult(items, total, page, limit);
}

export async function getById(id) {
  const emp = await model.findById(id);
  if (!emp) throw createError("Không tìm thấy nhân viên", 404);
  return emp;
}

export async function create({ fullName, username, email, phone, password, positionId, departmentId, craftLevel, specialty, experienceNotes }) {
  const existing = await model.findByUsernameOrEmail(username, email);
  if (existing) throw createError("Username hoặc email đã tồn tại", 409);

  // Phòng ban chỉ theo chức vụ (orgUnits.js) — không tin body.departmentId.
  const resolvedDept = departmentIdForPosition(Number(positionId));
  if (resolvedDept == null) throw createError("Chức vụ không hợp lệ.", 400);

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const id = await model.create({
    fullName, username, passwordHash, email,
    phone: phone || null,
    positionId, departmentId: resolvedDept,
    craftLevel: craftLevel ? Number(craftLevel) : null,
    specialty: specialty?.trim() || null,
    experienceNotes: experienceNotes?.trim() || null,
    emailVerified: true, isActive: true, wasEverActivated: true,
  });
  return model.findById(id);
}

export async function update(id, fields) {
  const emp = await getById(id);
  if (fields.email) {
    const existing = await model.findByUsernameOrEmail("__none__", fields.email);
    if (existing && existing.employeeId !== Number(id)) throw createError("Email đã được dùng", 409);
  }

  const nextPos = fields.positionId !== undefined ? Number(fields.positionId) : Number(emp.positionId);
  const expectedDept = departmentIdForPosition(nextPos);
  if (expectedDept == null) throw createError("Chức vụ không hợp lệ.", 400);

  const payload = { ...fields };
  delete payload.departmentId;
  payload.departmentId = expectedDept;
  if (payload.craftLevel !== undefined) payload.craftLevel = payload.craftLevel ? Number(payload.craftLevel) : null;

  await model.update(id, payload);
  return model.findById(id);
}

/**
 * Cập nhật ảnh đại diện nhân viên.
 * actorId: người đang đăng nhập (req.user.sub).
 * isAdmin: true nếu có quyền EMPLOYEE:UPDATE.
 * Chỉ chính mình hoặc admin mới được thay ảnh.
 */
export async function updatePhoto(id, file, { actorId, isAdmin } = {}) {
  const emp = await getById(id);
  if (Number(actorId) !== Number(id) && !isAdmin) {
    throw createError("Bạn chỉ có thể cập nhật ảnh của chính mình", 403);
  }
  if (!file) throw createError("Chưa chọn file ảnh", 400);

  if (emp.photoPath) {
    await deleteStoredFile(emp.photoPath);
  }

  const rel = file.secure_url || `uploads/employees/${file.filename}`;
  await model.updatePhoto(id, rel);
  return model.findById(id);
}

export async function updateLeaveSchedule(employeeId, body, { actorPositionLevel } = {}) {
  if (Number(actorPositionLevel ?? 0) < MIN_ADMIN_POSITION_LEVEL) {
    throw createError("Chỉ Quản trị viên (Level chức vụ ≥ 4) được thiết lập lịch nghỉ phép.", 403);
  }
  await getById(employeeId);
  if (body.clear === true || body.clear === "true") {
    await model.updateLeaveSchedule(employeeId, null, null);
    return model.findById(employeeId);
  }
  const start = normalizeLocalDateTimeForMysql(body.leaveStartAt);
  const end   = normalizeLocalDateTimeForMysql(body.leaveEndAt);
  if (!start || !end) throw createError("Định dạng ngày giờ không hợp lệ.", 400);
  if (end < start)    throw createError("Thời điểm kết thúc phải sau hoặc bằng thời điểm bắt đầu.", 400);
  await model.updateLeaveSchedule(employeeId, start, end);
  return model.findById(employeeId);
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
  const emp = await model.findByUsernameOrEmail("__none__", found.email);
  if (!emp) throw createError("Không tìm thấy nhân viên", 404);

  const match = await bcrypt.compare(currentPassword, emp.passwordHash);
  if (!match) throw createError("Mật khẩu hiện tại không đúng", 401);

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await model.updatePassword(id, hash);
}
