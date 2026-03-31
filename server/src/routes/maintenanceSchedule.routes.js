/**
 * maintenanceSchedule.routes.js — /api/maintenance-schedules.
 * Phân quyền nghiêm ngặt theo RBAC.
 * Gửi lịch vào duyệt: SUBMIT (NV KT + Admin — BFD 4.1; Trưởng ca không SUBMIT).
 */
import { Router } from 'express';
import { requireAuth }       from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validate }          from '../middleware/validate.js';
import {
  createScheduleSchema, updateScheduleSchema,
} from '../validators/maintenanceSchedule.validator.js';
import * as ctrl from '../controllers/maintenanceSchedule.controller.js';

export const maintenanceScheduleRouter = Router();

maintenanceScheduleRouter.use(requireAuth);

maintenanceScheduleRouter.get('/',    ctrl.getAll);
maintenanceScheduleRouter.get('/:id', ctrl.getById);

maintenanceScheduleRouter.post('/',
  requirePermission('MAINTENANCE_PLAN', 'CREATE'),
  validate(createScheduleSchema),
  ctrl.create,
);
maintenanceScheduleRouter.put('/:id',
  requirePermission('MAINTENANCE_PLAN', 'UPDATE'),
  validate(updateScheduleSchema),
  ctrl.update,
);
maintenanceScheduleRouter.patch('/:id/status',
  requirePermission('MAINTENANCE_PLAN', 'UPDATE'),
  ctrl.updateStatus,
);
maintenanceScheduleRouter.delete('/:id',
  requirePermission('MAINTENANCE_PLAN', 'DELETE'),
  ctrl.remove,
);

// Tạo Work Order từ lịch bảo trì — cần APPROVE trên MAINTENANCE_PLAN
maintenanceScheduleRouter.post('/:id/generate-work-order',
  requirePermission('MAINTENANCE_PLAN', 'APPROVE'),
  ctrl.generateWorkOrder,
);

// Gửi duyệt: DRAFT|REJECTED → log + Status PENDING_APPROVAL → TC duyệt → PENDING
maintenanceScheduleRouter.post('/:id/submit',
  requirePermission('MAINTENANCE_PLAN', 'SUBMIT'),
  ctrl.submitForApproval,
);
