/**
 * retentionPolicy.controller.js — HTTP handler: /api/retention-policies (admin).
 * Liên quan: services/retentionPolicy.service.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/retentionPolicy.service.js';

export const getAll  = asyncHandler(async (req, res) => ok(res, await service.getAll()));
export const getById = asyncHandler(async (req, res) => ok(res, await service.getById(req.params.id)));
export const create  = asyncHandler(async (req, res) => ok(res, await service.create(req.body), 201));
export const update  = asyncHandler(async (req, res) => ok(res, await service.update(req.params.id, req.body)));
export const remove  = asyncHandler(async (req, res) => { await service.remove(req.params.id); return ok(res, { message: 'Đã xóa chính sách.' }); });
