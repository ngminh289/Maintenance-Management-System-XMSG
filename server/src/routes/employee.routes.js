/**
 * employee.routes.js — /api/employees (CRUD + đổi mật khẩu + kích hoạt/vô hiệu).
 * Phân quyền nghiêm ngặt theo RBAC.
 * Tạo/Sửa nhân viên: Trưởng phòng (L2) và Admin (L3).
 * Xóa / Vô hiệu hóa: chỉ Admin (L3) — requireLevel vẫn dùng để giữ đơn giản.
 */
import { Router } from 'express';
import { requireAuth }       from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validate }          from '../middleware/validate.js';
import {
  createEmployeeSchema, updateEmployeeSchema, changePasswordSchema,
} from '../validators/employee.validator.js';
import * as ctrl from '../controllers/employee.controller.js';

export const employeeRouter = Router();

employeeRouter.use(requireAuth);

employeeRouter.get('/',    requirePermission('EMPLOYEE', 'READ'), ctrl.getAll);
employeeRouter.get('/:id', requirePermission('EMPLOYEE', 'READ'), ctrl.getById);

employeeRouter.post('/',
  requirePermission('EMPLOYEE', 'CREATE'),
  validate(createEmployeeSchema),
  ctrl.create,
);
employeeRouter.put('/:id',
  requirePermission('EMPLOYEE', 'UPDATE'),
  validate(updateEmployeeSchema),
  ctrl.update,
);

// Vô hiệu / kích hoạt — chỉ ai có DELETE quyền trên EMPLOYEE
employeeRouter.patch('/:id/deactivate',
  requirePermission('EMPLOYEE', 'DELETE'),
  ctrl.deactivate,
);
employeeRouter.patch('/:id/activate',
  requirePermission('EMPLOYEE', 'DELETE'),
  ctrl.activate,
);

// Đổi mật khẩu — chỉ chính mình hoặc admin, kiểm tra trong controller
employeeRouter.patch('/:id/password',
  validate(changePasswordSchema),
  ctrl.changePassword,
);
