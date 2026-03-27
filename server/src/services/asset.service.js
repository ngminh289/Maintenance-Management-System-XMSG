/**
 * asset.service.js — Nghiệp vụ Tài sản: CRUD + cập nhật trạng thái.
 * Dùng trong: controllers/asset.controller.js.
 * Liên quan: models/asset.model.js, utils/paginate.js.
 */
import { createError } from '../utils/createError.js';
import { getPagination, paginatedResult } from '../utils/paginate.js';
import * as model from '../models/asset.model.js';

export async function getAll(query) {
  const { page, limit, offset } = getPagination(query);
  const filters = {
    status: query.status || undefined,
    assetTypeId: query.assetTypeId ? Number(query.assetTypeId) : undefined,
    locationId: query.locationId ? Number(query.locationId) : undefined,
    search: query.search?.trim() || undefined,
  };

  const [items, total] = await Promise.all([
    model.findAll({ ...filters, limit, offset }),
    model.count(filters),
  ]);
  return paginatedResult(items, total, page, limit);
}

export async function getById(id) {
  const asset = await model.findById(id);
  if (!asset) throw createError('Không tìm thấy tài sản', 404);
  return asset;
}

export async function create(data) {
  const id = await model.create(data);
  return model.findById(id);
}

export async function update(id, fields) {
  await getById(id);
  await model.update(id, fields);
  return model.findById(id);
}

export async function updateStatus(id, status) {
  await getById(id);
  await model.updateStatus(id, status);
  return model.findById(id);
}

/**
 * Soft delete — project.rule: "Xóa: Soft delete (chuyển sang archive/DECOMMISSIONED)".
 * Không xóa thật, chuyển trạng thái để giữ lịch sử.
 */
export async function remove(id) {
  await getById(id);
  await model.updateStatus(id, 'DECOMMISSIONED');
}
