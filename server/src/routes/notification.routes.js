/**
 * notification.routes.js — /api/notifications (in-app notification).
 * QUAN TRỌNG: các route cụ thể (/unread-count, /read-all) phải đứng TRƯỚC /:id
 * để Express không match nhầm.
 * Liên quan: controllers/notification.controller.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import * as ctrl from '../controllers/notification.controller.js';

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

notificationRouter.get('/',               ctrl.getMyNotifications);
notificationRouter.get('/unread-count',   ctrl.getUnreadCount);    // Phải trước /:id
notificationRouter.patch('/read-all',     ctrl.markAllRead);        // Phải trước /:id/read
notificationRouter.patch('/unread-all',   ctrl.markAllUnread);      // Phải trước /:id/unread
notificationRouter.patch('/:id/read',     ctrl.markRead);
notificationRouter.patch('/:id/unread',   ctrl.markUnread);
