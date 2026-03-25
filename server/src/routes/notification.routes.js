/**
 * notification.routes.js — /api/notifications (in-app notification).
 * Liên quan: controllers/notification.controller.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import * as ctrl from '../controllers/notification.controller.js';

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

notificationRouter.get('/',              ctrl.getMyNotifications);
notificationRouter.patch('/:id/read',    ctrl.markRead);
notificationRouter.patch('/read-all',    ctrl.markAllRead);
