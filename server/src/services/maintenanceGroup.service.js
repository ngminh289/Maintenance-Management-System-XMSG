/**
 * maintenanceGroup.service.js — Nghiệp vụ nhóm bảo trì.
 * Specialty: trường tổng của nhóm (migration 046, không còn per-member).
 * IsGroupLeader: trưởng nhóm cố định (migration 045) — duy nhất 1 người/nhóm.
 * Thông báo: thêm thành viên → notify; đặt trưởng nhóm → notify đặc biệt.
 * Liên quan: maintenanceGroup.model, workOrder.model, notification.service.
 */
import { createError } from "../utils/createError.js";
import * as model from "../models/maintenanceGroup.model.js";
import * as employeeModel from "../models/employee.model.js";
import * as woModel from "../models/workOrder.model.js";
import * as notifService from "./notification.service.js";
import { messageIfAssignmentConflictsWithScheduledLeave } from "../utils/scheduledLeaveWo.js";

export async function getAll() {
  return model.findAll();
}

export async function getById(id) {
  const group = await model.findById(id);
  if (!group) throw createError("Không tìm thấy nhóm bảo trì", 404);
  const members = await model.getMembers(id);
  return { ...group, members };
}

export async function create({ groupName, specialty, description }) {
  if (!groupName?.trim())
    throw createError("Tên nhóm không được để trống", 400);
  const id = await model.create({
    groupName: groupName.trim(),
    specialty: specialty?.trim() || null,
    description,
  });
  return getById(id);
}

export async function update(id, { groupName, specialty, description }) {
  const g = await model.findById(id);
  if (!g) throw createError("Không tìm thấy nhóm", 404);
  await model.update(id, {
    groupName: groupName?.trim() || undefined,
    specialty: specialty !== undefined ? (specialty?.trim() || null) : undefined,
    description,
  });
  return getById(id);
}

/** Soft-delete nhóm. Không được xóa khi nhóm đang có WO hoạt động. */
export async function remove(id) {
  const g = await model.findById(id);
  if (!g) throw createError("Không tìm thấy nhóm bảo trì", 404);
  const busy = await model.hasActiveWorkOrders(id);
  if (busy) {
    throw createError(
      "Nhóm đang có phiếu việc chưa hoàn tất — không thể giải thể. Vui lòng hoàn tất hoặc huỷ các phiếu đó trước.",
      409,
    );
  }
  await model.deactivate(id);
}

export async function addMember(groupId, employeeId, { roleNotes, notes } = {}) {
  const [group, emp] = await Promise.all([
    model.findById(groupId),
    employeeModel.findById(employeeId),
  ]);
  if (!group) throw createError("Không tìm thấy nhóm", 404);
  if (!emp) throw createError("Không tìm thấy nhân viên", 404);
  await model.addMember(groupId, employeeId, { roleNotes, notes });
  // Thông báo cho thành viên mới
  await notifService.send(
    employeeId,
    `Bạn đã được thêm vào nhóm bảo trì "${group.groupName}"`,
    "MAINTENANCE_GROUP_JOINED",
    { resourceType: "MAINTENANCE_GROUP", resourceId: groupId },
  );
  return model.getMembers(groupId);
}

export async function updateMember(groupId, employeeId, fields) {
  const group = await model.findById(groupId);
  if (!group) throw createError("Không tìm thấy nhóm", 404);
  await model.updateMember(groupId, employeeId, fields);
  return model.getMembers(groupId);
}

/** Đặt trưởng nhóm cố định. Thông báo cho người được chỉ định. */
export async function setGroupLeader(groupId, employeeId) {
  const group = await model.findById(groupId);
  if (!group) throw createError("Không tìm thấy nhóm", 404);
  const members = await model.getMembers(groupId);
  const exists = members.some(m => Number(m.employeeId) === Number(employeeId));
  if (!exists) throw createError("Nhân viên không thuộc nhóm này", 400);
  await model.setGroupLeader(groupId, employeeId);
  await notifService.send(
    employeeId,
    `Bạn đã được chỉ định làm Trưởng nhóm của nhóm "${group.groupName}"`,
    "MAINTENANCE_GROUP_LEADER",
    { resourceType: "MAINTENANCE_GROUP", resourceId: groupId },
  );
  return model.getMembers(groupId);
}

export async function removeMember(groupId, employeeId) {
  await model.removeMember(groupId, employeeId);
  return model.getMembers(groupId);
}

/** Gán toàn bộ thành viên nhóm vào một Work Order (legacy — ít dùng). */
export async function assignGroupToWO(groupId, woId) {
  const [group, wo] = await Promise.all([
    model.findById(groupId),
    woModel.findById(woId),
  ]);
  if (!group) throw createError("Không tìm thấy nhóm", 404);
  if (!wo) throw createError("Không tìm thấy phiếu công việc", 404);
  const members = await model.getMembers(groupId);
  for (const m of members) {
    const emp = await employeeModel.findById(m.employeeId);
    const leaveMsg = messageIfAssignmentConflictsWithScheduledLeave(emp, wo.plannedDate);
    if (leaveMsg) throw createError(leaveMsg, 400);
  }
  await Promise.all(members.map((m) => woModel.assign(woId, m.employeeId)));
  return woModel.getAssignments(woId);
}
