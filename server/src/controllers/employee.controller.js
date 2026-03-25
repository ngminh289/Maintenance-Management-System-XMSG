/**
 * employee.controller.js — HTTP handler: /api/employees.
 * Liên quan: services/employee.service.js, routes/employee.routes.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/employee.service.js';

export const getAll = asyncHandler(async (req, res) => {
  return ok(res, await service.getAll(req.query));
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
  return ok(res, { message: 'Tài khoản nhân viên đã bị vô hiệu hóa.' });
});

export const activate = asyncHandler(async (req, res) => {
  await service.activate(req.params.id);
  return ok(res, { message: 'Tài khoản nhân viên đã được kích hoạt.' });
});

export const changePassword = asyncHandler(async (req, res) => {
  await service.changePassword(req.params.id, req.body);
  return ok(res, { message: 'Đổi mật khẩu thành công.' });
});
