/**
 * permission.controller.js — HTTP handler: /api/permissions (admin).
 * Liên quan: services/permission.service.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/permission.service.js';

export const getAll = asyncHandler(async (req, res) => ok(res, await service.getAll(req.query.positionId)));
export const grant  = asyncHandler(async (req, res) => ok(res, await service.grant(req.body), 201));
export const revoke = asyncHandler(async (req, res) => { await service.revoke(req.params.id); return ok(res, { message: 'Đã thu hồi quyền.' }); });
