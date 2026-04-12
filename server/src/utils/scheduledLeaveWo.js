/**
 * scheduledLeaveWo.js — Giao WO vs lịch nghỉ phép (LeaveStartAt / LeaveEndAt).
 * Phân công: chặn nếu ngày dự kiến (PlannedDate) nằm trong kỳ nghỉ; cho phép nếu ngày dự kiến > ngày kết thúc nghỉ.
 * Không có PlannedDate: giữ chặn khi đang trong kỳ nghỉ (onScheduledLeave).
 * Liên quan: workOrderFieldAssign.service.js, maintenanceGroup.service.js.
 */

/** @param {string|Date|null|undefined} d */
function toDateKeyLocal(d) {
  if (d == null || d === "") return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatViDate(d) {
  const k = toDateKeyLocal(d);
  if (!k) return "";
  const [yy, mm, dd] = k.split("-");
  return `${dd}/${mm}/${yy}`;
}

/**
 * @param {{ fullName?: string, leaveStartAt?: string|Date|null, leaveEndAt?: string|Date|null, onScheduledLeave?: boolean }} emp
 * @param {string|Date|null|undefined} plannedDate — WorkOrders.PlannedDate
 * @returns {string|null} Thông báo lỗi tiếng Việt hoặc null nếu được phép phân công
 */
export function messageIfAssignmentConflictsWithScheduledLeave(emp, plannedDate) {
  if (!emp?.leaveStartAt || !emp?.leaveEndAt) return null;
  const leaveStart = new Date(emp.leaveStartAt);
  const leaveEnd = new Date(emp.leaveEndAt);
  if (Number.isNaN(leaveStart.getTime()) || Number.isNaN(leaveEnd.getTime())) {
    return null;
  }

  const leaveStartKey = toDateKeyLocal(leaveStart);
  const leaveEndKey = toDateKeyLocal(leaveEnd);
  const plannedKey = toDateKeyLocal(plannedDate);

  const name = emp.fullName ?? "Nhân viên";

  if (!plannedKey) {
    if (emp.onScheduledLeave) {
      return (
        `${name} đang trong khung nghỉ phép có lịch — không phân công khi chưa có ngày dự kiến làm việc. ` +
        `Hãy ghi ngày dự kiến sau ${formatViDate(leaveEnd)} trên phiếu, hoặc chọn người khác.`
      );
    }
    return null;
  }

  if (plannedKey > leaveEndKey) return null;

  if (plannedKey >= leaveStartKey && plannedKey <= leaveEndKey) {
    return (
      `${name} có lịch nghỉ trùng ngày dự kiến làm việc (${formatViDate(plannedDate)}). ` +
      `Chọn người khác hoặc đổi ngày dự kiến sau ${formatViDate(leaveEnd)}.`
    );
  }

  return null;
}
