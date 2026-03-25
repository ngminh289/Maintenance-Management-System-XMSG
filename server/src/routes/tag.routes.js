/**
 * tag.routes.js — /api/tags.
 * Liên quan: controllers/tag.controller.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/tag.controller.js';

export const tagRouter = Router();

tagRouter.use(requireAuth);

tagRouter.get('/',    ctrl.getAll);
tagRouter.get('/:id', ctrl.getById);
tagRouter.post('/',   requireLevel(2), ctrl.create);
tagRouter.put('/:id', requireLevel(2), ctrl.update);
tagRouter.delete('/:id', requireLevel(3), ctrl.remove);
