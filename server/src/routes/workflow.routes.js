/**
 * workflow.routes.js — /api/workflows (mẫu luồng phê duyệt).
 * BFD 4.1: Admin C/U mẫu workflow (WORKFLOW CREATE/UPDATE/DELETE); mọi người có READ xem cấu hình.
 * Liên quan: controllers/workflow.controller.js, middleware/requirePermission.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/requirePermission.js';
import * as ctrl from '../controllers/workflow.controller.js';

export const workflowRouter = Router();

workflowRouter.use(requireAuth);

workflowRouter.get('/',    requirePermission('WORKFLOW', 'READ'), ctrl.getAll);
workflowRouter.get('/:id', requirePermission('WORKFLOW', 'READ'), ctrl.getById);

workflowRouter.post('/',   requirePermission('WORKFLOW', 'CREATE'), ctrl.create);
workflowRouter.put('/:id', requirePermission('WORKFLOW', 'UPDATE'), ctrl.update);
workflowRouter.delete('/:id', requirePermission('WORKFLOW', 'DELETE'), ctrl.remove);

workflowRouter.post('/:id/steps',            requirePermission('WORKFLOW', 'UPDATE'), ctrl.addStep);
workflowRouter.put('/:id/steps/:stepId',     requirePermission('WORKFLOW', 'UPDATE'), ctrl.updateStep);
workflowRouter.delete('/:id/steps/:stepId',  requirePermission('WORKFLOW', 'UPDATE'), ctrl.removeStep);
