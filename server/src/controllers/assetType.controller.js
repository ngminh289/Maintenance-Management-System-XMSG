/**
 * assetType.controller.js — HTTP handler: /api/asset-types.
 * GET /leaves — chỉ trả loại con (leaf) dùng cho dropdown.
 * Liên quan: services/assetType.service.js, routes/assetType.routes.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/assetType.service.js';

export const getAll = asyncHandler(async (req, res) => {
  return ok(res, await service.getAll());
});

export const getLeaves = asyncHandler(async (req, res) => {
  return ok(res, await service.getLeaves());
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

export const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  return ok(res, { message: 'Đã xóa loại tài sản.' });
});
