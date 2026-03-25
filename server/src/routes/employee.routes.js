/**
 * employee.routes.js — /api/employees (CRUD + đổi mật khẩu + kích hoạt/vô hiệu).
 * Phân quyền: GET tất cả; tạo/sửa/xóa yêu cầu Level >= 2.
 * Liên quan: controllers/employee.controller.js, validators/employee.validator.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  changePasswordSchema,
} from '../validators/employee.validator.js';
import * as ctrl from '../controllers/employee.controller.js';

export const employeeRouter = Router();

employeeRouter.use(requireAuth);

employeeRouter.get('/',    ctrl.getAll);
employeeRouter.get('/:id', ctrl.getById);
employeeRouter.post('/', requireLevel(2), validate(createEmployeeSchema), ctrl.create);
employeeRouter.put('/:id', requireLevel(2), validate(updateEmployeeSchema), ctrl.update);
employeeRouter.patch('/:id/deactivate', requireLevel(3), ctrl.deactivate);
employeeRouter.patch('/:id/activate',   requireLevel(3), ctrl.activate);
employeeRouter.patch('/:id/password', validate(changePasswordSchema), ctrl.changePassword);
