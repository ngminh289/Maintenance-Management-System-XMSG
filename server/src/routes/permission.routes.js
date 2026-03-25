/**
 * permission.routes.js — /api/permissions (RBAC admin).
 * Liên quan: controllers/permission.controller.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/permission.controller.js';

export const permissionRouter = Router();

permissionRouter.use(requireAuth);
permissionRouter.get('/',    ctrl.getAll);
permissionRouter.post('/',   requireLevel(3), ctrl.grant);
permissionRouter.delete('/:id', requireLevel(3), ctrl.revoke);
