/**
 * employee.service.js — Nghiệp vụ quản lý Nhân viên (admin CRUD + đổi mật khẩu).
 * Lịch nghỉ phép (LeaveStartAt / LeaveEndAt): chỉ Level chức vụ ≥ 4 — tự động ON_LEAVE trong khoảng (NOW() SQL).
 * Dùng trong: controllers/employee.controller.js.
 * Liên quan: models/employee.model.js, utils/paginate.js, utils/dateTimeMysql.js.
 */
import bcrypt from "bcrypt";
import { createError } from "../utils/createError.js";
import { getPagination, paginatedResult } from "../utils/paginate.js";
import * as model from "../models/employee.model.js";
import { MIN_ADMIN_POSITION_LEVEL } from "../constants/positions.js";
import { departmentIdForPosition } from "../constants/orgUnits.js";
import { normalizeLocalDateTimeForMysql } from "../utils/dateTimeMysql.js";

const BCRYPT_ROUNDS = 12;

export async function getAll(query) {
  const { page, limit, offset } = getPagination(query);
  const filters = {
    departmentId: query.departmentId ? Number(query.departmentId) : undefined,
    positionId: query.positionId ? Number(query.positionId) : undefined,
    isActive:
      query.isActive !== undefined ? query.isActive === "true" : undefined,
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
  if (!emp) throw createError("Không tìm thấy nhân viên", 404);
  return emp;
}

export async function create({
  fullName,
  username,
  email,
  phone,
  password,
  positionId,
  departmentId,
}) {
  const existing = await model.findByUsernameOrEmail(username, email);
  if (existing) throw createError("Username hoặc email đã tồn tại", 409);

  const resolvedDept = departmentIdForPosition(Number(positionId));
  if (resolvedDept == null) {
    throw createError("Chức vụ không hợp lệ.", 400);
  }
  if (departmentId != null && Number(departmentId) !== resolvedDept) {
    throw createError("Phòng ban không khớp với chức vụ đã chọn.", 400);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const id = await model.create({
    fullName,
    username,
    passwordHash,
    email,
    phone: phone || null,
    positionId,
    departmentId: resolvedDept,
    emailVerified: true,
    isActive: true,
    wasEverActivated: true,
  });
  return model.findById(id);
}

/**
 * Thiết lập / xóa lịch nghỉ phép (chỉ Level chức vụ ≥ 4 — route kèm requireLevel(4)).
 */
export async function updateLeaveSchedule(
  employeeId,
  body,
  { actorPositionLevel } = {},
) {
  if (Number(actorPositionLevel ?? 0) < MIN_ADMIN_POSITION_LEVEL) {
    throw createError(
      "Chỉ Quản trị viên (Level chức vụ ≥ 4) được thiết lập lịch nghỉ phép.",
      403,
    );
  }
  await getById(employeeId);
  if (body.clear === true || body.clear === "true") {
    await model.updateLeaveSchedule(employeeId, null, null);
    return model.findById(employeeId);
  }
  const start = normalizeLocalDateTimeForMysql(body.leaveStartAt);
  const end = normalizeLocalDateTimeForMysql(body.leaveEndAt);
  if (!start || !end) {
    throw createError("Định dạng ngày giờ không hợp lệ.", 400);
  }
  if (end < start) {
    throw createError("Thời điểm kết thúc phải sau hoặc bằng thời điểm bắt đầu.", 400);
  }
  await model.updateLeaveSchedule(employeeId, start, end);
  return model.findById(employeeId);
}

export async function update(id, fields) {
  const emp = await getById(id);
  if (fields.email) {
    const existing = await model.findByUsernameOrEmail(
      "__none__",
      fields.email,
    );
    if (existing && existing.employeeId !== Number(id))
      throw createError("Email đã được dùng", 409);
  }

  const nextPos =
    fields.positionId !== undefined
      ? Number(fields.positionId)
      : Number(emp.positionId);
  const expectedDept = departmentIdForPosition(nextPos);
  if (expectedDept == null) {
    throw createError("Chức vụ không hợp lệ.", 400);
  }
  const payload = { ...fields };
  if (fields.positionId !== undefined) {
    payload.departmentId = expectedDept;
  }
  if (
    fields.departmentId !== undefined &&
    Number(fields.departmentId) !== expectedDept
  ) {
    throw createError("Phòng ban không khớp với chức vụ đã chọn.", 400);
  }

  await model.update(id, payload);
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
  const emp = await model.findByUsernameOrEmail("__none__", found.email);
  if (!emp) throw createError("Không tìm thấy nhân viên", 404);

  const match = await bcrypt.compare(currentPassword, emp.passwordHash);
  if (!match) throw createError("Mật khẩu hiện tại không đúng", 401);

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await model.updatePassword(id, hash);
}
