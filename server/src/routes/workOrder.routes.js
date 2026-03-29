/**
 * workOrder.routes.js — /api/work-orders.
 * Phân quyền nghiêm ngặt theo RBAC.
 * Admin chỉ có READ + APPROVE + DELETE; không được CREATE/UPDATE.
 */
import { Router } from 'express';
import { requireAuth }       from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validate }          from '../middleware/validate.js';
import {
  createWOSchema, updateWOSchema, changeStatusSchema, assignSchema,
} from '../validators/workOrder.validator.js';
import * as ctrl from '../controllers/workOrder.controller.js';

export const workOrderRouter = Router();

workOrderRouter.use(requireAuth);

workOrderRouter.get('/',    ctrl.getAll);
workOrderRouter.get('/:id', ctrl.getById);

workOrderRouter.post('/',
  requirePermission('WORK_ORDER', 'CREATE'),
  validate(createWOSchema),
  ctrl.create,
);
workOrderRouter.put('/:id',
  requirePermission('WORK_ORDER', 'UPDATE'),
  validate(updateWOSchema),
  ctrl.update,
);

// Chuyển trạng thái — cần quyền UPDATE (nhận việc, hoàn thành)
workOrderRouter.patch('/:id/status',
  requirePermission('WORK_ORDER', 'UPDATE'),
  validate(changeStatusSchema),
  ctrl.changeStatus,
);

// Phân công nhân viên
workOrderRouter.post('/:id/assign',
  requirePermission('WORK_ORDER', 'UPDATE'),
  validate(assignSchema),
  ctrl.assign,
);
workOrderRouter.delete('/:id/assign/:employeeId',
  requirePermission('WORK_ORDER', 'UPDATE'),
  ctrl.unassign,
);

workOrderRouter.delete('/:id',
  requirePermission('WORK_ORDER', 'DELETE'),
  ctrl.remove,
);
