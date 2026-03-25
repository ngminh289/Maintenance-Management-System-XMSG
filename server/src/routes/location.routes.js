/**
 * location.routes.js — /api/locations (CRUD + GET cây vị trí).
 * Phân quyền: GET tất cả; POST/PUT/DELETE yêu cầu Level >= 2.
 * Liên quan: controllers/location.controller.js, validators/location.validator.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { locationSchema } from '../validators/location.validator.js';
import * as ctrl from '../controllers/location.controller.js';

export const locationRouter = Router();

locationRouter.use(requireAuth);

locationRouter.get('/tree', ctrl.getTree);  // Trước /:id để không bị bắt nhầm
locationRouter.get('/',     ctrl.getAll);
locationRouter.get('/:id',  ctrl.getById);
locationRouter.post('/',    requireLevel(2), validate(locationSchema), ctrl.create);
locationRouter.put('/:id',  requireLevel(2), validate(locationSchema), ctrl.update);
locationRouter.delete('/:id', requireLevel(3), ctrl.remove);
