/**
 * department.routes.js — /api/departments (CRUD).
 * Phân quyền: GET tất cả; POST/PUT/DELETE yêu cầu Level >= 2 (Trưởng nhóm).
 * Liên quan: controllers/department.controller.js, validators/department.validator.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { departmentSchema } from '../validators/department.validator.js';
import * as ctrl from '../controllers/department.controller.js';

export const departmentRouter = Router();

departmentRouter.use(requireAuth);

departmentRouter.get('/',    ctrl.getAll);
departmentRouter.get('/:id', ctrl.getById);
departmentRouter.post('/',   requireLevel(2), validate(departmentSchema), ctrl.create);
departmentRouter.put('/:id', requireLevel(2), validate(departmentSchema), ctrl.update);
departmentRouter.delete('/:id', requireLevel(3), ctrl.remove);
