/**
 * position.routes.js — /api/positions (CRUD).
 * Phân quyền: GET công khai (cần cho form đăng ký); POST/PUT/DELETE yêu cầu Level >= 3.
 * Liên quan: controllers/position.controller.js, validators/position.validator.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { positionSchema } from '../validators/position.validator.js';
import * as ctrl from '../controllers/position.controller.js';

export const positionRouter = Router();

// GET công khai — cần cho form đăng ký và các dropdown
positionRouter.get('/',    ctrl.getAll);
positionRouter.get('/:id', ctrl.getById);

// Mutation yêu cầu đăng nhập + cấp quyền cao
positionRouter.post('/',      requireAuth, requireLevel(3), validate(positionSchema), ctrl.create);
positionRouter.put('/:id',    requireAuth, requireLevel(3), validate(positionSchema), ctrl.update);
positionRouter.delete('/:id', requireAuth, requireLevel(3), ctrl.remove);
