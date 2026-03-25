/**
 * position.routes.js — /api/positions (CRUD).
 * Phân quyền: GET tất cả; POST/PUT/DELETE yêu cầu Level >= 3 (Quản lý).
 * Liên quan: controllers/position.controller.js, validators/position.validator.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { positionSchema } from '../validators/position.validator.js';
import * as ctrl from '../controllers/position.controller.js';

export const positionRouter = Router();

positionRouter.use(requireAuth);

positionRouter.get('/',    ctrl.getAll);
positionRouter.get('/:id', ctrl.getById);
positionRouter.post('/',   requireLevel(3), validate(positionSchema), ctrl.create);
positionRouter.put('/:id', requireLevel(3), validate(positionSchema), ctrl.update);
positionRouter.delete('/:id', requireLevel(3), ctrl.remove);
