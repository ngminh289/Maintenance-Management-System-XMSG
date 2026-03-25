/**
 * workflow.routes.js — /api/workflows (quản lý mẫu luồng phê duyệt).
 * Level >= 3 mới có thể tạo/sửa/xóa. GET mở cho tất cả đã đăng nhập.
 * Liên quan: controllers/workflow.controller.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/workflow.controller.js';

export const workflowRouter = Router();

workflowRouter.use(requireAuth);

workflowRouter.get('/',    ctrl.getAll);
workflowRouter.get('/:id', ctrl.getById);

workflowRouter.post('/',   requireLevel(3), ctrl.create);
workflowRouter.put('/:id', requireLevel(3), ctrl.update);
workflowRouter.delete('/:id', requireLevel(3), ctrl.remove);

// Bước phê duyệt
workflowRouter.post('/:id/steps',            requireLevel(3), ctrl.addStep);
workflowRouter.put('/:id/steps/:stepId',     requireLevel(3), ctrl.updateStep);
workflowRouter.delete('/:id/steps/:stepId',  requireLevel(3), ctrl.removeStep);
