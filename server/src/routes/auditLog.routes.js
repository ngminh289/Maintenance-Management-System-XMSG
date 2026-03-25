/**
 * auditLog.routes.js — /api/audit-logs (admin Level >= 3 only).
 * Liên quan: controllers/auditLog.controller.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/auditLog.controller.js';

export const auditLogRouter = Router();

auditLogRouter.use(requireAuth, requireLevel(3));
auditLogRouter.get('/', ctrl.getAll);
