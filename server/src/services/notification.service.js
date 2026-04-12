/**
 * notification.service.js — Gửi thông báo in-app.
 * Dùng trong: approval, workOrder, checklist, assetCounter, documentFeedback.
 * Loại DOCUMENT_FEEDBACK_* — migration 039.
 * Liên quan: models/notification.model.js, models/employee.model.js.
 */
import * as model from "../models/notification.model.js";
import * as employeeModel from "../models/employee.model.js";
import { getPagination } from "../utils/paginate.js";

export async function send(recipientId, message, type = "SYSTEM_ALERT") {
  await model.create({ recipientId, message, type });
}

/** Gửi cùng nội dung tới nhiều người (VD: mọi NV Kỹ thuật khi có phản hồi tài liệu). */
export async function sendBulk(recipientIds, message, type = "SYSTEM_ALERT") {
  const ids = [...new Set(recipientIds.map(Number).filter((id) => Number.isFinite(id) && id > 0))];
  await Promise.all(ids.map((id) => model.create({ recipientId: id, message, type })));
}

/** Gửi cho tất cả nhân viên có Level >= minLevel */
export async function notifyManagers(
  message,
  type = "SYSTEM_ALERT",
  minLevel = 2,
) {
  const managers = await employeeModel.findAllByLevel(minLevel);
  await Promise.all(managers.map((m) => send(m.employeeId, message, type)));
}

export async function getMyNotifications(recipientId, query) {
  const { limit, offset } = getPagination(query);
  const onlyUnread = query.unread === "true";
  const [items, unreadCount] = await Promise.all([
    model.findByRecipient(recipientId, { onlyUnread, limit, offset }),
    model.countUnread(recipientId),
  ]);
  return { items, unreadCount };
}

export async function markRead(notiId, recipientId) {
  const affected = await model.markRead(notiId, recipientId);
  if (!affected)
    throw Object.assign(new Error("Không tìm thấy thông báo"), { status: 404 });
}

export async function markAllRead(recipientId) {
  await model.markAllRead(recipientId);
}
