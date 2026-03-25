/**
 * maintenanceGroup.routes.js — /api/maintenance-groups.
 * Liên quan: controllers/maintenanceGroup.controller.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/maintenanceGroup.controller.js';

export const maintenanceGroupRouter = Router();

maintenanceGroupRouter.use(requireAuth);

maintenanceGroupRouter.get('/',    ctrl.getAll);
maintenanceGroupRouter.get('/:id', ctrl.getById);
maintenanceGroupRouter.post('/',   requireLevel(2), ctrl.create);
maintenanceGroupRouter.put('/:id', requireLevel(2), ctrl.update);
maintenanceGroupRouter.delete('/:id', requireLevel(3), ctrl.remove);

// Thành viên
maintenanceGroupRouter.post('/:id/members',                  requireLevel(2), ctrl.addMember);
maintenanceGroupRouter.delete('/:id/members/:employeeId',    requireLevel(2), ctrl.removeMember);

// Gán cả nhóm vào Work Order
maintenanceGroupRouter.post('/:id/assign-wo/:woId', requireLevel(2), ctrl.assignGroupToWO);
