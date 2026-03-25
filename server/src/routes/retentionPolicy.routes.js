/**
 * retentionPolicy.routes.js — /api/retention-policies (admin).
 * Liên quan: controllers/retentionPolicy.controller.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/retentionPolicy.controller.js';

export const retentionPolicyRouter = Router();

retentionPolicyRouter.use(requireAuth, requireLevel(3));
retentionPolicyRouter.get('/',    ctrl.getAll);
retentionPolicyRouter.get('/:id', ctrl.getById);
retentionPolicyRouter.post('/',   ctrl.create);
retentionPolicyRouter.put('/:id', ctrl.update);
retentionPolicyRouter.delete('/:id', ctrl.remove);
