/**
 * asset.controller.js — HTTP handler: /api/assets.
 * Liên quan: services/asset.service.js, routes/asset.routes.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/asset.service.js';

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

export const updateStatus = asyncHandler(async (req, res) => {
  return ok(res, await service.updateStatus(req.params.id, req.body.status));
});

export const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  return ok(res, { message: 'Đã xóa tài sản.' });
});
