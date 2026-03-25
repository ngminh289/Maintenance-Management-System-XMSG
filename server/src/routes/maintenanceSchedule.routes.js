/**
 * maintenanceSchedule.routes.js — /api/maintenance-schedules.
 * Liên quan: controllers/maintenanceSchedule.controller.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { createScheduleSchema, updateScheduleSchema } from '../validators/maintenanceSchedule.validator.js';
import * as ctrl from '../controllers/maintenanceSchedule.controller.js';

export const maintenanceScheduleRouter = Router();

maintenanceScheduleRouter.use(requireAuth);

maintenanceScheduleRouter.get('/',    ctrl.getAll);
maintenanceScheduleRouter.get('/:id', ctrl.getById);
maintenanceScheduleRouter.post('/',   requireLevel(2), validate(createScheduleSchema), ctrl.create);
maintenanceScheduleRouter.put('/:id', requireLevel(2), validate(updateScheduleSchema), ctrl.update);
maintenanceScheduleRouter.patch('/:id/status', requireLevel(2), ctrl.updateStatus);
maintenanceScheduleRouter.delete('/:id', requireLevel(3), ctrl.remove);

// Tạo Work Order từ lịch bảo trì (Level >= 2)
maintenanceScheduleRouter.post('/:id/generate-work-order', requireLevel(2), ctrl.generateWorkOrder);;
