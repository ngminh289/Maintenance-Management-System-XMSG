/**
 * digitalAsset.service.js — Nghiệp vụ kho tài liệu kỹ thuật số.
 * Flow tài liệu: DRAFT → (submit) → PENDING → (approve) → APPROVED
 *               APPROVED → (new-version) → DRAFT
 * Liên quan: models/digitalAsset.model.js, models/tag.model.js,
 *            services/approval.service.js.
 */
import { createError } from '../utils/createError.js';
import { getPagination, paginatedResult } from '../utils/paginate.js';
import * as model       from '../models/digitalAsset.model.js';
import * as tagModel    from '../models/tag.model.js';
import * as approvalSvc from './approval.service.js';
import { unlink } from 'fs/promises';

export async function getAll(query) {
  const { page, limit, offset } = getPagination(query);
  const filters = {
    status:     query.status     || undefined,
    assetId:    query.assetId    ? Number(query.assetId)    : undefined,
    tagId:      query.tagId      ? Number(query.tagId)      : undefined,
    uploadedBy: query.uploadedBy ? Number(query.uploadedBy) : undefined,
  };
  const [items, total] = await Promise.all([
    model.findAll({ ...filters, limit, offset }),
    model.count(filters),
  ]);
  // Gắn thẻ vào từng item
  const withTags = await Promise.all(items.map(async (da) => ({
    ...da,
    tags: await tagModel.getTagsByDigitalAsset(da.digitalAssetId),
  })));
  return paginatedResult(withTags, total, page, limit);
}

export async function getById(id) {
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  const [tags, versions] = await Promise.all([
    tagModel.getTagsByDigitalAsset(id),
    model.getVersions(id),
  ]);
  return { ...da, tags, versions };
}

/** Upload tài liệu mới (multipart/form-data) */
export async function create({ fileName, fileType, assetId, description, uploadedBy, filePath, fileSizeKB, tagIds }) {
  const id = await model.create({ fileName, fileType, assetId, description, uploadedBy, filePath, fileSizeKB });
  // Gắn tags nếu có
  if (tagIds?.length) {
    await Promise.all(tagIds.map((tid) => tagModel.addTag(id, tid)));
  }
  return getById(id);
}

export async function update(id, { description, assetId }) {
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  await model.update(id, { description, assetId });
  return getById(id);
}

/** Gửi phê duyệt: DRAFT → PENDING */
export async function submitForApproval(id, submitterId, workflowId) {
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  if (da.status !== 'DRAFT') throw createError('Chỉ tài liệu ở trạng thái DRAFT mới được gửi duyệt', 400);

  await model.updateStatus(id, 'PENDING');
  const logId = await approvalSvc.submit({
    resourceType: 'DIGITAL_ASSET',
    resourceId: id,
    submitterId,
    workflowId,
  });
  return { logId, status: 'PENDING' };
}

/** Lưu phiên bản mới → trạng thái tự về DRAFT */
export async function addVersion(id, { filePath, fileSizeKB, changedBy, changeNote }) {
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  const newVer = await model.addVersion({ digitalAssetId: id, filePath, fileSizeKB, changedBy, changeNote });
  return { version: newVer, status: 'DRAFT' };
}

/** Archive tài liệu đã được duyệt */
export async function archive(id) {
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  if (da.status !== 'APPROVED') throw createError('Chỉ tài liệu đã duyệt mới được lưu trữ', 400);
  await model.updateStatus(id, 'ARCHIVED');
  return { status: 'ARCHIVED' };
}

export async function addTag(id, tagId) {
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  const tag = await tagModel.findById(tagId);
  if (!tag) throw createError('Không tìm thấy tag', 404);
  await tagModel.addTag(id, tagId);
  return tagModel.getTagsByDigitalAsset(id);
}

export async function removeTag(id, tagId) {
  await tagModel.removeTag(id, tagId);
  return tagModel.getTagsByDigitalAsset(id);
}

/** Xóa tài liệu — chỉ cho phép khi DRAFT hoặc REJECTED */
export async function remove(id) {
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  if (!['DRAFT', 'REJECTED'].includes(da.status)) {
    throw createError('Chỉ có thể xóa tài liệu ở trạng thái DRAFT hoặc REJECTED', 400);
  }
  // Xóa file vật lý
  try { await unlink(da.filePath); } catch { /* file có thể đã bị xóa */ }
  await model.remove(id);
}
