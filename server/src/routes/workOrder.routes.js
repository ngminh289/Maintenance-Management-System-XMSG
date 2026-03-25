/**
 * workOrder.routes.js — /api/work-orders.
 * Luồng trạng thái: PENDING_APPROVAL → WAITING → IN_PROGRESS → PAUSED/COMPLETED → CANCELLED.
 * Liên quan: controllers/workOrder.controller.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { createWOSchema, updateWOSchema, changeStatusSchema, assignSchema } from '../validators/workOrder.validator.js';
import * as ctrl from '../controllers/workOrder.controller.js';

export const workOrderRouter = Router();

workOrderRouter.use(requireAuth);

workOrderRouter.get('/',    ctrl.getAll);
workOrderRouter.get('/:id', ctrl.getById);
workOrderRouter.post('/',   requireLevel(2), validate(createWOSchema), ctrl.create);
workOrderRouter.put('/:id', requireLevel(2), validate(updateWOSchema), ctrl.update);

// Chuyển trạng thái — Level 1 có thể nhận/hoàn thành việc của mình
workOrderRouter.patch('/:id/status', validate(changeStatusSchema), ctrl.changeStatus);

// Phân công nhân viên
workOrderRouter.post('/:id/assign',                    requireLevel(2), validate(assignSchema), ctrl.assign);
workOrderRouter.delete('/:id/assign/:employeeId',      requireLevel(2), ctrl.unassign);

workOrderRouter.delete('/:id', requireLevel(3), ctrl.remove);
