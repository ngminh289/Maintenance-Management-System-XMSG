/**
 * maintenanceSchedule.routes.js — /api/maintenance-schedules.
 * Phân quyền nghiêm ngặt theo RBAC.
 * Admin chỉ READ; Trưởng ca trở lên mới được CREATE/UPDATE/APPROVE.
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

// Gửi lịch vào luồng phê duyệt (DRAFT → ApprovalLog → Trưởng ca duyệt → PENDING)
maintenanceScheduleRouter.post('/:id/submit',
  requirePermission('MAINTENANCE_PLAN', 'CREATE'),
  ctrl.submitForApproval,
);
