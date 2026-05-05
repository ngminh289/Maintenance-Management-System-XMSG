/**
 * notificationLink.js — Chuẩn hoá deep-link từ thông báo in-app.
 * QUAN TRỌNG: gom mapping 1 nơi để Topbar + NotificationsPage luôn nhất quán.
 */
export function buildNotificationResourceUrl(noti) {
  const resourceType = noti?.resourceType;
  const resourceId = noti?.resourceId;
  const type = String(noti?.type || "").toUpperCase();

  if (!resourceType || resourceId == null) return null;

  // Thông báo thuộc luồng phê duyệt luôn mở đúng tab Phê duyệt.
  if (type === "APPROVAL_REQUEST") {
    return `/approvals?resourceType=${encodeURIComponent(resourceType)}&resourceId=${encodeURIComponent(resourceId)}`;
  }

  switch (resourceType) {
    case "WORK_ORDER":
      return `/work-orders/${resourceId}`;
    case "DIGITAL_ASSET":
      return `/documents?docId=${resourceId}`;
    case "MAINTENANCE_PLAN":
      return `/schedules?scheduleId=${resourceId}`;
    case "CHECKLIST":
      return type === "APPROVAL_REQUEST"
        ? `/checklists/review?checklistId=${resourceId}`
        : `/checklists/history?focus=${resourceId}`;
    case "MAINTENANCE_GROUP":
      return `/employees?groupId=${resourceId}`;
    case "ASSET":
      return `/assets/${resourceId}`;
    default:
      return null;
  }
}
