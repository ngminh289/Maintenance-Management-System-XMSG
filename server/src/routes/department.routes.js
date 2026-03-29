/**
 * department.routes.js — /api/departments (CRUD).
 * Phân quyền: GET công khai (cần cho form đăng ký); POST/PUT/DELETE yêu cầu Level >= 2.
 * Liên quan: controllers/department.controller.js, validators/department.validator.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { departmentSchema } from '../validators/department.validator.js';
import * as ctrl from '../controllers/department.controller.js';

export const departmentRouter = Router();

// GET công khai — cần cho form đăng ký và các dropdown không cần đăng nhập
departmentRouter.get('/',    ctrl.getAll);
departmentRouter.get('/:id', ctrl.getById);

// Mutation yêu cầu đăng nhập + cấp quyền
departmentRouter.post('/',      requireAuth, requireLevel(2), validate(departmentSchema), ctrl.create);
departmentRouter.put('/:id',    requireAuth, requireLevel(2), validate(departmentSchema), ctrl.update);
departmentRouter.delete('/:id', requireAuth, requireLevel(3), ctrl.remove);
