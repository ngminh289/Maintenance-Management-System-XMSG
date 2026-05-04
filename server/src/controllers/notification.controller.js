/**
 * notification.controller.js — HTTP handler: /api/notifications.
 * Liên quan: services/notification.service.js, routes/notification.routes.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/notification.service.js';

export const getMyNotifications = asyncHandler(async (req, res) =>
  ok(res, await service.getMyNotifications(req.user.sub, req.query)));

export const getUnreadCount = asyncHandler(async (req, res) => {
  const result = await service.getMyNotifications(req.user.sub, { limit: 1, offset: 0 });
  return ok(res, { count: result.unreadCount });
});

export const markRead = asyncHandler(async (req, res) => {
  await service.markRead(Number(req.params.id), req.user.sub);
  return ok(res, { message: 'Đã đánh dấu đã đọc.' });
});

export const markAllRead = asyncHandler(async (req, res) => {
  await service.markAllRead(req.user.sub);
  return ok(res, { message: 'Đã đánh dấu tất cả là đã đọc.' });
});

export const markUnread = asyncHandler(async (req, res) => {
  await service.markUnread(Number(req.params.id), req.user.sub);
  return ok(res, { message: 'Đã chuyển về chưa đọc.' });
});

export const markAllUnread = asyncHandler(async (req, res) => {
  await service.markAllUnread(req.user.sub);
  return ok(res, { message: 'Đã đánh dấu tất cả là chưa đọc.' });
});
