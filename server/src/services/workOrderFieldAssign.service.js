/**
 * workOrderFieldAssign.service.js — Phân công nhân viên / nhóm lên phiếu WO.
 * Cá nhân: xóa phân công cũ trước rồi thêm người mới (IsGroupLeader = true).
 * Nhóm: trưởng nhóm lấy từ GroupMembers.IsGroupLeader=1 (không cần chọn thêm).
 *   - Nhóm phải có trưởng nhóm cố định, nếu chưa có thì lỗi.
 *   - Tất cả thành viên được gán; trưởng nhóm có IsGroupLeader=1.
 * Thông báo: tất cả thành viên được thông báo khi WO giao cho nhóm.
 * Dùng trong: workOrder.service.js (assign), approval.service.js (duyệt xong).
 */
import { createError } from "../utils/createError.js";
import * as model          from "../models/workOrder.model.js";
import * as groupModel     from "../models/maintenanceGroup.model.js";
import * as employeeModel  from "../models/employee.model.js";
import * as notifService   from "./notification.service.js";
import { messageIfAssignmentConflictsWithScheduledLeave } from "../utils/scheduledLeaveWo.js";

const MAX_ASSIGNEE_LEVEL = 2;

/** Kiểm tra toàn bộ điều kiện phân công nhóm (không ghi DB). */
export async function validateGroupAssignment(woId, groupId, actorLevel) {
  if ((actorLevel ?? 0) < 3) {
    throw createError("Chỉ Trưởng ca / Trưởng phòng được phân công nhóm lên phiếu việc.", 403);
  }
  const [wo, group] = await Promise.all([
    model.findById(woId),
    groupModel.findById(groupId),
  ]);
  if (!wo) throw createError("Không tìm thấy phiếu", 404);
  if (!group) throw createError("Không tìm thấy nhóm bảo trì", 404);

  const members = await groupModel.getMembers(groupId);
  if (members.length === 0) throw createError("Nhóm chưa có thành viên", 400);

  const leader = members.find((m) => Number(m.isGroupLeader) === 1);
  if (!leader) {
    throw createError(
      `Nhóm "${group.groupName}" chưa có trưởng nhóm. Hãy đặt trưởng nhóm trong trang Nhân sự → Nhóm bảo trì trước.`,
      400,
    );
  }

  for (const m of members) {
    const emp = await employeeModel.findById(m.employeeId);
    if (!emp || !emp.isActive) {
      throw createError(`Nhân viên ${m.fullName} không còn hoạt động`, 400);
    }
    const leaveMsg = messageIfAssignmentConflictsWithScheduledLeave(emp, wo.plannedDate);
    if (leaveMsg) throw createError(leaveMsg, 400);
  }

  return { wo, group, members, leader };
}

/** Kiểm tra toàn bộ điều kiện phân công cá nhân (không ghi DB). */
export async function validateFieldTechnicianAssignment(woId, assigneeEmployeeId, actorLevel) {
  if ((actorLevel ?? 0) < 3) {
    throw createError("Chỉ Trưởng ca / Trưởng phòng được phân công nhân sự trên phiếu việc.", 403);
  }
  const w = await model.findById(woId);
  if (!w) throw createError("Không tìm thấy phiếu", 404);
  const emp = await employeeModel.findById(assigneeEmployeeId);
  if (!emp) throw createError("Không tìm thấy nhân viên", 404);
  if (!emp.isActive) throw createError("Nhân viên đang vô hiệu, không thể phân công", 400);
  if ((emp.positionLevel ?? 99) > MAX_ASSIGNEE_LEVEL) {
    throw createError("Chỉ được phân công KTV hiện trường hoặc Chuyên viên kỹ thuật số.", 403);
  }
  const leaveMsg = messageIfAssignmentConflictsWithScheduledLeave(emp, w.plannedDate);
  if (leaveMsg) throw createError(leaveMsg, 400);
}

/**
 * Phân công cá nhân — xóa phân công cũ, thêm người mới (tự là leader).
 */
export async function assignFieldTechnicianToWorkOrder(woId, assigneeEmployeeId, actorLevel, options = {}) {
  if (!options.skipValidation) {
    await validateFieldTechnicianAssignment(woId, assigneeEmployeeId, actorLevel);
  }
  // Xóa phân công cũ trước khi ghi đè
  await model.clearAssignments(woId);
  await model.assign(woId, assigneeEmployeeId, true);
  await notifService.send(
    assigneeEmployeeId,
    `Bạn được phân công thực hiện phiếu WO #${woId}`,
    "WORK_ORDER_ASSIGNED",
    { resourceType: "WORK_ORDER", resourceId: woId },
  );
  return model.getAssignments(woId);
}

/**
 * Phân công nhóm lên phiếu việc.
 * - Tự động lấy trưởng nhóm từ GroupMembers.IsGroupLeader = 1.
 * - Nhóm phải đã có trưởng nhóm, nếu chưa báo lỗi.
 * - Xóa phân công cũ (nếu replaceExisting = true).
 * - Thêm tất cả thành viên nhóm; leader nhận IsGroupLeader = 1.
 * - Gửi thông báo riêng cho từng người, thông báo đặc biệt cho leader.
 */
export async function assignGroupToWorkOrder(woId, groupId, actorLevel, { replaceExisting = true } = {}) {
  const { group, members, leader } = await validateGroupAssignment(
    woId,
    groupId,
    actorLevel,
  );

  if (replaceExisting) {
    await model.clearAssignments(woId);
  }

  for (const m of members) {
    const isLeader = Number(m.employeeId) === Number(leader.employeeId);
    await model.assign(woId, m.employeeId, isLeader);
  }

  // Gửi thông báo
  await Promise.all(members.map(m => {
    const isLeader = Number(m.employeeId) === Number(leader.employeeId);
    const msg = isLeader
      ? `Bạn là Trưởng nhóm phụ trách phiếu WO #${woId} (Nhóm: ${group.groupName})`
      : `Nhóm "${group.groupName}" được giao phiếu WO #${woId}`;
    return notifService.send(m.employeeId, msg, "WORK_ORDER_ASSIGNED", { resourceType: "WORK_ORDER", resourceId: woId });
  }));

  return model.getAssignments(woId);
}
