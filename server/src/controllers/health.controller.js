/**
 * health.controller.js — HTTP cho /api/health.
 */
import { healthCheck } from '../services/health.service.js';
import { ok } from '../utils/response.js';

export async function getHealth(req, res, next) {
  try {
    const data = await healthCheck();
    return ok(res, data);
  } catch (e) {
    return next(e);
  }
}
