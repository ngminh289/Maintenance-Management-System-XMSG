/**
 * health.controller.js — HTTP handler: GET /api/health.
 * Liên quan: services/health.service.js, routes/health.routes.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { healthCheck } from '../services/health.service.js';

export const getHealth = asyncHandler(async (req, res) => {
  return ok(res, await healthCheck());
});
