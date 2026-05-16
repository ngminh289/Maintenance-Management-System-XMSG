/**
 * notification.service.js — Gửi thông báo in-app.
 * ResourceType + ResourceID (migration 049) — cho phép frontend tạo link điều hướng.
 * Cú pháp ctx: { resourceType, resourceId } — cả hai optional.
 * Dùng trong: approval, workOrder, checklist, assetCounter, documentFeedback,
 *             maintenanceGroup, workOrderFieldAssign, maintenanceSchedule.
 */
import * as model from "../models/notification.model.js";
import * as employeeModel from "../models/employee.model.js";
import * as permissionModel from "../models/permission.model.js";
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

/**
 * Gửi cho mọi nhân viên có quyền RBAC (vd. CHECKLIST_RESULT + APPROVE = tiếp nhận checklist).
 * @param {string[]} [fallbackPermissionNames] — thử thêm nếu danh sách chính rỗng (tương thích DB cũ dùng UPDATE).
 */
export async function notifyByPermission(
  resourceType,
  permissionName,
  message,
  type = "SYSTEM_ALERT",
  ctx = {},
  fallbackPermissionNames = [],
) {
  let ids = await permissionModel.findActiveEmployeeIdsByPermission(permissionName, resourceType);
  if (ids.length === 0 && fallbackPermissionNames.length > 0) {
    const sets = await Promise.all(
      fallbackPermissionNames.map((name) =>
        permissionModel.findActiveEmployeeIdsByPermission(name, resourceType),
      ),
    );
    ids = [...new Set(sets.flat())];
  }
  if (ids.length === 0) return;
  await sendBulk(ids, message, type, ctx);
}

export async function getMyNotifications(recipientId, query) {
  const { limit, offset } = getPagination(query);
  const onlyUnread = query.unread === "true";
  const read = query.read === "true" ? true : (query.read === "false" ? false : null);
  const [items, unreadCount, total] = await Promise.all([
    model.findByRecipient(recipientId, { onlyUnread, read, limit, offset }),
    model.countUnread(recipientId),
    model.countByRecipient(recipientId, { onlyUnread, read }),
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

export async function markUnread(notiId, recipientId) {
  const affected = await model.markUnread(notiId, recipientId);
  if (!affected) throw Object.assign(new Error("Không tìm thấy thông báo"), { status: 404 });
}

export async function markAllUnread(recipientId) {
  await model.markAllUnread(recipientId);
}
