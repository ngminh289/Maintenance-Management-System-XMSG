/**
 * assetType.service.js — Nghiệp vụ Loại tài sản: kiểm tra trùng tên, ràng buộc tài sản.
 * Dùng trong: controllers/assetType.controller.js.
 * Liên quan: models/assetType.model.js.
 */
import { createError } from '../utils/createError.js';
import * as model from '../models/assetType.model.js';

export async function getAll() {
  return model.findAll();
}

export async function getById(id) {
  const type = await model.findById(id);
  if (!type) throw createError('Không tìm thấy loại tài sản', 404);
  return type;
}

export async function create({ typeName, description, defaultPMInterval }) {
  const exists = await model.findByName(typeName.trim());
  if (exists) throw createError('Tên loại tài sản đã tồn tại', 409);
  const id = await model.create({ typeName: typeName.trim(), description, defaultPMInterval });
  return model.findById(id);
}

export async function update(id, { typeName, description, defaultPMInterval }) {
  await getById(id);
  const exists = await model.findByName(typeName.trim());
  if (exists && exists.assetTypeId !== Number(id)) throw createError('Tên loại tài sản đã tồn tại', 409);
  await model.update(id, { typeName: typeName.trim(), description, defaultPMInterval });
  return model.findById(id);
}

export async function remove(id) {
  await getById(id);
  const assetCount = await model.countAssets(id);
  if (assetCount > 0) throw createError(`Không thể xóa: đang có ${assetCount} tài sản thuộc loại này`, 409);
  await model.remove(id);
}
