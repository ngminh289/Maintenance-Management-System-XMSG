/**
 * productionLine.routes.js — /api/production-lines (CRUD).
 * GET: mọi user đã đăng nhập.
 * POST/PUT: Level >= 2 (Trưởng ca trở lên).
 * DELETE: Level >= 3.
 * Liên quan: controllers/productionLine.controller.js.
 */
import { Router } from 'express';
import { requireAuth }  from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/productionLine.controller.js';

export const productionLineRouter = Router();

productionLineRouter.use(requireAuth);

productionLineRouter.get('/',    ctrl.getAll);
productionLineRouter.get('/:id', ctrl.getById);
productionLineRouter.post('/',   requireLevel(2), ctrl.create);
productionLineRouter.put('/:id', requireLevel(2), ctrl.update);
productionLineRouter.delete('/:id', requireLevel(3), ctrl.remove);
