/**
 * notification.service.js — Gửi thông báo in-app.
 * ResourceType + ResourceID (migration 049) — cho phép frontend tạo link điều hướng.
 * Cú pháp ctx: { resourceType, resourceId } — cả hai optional.
 * Dùng trong: approval, workOrder, checklist, assetCounter, documentFeedback,
 *             maintenanceGroup, workOrderFieldAssign, maintenanceSchedule.
 */
import * as model from "../models/notification.model.js";
import * as employeeModel from "../models/employee.model.js";
import { getPagination } from "../utils/paginate.js";

/**
 * Gửi thông báo đến 1 người.
 * @param {number} recipientId
 * @param {string} message
 * @param {string} type
 * @param {{ resourceType?: string, resourceId?: number }} ctx
 */
export async function send(recipientId, message, type = "SYSTEM_ALERT", ctx = {}) {
  await model.create({
    recipientId,
    message,
    type,
    resourceType: ctx.resourceType ?? null,
    resourceId:   ctx.resourceId   ?? null,
  });
}

/** Gửi cùng nội dung tới nhiều người. */
export async function sendBulk(recipientIds, message, type = "SYSTEM_ALERT", ctx = {}) {
  const ids = [...new Set(recipientIds.map(Number).filter((id) => Number.isFinite(id) && id > 0))];
  await Promise.all(ids.map((id) => send(id, message, type, ctx)));
}

/** Gửi cho tất cả nhân viên có Level >= minLevel. */
export async function notifyManagers(message, type = "SYSTEM_ALERT", minLevel = 2, ctx = {}) {
  const managers = await employeeModel.findAllByLevel(minLevel);
  await Promise.all(managers.map((m) => send(m.employeeId, message, type, ctx)));
}

export async function getMyNotifications(recipientId, query) {
  const { limit, offset } = getPagination(query);
  const onlyUnread = query.unread === "true";
  const [items, unreadCount, total] = await Promise.all([
    model.findByRecipient(recipientId, { onlyUnread, limit, offset }),
    model.countUnread(recipientId),
    model.countByRecipient(recipientId, { onlyUnread }),
  ]);
  return { items, unreadCount, total };
}

export async function markRead(notiId, recipientId) {
  const affected = await model.markRead(notiId, recipientId);
  if (!affected) throw Object.assign(new Error("Không tìm thấy thông báo"), { status: 404 });
}

export async function markAllRead(recipientId) {
  await model.markAllRead(recipientId);
}
