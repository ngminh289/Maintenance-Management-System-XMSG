/**
 * digitalAsset.service.js — Nghiệp vụ kho tài liệu kỹ thuật số.
 * Flow tài liệu: DRAFT → (submit) → PENDING → (approve) → APPROVED
 *               APPROVED → (new-version) → DRAFT
 * Phiên bản: create → AssetVersions v1 + DigitalAssets; addVersion → v2+ và trỏ file hiện tại.
 * Liên quan: models/digitalAsset.model.js, migration 036.
 */
import { createError } from '../utils/createError.js';
import { getPagination, paginatedResult } from '../utils/paginate.js';
import * as model            from '../models/digitalAsset.model.js';
import * as tagModel         from '../models/tag.model.js';
import * as documentCategoryModel from '../models/documentCategory.model.js';
import * as approvalSvc from './approval.service.js';
import { unlink } from 'fs/promises';
import { resolveDocumentAbsolutePath } from '../config/upload.js';

/** Tài liệu ở PENDING: khóa metadata, tag, phiên bản (BFD 4 — bước 3). */
function assertNotPending(da, action = 'chỉnh sửa') {
  if (da.status === 'PENDING') {
    throw createError(
      `Tài liệu đang chờ phê duyệt — không thể ${action}. Chờ Trưởng ca/Trưởng phòng xử lý hoặc thu hồi (từ chối / yêu cầu sửa).`,
      400,
    );
  }
}

async function assertCategoryId(documentCategoryId) {
  if (documentCategoryId == null || documentCategoryId === '') return;
  const id = Number(documentCategoryId);
  if (!Number.isFinite(id) || id < 1) throw createError('documentCategoryId không hợp lệ', 400);
  const cat = await documentCategoryModel.findById(id);
  if (!cat) throw createError('Không tìm thấy phân loại', 404);
}

export async function getAll(query) {
  const { page, limit, offset } = getPagination(query);
  const filters = {
    status:               query.status     || undefined,
    assetId:              query.assetId    ? Number(query.assetId)    : undefined,
    tagId:                query.tagId      ? Number(query.tagId)      : undefined,
    uploadedBy:           query.uploadedBy ? Number(query.uploadedBy) : undefined,
    documentCategoryId: (() => {
      const raw = query.documentCategoryId;
      if (raw == null || raw === '') return undefined;
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })(),
    q:                    query.q || undefined,
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
export async function create({
  fileName,
  fileType,
  assetId,
  documentCategoryId,
  description,
  uploadedBy,
  filePath,
  fileSizeKB,
  tagIds,
}) {
  await assertCategoryId(documentCategoryId);
  const id = await model.create({
    fileName,
    fileType,
    assetId,
    documentCategoryId,
    description,
    uploadedBy,
    filePath,
    fileSizeKB,
  });
  // Gắn tags nếu có
  if (tagIds?.length) {
    await Promise.all(tagIds.map((tid) => tagModel.addTag(id, tid)));
  }
  return getById(id);
}

export async function update(id, { description, assetId, documentCategoryId }) {
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  assertNotPending(da, 'cập nhật mô tả / tài sản / phân loại');
  if (documentCategoryId !== undefined) await assertCategoryId(documentCategoryId);
  await model.update(id, { description, assetId, documentCategoryId });
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
  assertNotPending(da, 'upload phiên bản mới');
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
  assertNotPending(da, 'gắn thẻ');
  const tag = await tagModel.findById(tagId);
  if (!tag) throw createError('Không tìm thấy tag', 404);
  await tagModel.addTag(id, tagId);
  return tagModel.getTagsByDigitalAsset(id);
}

export async function removeTag(id, tagId) {
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  assertNotPending(da, 'gỡ thẻ');
  await tagModel.removeTag(id, tagId);
  return tagModel.getTagsByDigitalAsset(id);
}

/** Xóa tài liệu — chỉ cho phép khi DRAFT hoặc REJECTED */
export async function remove(id) {
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  if (da.status === 'PENDING') {
    throw createError('Không thể xóa tài liệu đang chờ phê duyệt', 400);
  }
  if (!['DRAFT', 'REJECTED'].includes(da.status)) {
    throw createError('Chỉ có thể xóa tài liệu ở trạng thái DRAFT hoặc REJECTED', 400);
  }
  const abs = resolveDocumentAbsolutePath(da.filePath);
  if (abs) {
    try { await unlink(abs); } catch { /* file có thể đã bị xóa */ }
  }
  await model.remove(id);
}

/** Xóa cứng tài liệu bất kể trạng thái — chỉ dành cho Trưởng phòng (Level >= 3). */
export async function forceRemove(id) {
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  const abs = resolveDocumentAbsolutePath(da.filePath);
  if (abs) {
    try { await unlink(abs); } catch { /* file có thể đã bị xóa */ }
  }
  await model.remove(id);
}
