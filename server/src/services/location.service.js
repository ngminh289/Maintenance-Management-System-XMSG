/**
 * location.service.js — Nghiệp vụ Vị trí: quản lý cây vị trí (self-referential).
 * Dùng trong: controllers/location.controller.js.
 * Liên quan: models/location.model.js.
 */
import { createError } from '../utils/createError.js';
import * as model from '../models/location.model.js';

export async function getAll() {
  return model.findAll();
}

export async function getTree() {
  const nodes = await model.findAll();
  return buildTree(nodes);
}

export async function getById(id) {
  const loc = await model.findById(id);
  if (!loc) throw createError('Không tìm thấy vị trí', 404);
  return loc;
}

export async function create({ locationName, parentLocationId, description }) {
  if (parentLocationId) await getById(parentLocationId); // Đảm bảo parent tồn tại
  const id = await model.create({ locationName: locationName.trim(), parentLocationId, description });
  return model.findById(id);
}

export async function update(id, { locationName, parentLocationId, description }) {
  await getById(id);
  if (parentLocationId && Number(parentLocationId) === Number(id)) {
    throw createError('Vị trí không thể là cha của chính nó', 400);
  }
  if (parentLocationId) await getById(parentLocationId);
  await model.update(id, { locationName: locationName.trim(), parentLocationId, description });
  return model.findById(id);
}

export async function remove(id) {
  await getById(id);
  const childCount = await model.countChildren(id);
  if (childCount > 0) throw createError(`Không thể xóa: vị trí đang có ${childCount} vị trí con`, 409);
  const assetCount = await model.countAssets(id);
  if (assetCount > 0) throw createError(`Không thể xóa: vị trí đang có ${assetCount} tài sản`, 409);
  await model.remove(id);
}

function buildTree(nodes) {
  const map = {};
  nodes.forEach((n) => { map[n.locationId] = { ...n, children: [] }; });
  const roots = [];
  nodes.forEach((n) => {
    if (n.parentLocationId && map[n.parentLocationId]) {
      map[n.parentLocationId].children.push(map[n.locationId]);
    } else {
      roots.push(map[n.locationId]);
    }
  });
  return roots;
}
