/**
 * employee.controller.js — HTTP handler: /api/employees.
 * Trường mở rộng: craftLevel, specialty, experienceNotes, photoPath (migration 043).
 * Ảnh: PATCH /:id/photo — chính mình (bất kể quyền) hoặc có EMPLOYEE:UPDATE.
 * Liên quan: services/employee.service.js, routes/employee.routes.js.
 */
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok }           from "../utils/response.js";
import * as service     from "../services/employee.service.js";

export const getAll = asyncHandler(async (req, res) => {
  return ok(res, await service.getAll(req.query, {
    requesterLevel: req.user?.positionLevel,
  }));
});

export const getById = asyncHandler(async (req, res) => {
  return ok(res, await service.getById(req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  return ok(res, await service.create(req.body), 201);
});

export const update = asyncHandler(async (req, res) => {
  return ok(res, await service.update(req.params.id, req.body));
});

export const deactivate = asyncHandler(async (req, res) => {
  await service.deactivate(req.params.id);
  return ok(res, { message: "Tài khoản nhân viên đã bị vô hiệu hóa." });
});

export const activate = asyncHandler(async (req, res) => {
  await service.activate(req.params.id);
  return ok(res, { message: "Tài khoản nhân viên đã được kích hoạt." });
});

export const changePassword = asyncHandler(async (req, res) => {
  await service.changePassword(req.params.id, req.body);
  return ok(res, { message: "Đổi mật khẩu thành công." });
});

/** Lịch nghỉ phép — Quản trị viên: Level chức vụ ≥ 4. */
export const patchLeaveSchedule = asyncHandler(async (req, res) =>
  ok(res, await service.updateLeaveSchedule(req.params.id, req.body, {
    actorPositionLevel: req.user.positionLevel,
  })),
);

/**
 * PATCH /api/employees/:id/photo — upload ảnh đại diện.
 * Chính mình (không cần quyền đặc biệt) hoặc admin (EMPLOYEE:UPDATE).
 * Field multipart: "photo" (1 ảnh, JPG/PNG/WEBP ≤ 5 MB).
 */
export const updatePhoto = asyncHandler(async (req, res) => {
  // Kiểm tra quyền: chính mình hoặc có permission EMPLOYEE:UPDATE (đã check ở route level)
  const emp = await service.updatePhoto(req.params.id, req.file, {
    actorId: req.user.sub,
    isAdmin: req.hasUpdatePermission ?? false,
  });
  return ok(res, emp);
});
