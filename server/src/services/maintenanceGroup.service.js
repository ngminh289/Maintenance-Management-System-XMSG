/**
 * maintenanceGroup.service.js — Nghiệp vụ nhóm bảo trì.
 * Liên quan: models/maintenanceGroup.model.js, services/workOrder.service.js.
 */
import { createError } from '../utils/createError.js';
import * as model       from '../models/maintenanceGroup.model.js';
import * as employeeModel from '../models/employee.model.js';
import * as woModel     from '../models/workOrder.model.js';

export async function getAll() {
  return model.findAll();
}

export async function getById(id) {
  const group = await model.findById(id);
  if (!group) throw createError('Không tìm thấy nhóm bảo trì', 404);
  const members = await model.getMembers(id);
  return { ...group, members };
}

export async function create({ groupName, description }) {
  if (!groupName?.trim()) throw createError('Tên nhóm không được để trống', 400);
  const id = await model.create({ groupName: groupName.trim(), description });
  return getById(id);
}

export async function update(id, { groupName, description }) {
  await model.findById(id).then((g) => { if (!g) throw createError('Không tìm thấy nhóm', 404); });
  await model.update(id, { groupName: groupName?.trim() || undefined, description });
  return getById(id);
}

export async function remove(id) {
  const g = await model.findById(id);
  if (!g) throw createError('Không tìm thấy nhóm bảo trì', 404);
  await model.remove(id);
}

export async function addMember(groupId, employeeId, roleNotes) {
  const [group, emp] = await Promise.all([model.findById(groupId), employeeModel.findById(employeeId)]);
  if (!group) throw createError('Không tìm thấy nhóm', 404);
  if (!emp)   throw createError('Không tìm thấy nhân viên', 404);
  await model.addMember(groupId, employeeId, roleNotes);
  return model.getMembers(groupId);
}

export async function removeMember(groupId, employeeId) {
  await model.removeMember(groupId, employeeId);
  return model.getMembers(groupId);
}

/** Gán toàn bộ thành viên nhóm vào một Work Order */
export async function assignGroupToWO(groupId, woId) {
  const [group, wo] = await Promise.all([model.findById(groupId), woModel.findById(woId)]);
  if (!group) throw createError('Không tìm thấy nhóm', 404);
  if (!wo)    throw createError('Không tìm thấy phiếu công việc', 404);
  const members = await model.getMembers(groupId);
  await Promise.all(members.map((m) => woModel.assign(woId, m.employeeId)));
  return woModel.getAssignments(woId);
}
