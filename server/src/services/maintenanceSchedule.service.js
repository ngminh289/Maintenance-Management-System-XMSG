/**
 * maintenanceSchedule.service.js — Nghiệp vụ lập lịch bảo trì + tạo WorkOrder từ lịch.
 * Liên quan: models/maintenanceSchedule.model.js, services/approval.service.js.
 */
import { createError } from '../utils/createError.js';
import { getPagination, paginatedResult } from '../utils/paginate.js';
import * as model from '../models/maintenanceSchedule.model.js';
import * as assetModel from '../models/asset.model.js';
import * as workOrderSvc from './workOrder.service.js';

export async function getAll(query) {
  const { page, limit, offset } = getPagination(query);
  const filters = {
    assetId: query.assetId ? Number(query.assetId) : undefined,
    status: query.status || undefined,
    maintenanceType: query.maintenanceType || undefined,
    priority: query.priority || undefined,
  };
  const [items, total] = await Promise.all([
    model.findAll({ ...filters, limit, offset }),
    model.count(filters),
  ]);
  return paginatedResult(items, total, page, limit);
}

export async function getById(id) {
  const schedule = await model.findById(id);
  if (!schedule) throw createError('Không tìm thấy lịch bảo trì', 404);
  return schedule;
}

export async function create(data, createdBy) {
  const asset = await assetModel.findById(data.assetId);
  if (!asset) throw createError('Không tìm thấy tài sản', 404);
  const id = await model.create({ ...data, createdBy });
  return model.findById(id);
}

export async function update(id, data) {
  await getById(id);
  await model.update(id, data);
  return model.findById(id);
}

export async function remove(id) {
  await getById(id);
  await model.remove(id);
}

export async function updateStatus(id, status) {
  await getById(id);
  await model.updateStatus(id, status);
  return model.findById(id);
}

/**
 * Tạo Work Order từ lịch bảo trì (kích hoạt thủ công hoặc auto).
 * Import dynamic để tránh circular dependency (workOrder → approval → notification).
 */
export async function generateWorkOrder(scheduleId, createdBy) {
  const schedule = await getById(scheduleId);
  const woId = await workOrderSvc.createAutomatic({
    assetId:     schedule.assetId,
    woSource:    'SCHEDULE',
    priority:    schedule.priority === 'URGENT' ? 'HIGH' : (schedule.priority || 'MEDIUM'),
    description: `Phiếu từ lịch bảo trì #${scheduleId}: ${schedule.description}`,
    createdBy,
  });
  return { workOrderId: woId, scheduleId };
}
