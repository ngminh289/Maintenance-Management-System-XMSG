/**
 * workOrder.service.js — Nghiệp vụ Phiếu công việc: tạo, phân công, chuyển trạng thái.
 * luongpheduyet.rule: PENDING_APPROVAL → WAITING → IN_PROGRESS → COMPLETED/CANCELLED.
 * Liên quan: models/workOrder.model.js, services/approval.service.js, services/notification.service.js.
 */
import { createError }  from '../utils/createError.js';
import { getPagination, paginatedResult } from '../utils/paginate.js';
import * as model       from '../models/workOrder.model.js';
import * as approvalSvc from './approval.service.js';
import * as notifService from './notification.service.js';
import * as assetModel  from '../models/asset.model.js';

// Trạng thái cho phép chuyển tiếp (guard)
const TRANSITIONS = {
  PENDING_APPROVAL: [],               // Chờ sếp duyệt, không cho thợ đổi
  WAITING:          ['IN_PROGRESS'],  // Thợ nhận việc
  IN_PROGRESS:      ['PAUSED', 'COMPLETED'],
  PAUSED:           ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED:        [],
  CANCELLED:        [],
};

export async function getAll(query) {
  const { page, limit, offset } = getPagination(query);
  const filters = {
    status:     query.status || undefined,
    assetId:    query.assetId    ? Number(query.assetId)    : undefined,
    priority:   query.priority   || undefined,
    woSource:   query.woSource   || undefined,
    assignedTo: query.assignedTo ? Number(query.assignedTo) : undefined,
  };
  const [items, total] = await Promise.all([
    model.findAll({ ...filters, limit, offset }),
    model.count(filters),
  ]);
  return paginatedResult(items, total, page, limit);
}

export async function getById(id) {
  const wo = await model.findById(id);
  if (!wo) throw createError('Không tìm thấy phiếu công việc', 404);
  const assignments = await model.getAssignments(id);
  return { ...wo, assignments };
}

/** Tạo WorkOrder thủ công (Level >= 2) + tự động submit approval */
export async function create(data, createdBy) {
  const asset = await assetModel.findById(data.assetId);
  if (!asset) throw createError('Không tìm thấy tài sản', 404);

  const woId = await model.create({ ...data, status: 'PENDING_APPROVAL', createdBy });

  // Smart routing: truyền source/priority để approval chọn đúng workflow
  await approvalSvc.submit({
    resourceType: 'WORK_ORDER', resourceId: woId, submitterId: createdBy,
    woSource: data.woSource, woPriority: data.priority,
  });

  return model.findById(woId);
}

/** Tạo WorkOrder tự động (từ checklist NG/WARNING hoặc hệ thống dự báo) */
export async function createAutomatic({ assetId, woSource, priority, description, createdBy }) {
  const woId = await model.create({
    assetId, woSource, priority, status: 'PENDING_APPROVAL',
    plannedDate: new Date().toISOString().split('T')[0],
    description: description || `Phiếu tự động (${woSource})`,
    createdBy: createdBy || null,
  });
  // Smart routing theo source/priority
  await approvalSvc.submit({
    resourceType: 'WORK_ORDER', resourceId: woId, submitterId: createdBy,
    woSource, woPriority: priority,
  });
  return woId;
}

export async function update(id, data) {
  const wo = await getById(id);
  if (['COMPLETED', 'CANCELLED'].includes(wo.status)) throw createError('Không thể sửa phiếu đã kết thúc', 400);
  await model.update(id, data);
  return getById(id);
}

/** Chuyển trạng thái phiếu với validation */
export async function changeStatus(id, newStatus, { actorLevel, actualHours } = {}) {
  const wo = await model.findById(id);
  if (!wo) throw createError('Không tìm thấy phiếu công việc', 404);

  const allowed = TRANSITIONS[wo.status] || [];
  if (!allowed.includes(newStatus)) {
    throw createError(`Không thể chuyển từ ${wo.status} → ${newStatus}`, 400);
  }

  // Chỉ level >= 2 mới được huỷ
  if (newStatus === 'CANCELLED' && (actorLevel ?? 0) < 2) {
    throw createError('Không đủ quyền hủy phiếu', 403);
  }

  const extra = newStatus === 'COMPLETED'
    ? { actualDate: new Date().toISOString().split('T')[0], actualHours }
    : {};

  await model.updateStatus(id, newStatus, extra);

  // Khi WO hoàn thành → máy trở về AVAILABLE (Workflow sheet 3.1 bước 3)
  if (newStatus === 'COMPLETED' && wo.assetId) {
    await assetModel.updateStatus(wo.assetId, 'AVAILABLE');
  }

  // Thông báo khi phiếu bắt đầu hoặc hoàn thành
  if (newStatus === 'IN_PROGRESS') {
    const assignments = await model.getAssignments(id);
    for (const a of assignments) {
      await notifService.send(a.employeeId, `Phiếu WO #${id} đã bắt đầu. Vui lòng theo dõi.`, 'WORK_ORDER_ASSIGNED');
    }
  }

  if (newStatus === 'COMPLETED' && wo.createdBy) {
    await notifService.send(wo.createdBy, `Phiếu WO #${id} đã hoàn thành. Tài sản đã trở lại AVAILABLE.`, 'WORK_ORDER_COMPLETED');
  }

  return model.findById(id);
}

export async function assign(woId, employeeId) {
  await model.findById(woId).then((w) => { if (!w) throw createError('Không tìm thấy phiếu', 404); });
  await model.assign(woId, employeeId);
  await notifService.send(employeeId, `Bạn được phân công vào phiếu WO #${woId}`, 'WORK_ORDER_ASSIGNED');
  return model.getAssignments(woId);
}

export async function unassign(woId, employeeId) {
  await model.unassign(woId, employeeId);
  return model.getAssignments(woId);
}

export async function remove(id) {
  const wo = await model.findById(id);
  if (!wo) throw createError('Không tìm thấy phiếu công việc', 404);
  if (!['CANCELLED', 'PENDING_APPROVAL'].includes(wo.status)) {
    throw createError('Chỉ được xóa phiếu ở trạng thái CANCELLED hoặc PENDING_APPROVAL', 400);
  }
  await model.remove(id);
}
