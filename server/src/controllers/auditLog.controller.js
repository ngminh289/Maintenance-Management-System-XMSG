/**
 * auditLog.controller.js — HTTP handler: /api/audit-logs (admin only).
 * Liên quan: services/auditLog.service.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/auditLog.service.js';

export const getAll = asyncHandler(async (req, res) => ok(res, await service.getAll(req.query)));
