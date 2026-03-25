/**
 * permission.service.js — Nghiệp vụ Roles_Permissions (RBAC).
 * Liên quan: models/permission.model.js.
 */
import { createError } from '../utils/createError.js';
import * as model from '../models/permission.model.js';

export async function getAll(positionId) {
  return model.findAll(positionId ? Number(positionId) : undefined);
}

export async function grant({ positionId, permissionName, resourceType }) {
  await model.create({ positionId: Number(positionId), permissionName, resourceType });
  return model.findAll(Number(positionId));
}

export async function revoke(id) {
  const affected = await model.remove(id);
  if (!affected) throw createError('Không tìm thấy quyền', 404);
}
