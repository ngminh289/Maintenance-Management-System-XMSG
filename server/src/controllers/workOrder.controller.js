/**
 * workOrder.controller.js — HTTP handler: /api/work-orders.
 * Liên quan: services/workOrder.service.js, routes/workOrder.routes.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/workOrder.service.js';

export const getAll = asyncHandler(async (req, res) => {
  // KTV (level 1) và Operator (level 1) chỉ xem WO được giao cho mình
  const query = { ...req.query };
  if (req.user.positionLevel <= 1) {
    query.assignedTo = req.user.sub;
  }
  return ok(res, await service.getAll(query));
});

export const getById = asyncHandler(async (req, res) => ok(res, await service.getById(req.params.id)));

export const create = asyncHandler(async (req, res) =>
  ok(res, await service.create(req.body, req.user.sub), 201));

export const update = asyncHandler(async (req, res) =>
  ok(res, await service.update(req.params.id, req.body)));

export const changeStatus = asyncHandler(async (req, res) => {
  const result = await service.changeStatus(req.params.id, req.body.status, {
    actorLevel: req.user.positionLevel,
    actualHours: req.body.actualHours,
  });
  return ok(res, result);
});

export const assign = asyncHandler(async (req, res) =>
  ok(res, await service.assign(Number(req.params.id), Number(req.body.employeeId))));

export const unassign = asyncHandler(async (req, res) =>
  ok(res, await service.unassign(Number(req.params.id), Number(req.params.employeeId))));

export const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  return ok(res, { message: 'Đã xóa phiếu công việc.' });
});
