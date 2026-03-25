/**
 * tag.controller.js — HTTP handler: /api/tags.
 * Liên quan: services/tag.service.js, routes/tag.routes.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/tag.service.js';

export const getAll  = asyncHandler(async (req, res) => ok(res, await service.getAll()));
export const getById = asyncHandler(async (req, res) => ok(res, await service.getById(req.params.id)));
export const create  = asyncHandler(async (req, res) => ok(res, await service.create(req.body.tagName), 201));
export const update  = asyncHandler(async (req, res) => ok(res, await service.update(req.params.id, req.body.tagName)));
export const remove  = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  return ok(res, { message: 'Đã xóa tag.' });
});
