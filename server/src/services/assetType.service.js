/**
 * assetType.service.js — Nghiệp vụ Loại tài sản (cây 2 cấp — migration 048).
 * Ràng buộc:
 *   - Loại cha (ParentTypeID = null): không được gán DefaultPMValue/Unit.
 *   - Loại con (ParentTypeID != null): DefaultPMValue/Unit tùy chọn.
 *   - Không thể tạo type con từ type con (max 2 cấp).
 *   - Không xóa type cha còn con; không xóa type còn tài sản.
 * Dùng trong: controllers/assetType.controller.js.
 */
import { createError } from '../utils/createError.js';
import * as model from '../models/assetType.model.js';

const VALID_PM_UNITS = ['HOURS', 'DAYS', 'WEEKS', 'MONTHS', 'YEARS'];

export async function getAll() {
  return model.findAll();
}

/** Chỉ trả loại con (leaf) — dùng cho dropdown AssetForm + SchedulesPage. */
export async function getLeaves() {
  return model.findLeaves();
}

export async function getById(id) {
  const type = await model.findById(id);
  if (!type) throw createError('Không tìm thấy loại tài sản', 404);
  return type;
}

export async function create(body) {
  const { typeName, parentTypeId, defaultPMValue, defaultPMUnit, description } = body;

  // Kiểm tra trùng tên
  const exists = await model.findByName(typeName.trim());
  if (exists) throw createError('Tên loại tài sản đã tồn tại', 409);

  if (parentTypeId) {
    // Loại con: parent phải tồn tại và phải là type cha (ParentTypeID = null)
    const parent = await model.findById(parentTypeId);
    if (!parent) throw createError('Loại cha không tồn tại', 404);
    if (parent.parentTypeId != null) throw createError('Không thể tạo type con từ type con (max 2 cấp)', 400);

    // Validate PM nếu có
    if (defaultPMValue != null && defaultPMUnit == null) {
      throw createError('Cần chọn đơn vị chu kỳ PM khi nhập giá trị', 400);
    }
    if (defaultPMUnit != null && !VALID_PM_UNITS.includes(defaultPMUnit)) {
      throw createError('Đơn vị PM không hợp lệ', 400);
    }
  } else {
    // Loại cha: không được có PM
    if (defaultPMValue || defaultPMUnit) {
      throw createError('Chu kỳ PM chỉ thiết lập cho loại con', 400);
    }
  }

  const id = await model.create({
    typeName: typeName.trim(),
    parentTypeId: parentTypeId ? Number(parentTypeId) : null,
    defaultPMValue: defaultPMValue ? Number(defaultPMValue) : null,
    defaultPMUnit:  defaultPMUnit  || null,
    description,
  });
  return model.findById(id);
}

export async function update(id, body) {
  await getById(id);
  const { typeName, parentTypeId, defaultPMValue, defaultPMUnit, description } = body;

  const exists = await model.findByName(typeName.trim());
  if (exists && exists.assetTypeId !== Number(id)) throw createError('Tên loại tài sản đã tồn tại', 409);

  if (parentTypeId) {
    if (Number(parentTypeId) === Number(id)) throw createError('Loại không thể là cha của chính nó', 400);
    const parent = await model.findById(parentTypeId);
    if (!parent) throw createError('Loại cha không tồn tại', 404);
    if (parent.parentTypeId != null) throw createError('Không thể làm con của type con (max 2 cấp)', 400);
    if (defaultPMValue != null && defaultPMUnit == null) {
      throw createError('Cần chọn đơn vị chu kỳ PM khi nhập giá trị', 400);
    }
  } else {
    if (defaultPMValue || defaultPMUnit) {
      throw createError('Chu kỳ PM chỉ thiết lập cho loại con', 400);
    }
    // Nếu loại cha bị xóa parent → check không đổi thành cha khi có con
    const childCount = await model.countChildren(id);
    if (childCount > 0 && parentTypeId != null) {
      // Cho phép vì vẫn là cha (parentTypeId = null giữ nguyên)
    }
  }

  await model.update(id, {
    typeName: typeName.trim(),
    parentTypeId: parentTypeId ? Number(parentTypeId) : null,
    defaultPMValue: defaultPMValue ? Number(defaultPMValue) : null,
    defaultPMUnit:  defaultPMUnit  || null,
    description,
  });
  return model.findById(id);
}

export async function remove(id) {
  await getById(id);

  const childCount = await model.countChildren(id);
  if (childCount > 0) throw createError(`Không thể xóa: loại này còn ${childCount} loại con`, 409);

  const assetCount = await model.countAssets(id);
  if (assetCount > 0) throw createError(`Không thể xóa: đang có ${assetCount} tài sản thuộc loại này`, 409);

  await model.remove(id);
}
