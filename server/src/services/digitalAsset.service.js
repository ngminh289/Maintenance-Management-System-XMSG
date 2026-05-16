/**
 * digitalAsset.service.js — Nghiệp vụ kho tài liệu kỹ thuật số.
 * Flow tài liệu: DRAFT → (submit) → PENDING → (approve) → APPROVED
 *               APPROVED → (new-version) → DRAFT
 * Phiên bản: create → AssetVersions v1 + DigitalAssets; addVersion → v2+ và trỏ file hiện tại.
 *
 * Quyền sửa / gửi duyệt / phiên bản / tag (đồng bộ rules nghiệp vụ user):
 *   - QTV (positionLevel ≥ 4)               → đủ quyền mọi status (trừ PENDING — phải thu hồi).
 *   - Trưởng/Phó PKT (positionId 7, 9)      → đủ quyền mọi status (trừ PENDING).
 *   - Tác giả (UploadedBy) ở DRAFT/REJECTED → được sửa/submit/version.
 *   - Tác giả ở APPROVED                    → KHÔNG được sửa (chỉ admin/PKT).
 *   - Vai khác (TC, Trưởng phòng Bảo trì, KTV HT, BGD) → chỉ xem.
 *
 * Lưu trữ (migration 072) chỉ sau khi đã duyệt (APPROVED):
 *   - APPROVED → archive phiên bản / cả tài liệu (không xoá cứng).
 *   - DRAFT → có thể xoá vĩnh viễn khỏi DB + file (`remove`).
 *   - `archiveVersion(id, versionId)`: archive 1 phiên bản. Nếu là CurrentVersion
 *     thì BE tự fallback về phiên bản còn active mới nhất; nếu hết version active
 *     thì archive cả tài liệu (status='ARCHIVED').
 *   - `archiveDocument(id)`: archive cả tài liệu — đặt status='ARCHIVED' và mark
 *     toàn bộ versions là IsArchived=1 để tab Lưu trữ hiển thị đầy đủ.
 *   - `restoreVersion(versionId)` / `restoreDocument(id)`: chỉ Admin + Trưởng/Phó PKT.
 *
 * PENDING: khoá hết — phải thu hồi qua "Yêu cầu chỉnh sửa" (REQUEST_CHANGES) → BE chuyển về DRAFT.
 * Đọc danh sách: DRAFT/REJECTED/PENDING chỉ chủ; APPROVED/ARCHIVED công khai trong kho.
 * GET ?forApproval=1: người duyệt (APPROVE) + Admin xem hàng chờ được đọc file PENDING (tab Phê duyệt).
 * Liên quan: models/digitalAsset.model.js, migration 036, 056, 057, 072.
 */
import { unlink } from 'fs/promises';
import { createError } from '../utils/createError.js';
import { isRemoteStorageUrl, deleteStoredFile } from '../utils/storageUrl.js';
import { getPagination, paginatedResult } from '../utils/paginate.js';
import * as model            from '../models/digitalAsset.model.js';
import * as tagModel         from '../models/tag.model.js';
import * as documentCategoryModel from '../models/documentCategory.model.js';
import * as approvalSvc from './approval.service.js';
import * as permissionModel from '../models/permission.model.js';
import { resolveDocumentAbsolutePath } from '../config/upload.js';

/** Trưởng / Phó phòng KT-CN — quyền tương đương admin với DAM (theo migration 057). */
const PIDS_PKT_HEAD = new Set([7, 9]);

function isAdmin(ctx) {
  return Number(ctx?.positionLevel ?? 0) >= 4;
}

function isPktHead(ctx) {
  return PIDS_PKT_HEAD.has(Number(ctx?.positionId ?? 0));
}

function isOwner(da, ctx) {
  return Number(da?.uploadedBy) === Number(ctx?.actorId);
}

/**
 * Kiểm tra quyền chỉnh sửa / xoá / gửi duyệt / version cho tài liệu.
 * Trả về `null` nếu OK, hoặc Error 403 nếu không đủ quyền.
 *
 * - Admin / PKT: full access.
 * - Owner + DRAFT/REJECTED: full.
 * - Owner + APPROVED: chỉ được tạo phiên bản mới (handled riêng). Update/Delete → cấm.
 *   (Theo bảng nghiệp vụ: CV KTS sau duyệt chỉ xem.)
 */
function assertCanManageDigitalAsset(da, ctx, actionLabel) {
  if (isAdmin(ctx) || isPktHead(ctx)) return;
  if (isOwner(da, ctx) && (da.status === 'DRAFT' || da.status === 'REJECTED')) return;
  throw createError(
    `Bạn không có quyền ${actionLabel} tài liệu này ở trạng thái hiện tại.`,
    403,
  );
}

/**
 * Đọc chi tiết: APPROVED/ARCHIVED — công khai trong phạm vi có quyền READ.
 * DRAFT/REJECTED/PENDING — CHỈ người upload mới thấy, không có ngoại lệ.
 * Người duyệt xem PENDING ở tab Phê duyệt, không phải mục Tài liệu số.
 */
export function assertCanReadDigitalAsset(da, viewer) {
  if (!da) return;
  const st = da.status;
  if (st === 'APPROVED' || st === 'ARCHIVED') return;
  // Chỉ người upload mới thấy — không ai khác kể cả Admin / Giám đốc
  const eid = viewer?.sub != null ? Number(viewer.sub) : Number(viewer?.employeeId);
  if (!Number.isFinite(eid)) {
    throw createError('Không tìm thấy tài liệu', 404);
  }
  if (Number(da.uploadedBy) === eid) return;
  throw createError('Không tìm thấy tài liệu', 404);
}

/**
 * Tab Phê duyệt: cho phép đọc tài liệu PENDING (không hiện trong kho tài liệu).
 * Admin L4+ chỉ xem; người duyệt cần DIGITAL_ASSET APPROVE (hoặc UPDATE tương thích DB cũ).
 */
async function assertCanReadForApprovalFlow(da, viewer) {
  try {
    assertCanReadDigitalAsset(da, viewer);
    return;
  } catch (err) {
    if (err?.status !== 404) throw err;
  }
  if (da.status !== 'PENDING') {
    throw createError('Không tìm thấy tài liệu', 404);
  }
  const level = Number(viewer?.positionLevel ?? 0);
  if (level >= 4) return;
  const pid = Number(viewer?.positionId);
  if (!Number.isFinite(pid) || pid < 1) {
    throw createError('Không tìm thấy tài liệu', 404);
  }
  const canApprove = await permissionModel.hasPermission(pid, 'APPROVE', 'DIGITAL_ASSET');
  const canUpdate = await permissionModel.hasPermission(pid, 'UPDATE', 'DIGITAL_ASSET');
  if (canApprove || canUpdate) return;
  throw createError('Không tìm thấy tài liệu', 404);
}

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

export async function getAll(query, viewer) {
  const { page, limit, offset } = getPagination(query);
  const viewerId = Number(viewer?.sub);
  if (!Number.isFinite(viewerId)) {
    throw createError('Phiên đăng nhập không hợp lệ', 401);
  }
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
    draftPrivacy: {
      viewerEmployeeId: viewerId,
      isAdmin: false, // Chỉ người upload thấy DRAFT/PENDING/REJECTED — không ngoại lệ
    },
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

export async function getById(id, viewer, options = {}) {
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  if (options.forApproval) {
    await assertCanReadForApprovalFlow(da, viewer);
  } else {
    assertCanReadDigitalAsset(da, viewer);
  }
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
}, viewerForRead) {
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
  return getById(id, viewerForRead ?? { sub: uploadedBy, positionLevel: 0 });
}

export async function update(
  id,
  { description, assetId, documentCategoryId, tagIds },
  ctx,
) {
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  assertNotPending(da, 'cập nhật mô tả / tài sản / phân loại / thẻ');
  assertCanManageDigitalAsset(da, ctx, 'cập nhật');
  if (documentCategoryId !== undefined) await assertCategoryId(documentCategoryId);
  await model.update(id, { description, assetId, documentCategoryId });
  if (tagIds !== undefined) {
    if (!Array.isArray(tagIds)) {
      throw createError('tagIds phải là mảng số', 400);
    }
    const normalized = [...new Set(
      tagIds
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v) && v > 0),
    )];
    for (const tid of normalized) {
      // Kiểm tra tag tồn tại để tránh lưu tham chiếu rỗng.
      // eslint-disable-next-line no-await-in-loop
      const found = await tagModel.findById(tid);
      if (!found) throw createError(`Tag không tồn tại: ${tid}`, 404);
    }
    const existing = await tagModel.getTagsByDigitalAsset(id);
    const existingSet = new Set(existing.map((t) => Number(t.tagId)));
    const targetSet = new Set(normalized);
    const toAdd = normalized.filter((tid) => !existingSet.has(tid));
    const toRemove = existing
      .map((t) => Number(t.tagId))
      .filter((tid) => !targetSet.has(tid));
    await Promise.all([
      ...toAdd.map((tid) => tagModel.addTag(id, tid)),
      ...toRemove.map((tid) => tagModel.removeTag(id, tid)),
    ]);
  }
  return getById(id, { sub: ctx.actorId, positionLevel: ctx.positionLevel ?? 0 });
}

/** Gửi phê duyệt: DRAFT → PENDING */
export async function submitForApproval(
  id,
  submitterId,
  workflowId,
  positionLevel = 0,
  positionId = 0,
) {
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  assertCanManageDigitalAsset(
    da,
    { actorId: submitterId, positionLevel, positionId },
    'gửi phê duyệt',
  );
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
export async function addVersion(id, { filePath, fileSizeKB, changedBy, changeNote }, ctx) {
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  assertNotPending(da, 'upload phiên bản mới');
  // Phiên bản mới được phép cả khi APPROVED (Admin/PKT — flow bình thường);
  // CV KTS chỉ tạo version mới khi DRAFT/REJECTED.
  if (!isAdmin(ctx) && !isPktHead(ctx)) {
    if (!isOwner(da, ctx) || (da.status !== 'DRAFT' && da.status !== 'REJECTED')) {
      throw createError(
        'Bạn không có quyền tạo phiên bản mới cho tài liệu này.',
        403,
      );
    }
  }
  const newVer = await model.addVersion({ digitalAssetId: id, filePath, fileSizeKB, changedBy, changeNote });
  return { version: newVer, status: 'DRAFT' };
}

/**
 * Archive (lưu trữ) tài liệu đã được duyệt — flow cũ giữ tương thích endpoint
 * `/digital-assets/:id/archive`. Khác `archiveDocument` ở chỗ chỉ chấp nhận
 * APPROVED và không archive versions.
 */
export async function archive(id) {
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  if (da.status !== 'APPROVED') throw createError('Chỉ tài liệu đã duyệt mới được lưu trữ', 400);
  await model.updateStatus(id, 'ARCHIVED');
  return { status: 'ARCHIVED' };
}

export async function addTag(id, tagId, ctx) {
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  assertNotPending(da, 'gắn thẻ');
  assertCanManageDigitalAsset(da, ctx, 'gắn thẻ');
  const tag = await tagModel.findById(tagId);
  if (!tag) throw createError('Không tìm thấy tag', 404);
  await tagModel.addTag(id, tagId);
  return tagModel.getTagsByDigitalAsset(id);
}

export async function removeTag(id, tagId, ctx) {
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  assertNotPending(da, 'gỡ thẻ');
  assertCanManageDigitalAsset(da, ctx, 'gỡ thẻ');
  await tagModel.removeTag(id, tagId);
  return tagModel.getTagsByDigitalAsset(id);
}

// ── Lưu trữ — chỉ tài liệu đã APPROVED ───────────────────────────────────────
//
// Quy tắc:
//   - PENDING: cấm (phải xử lý duyệt trước).
//   - DRAFT / REJECTED: không lưu trữ — dùng xoá vĩnh viễn (DRAFT) hoặc sửa/gửi lại.
//   - APPROVED: chỉ Admin/PKT được archive phiên bản / cả tài liệu.
//   - Đã ARCHIVED: không archive lại (chỉ restore).
function assertCanArchive(da, ctx) {
  if (!da) return;
  if (da.status === 'PENDING') {
    throw createError(
      'Tài liệu đang chờ phê duyệt — không thể lưu trữ. Hãy gửi yêu cầu chỉnh sửa hoặc đợi xử lý duyệt.',
      400,
    );
  }
  if (da.status === 'ARCHIVED') {
    throw createError('Tài liệu đã lưu trữ.', 400);
  }
  if (da.status !== 'APPROVED') {
    throw createError(
      'Chỉ tài liệu đã phê duyệt mới được lưu trữ. Bản nháp có thể xoá vĩnh viễn khỏi hệ thống.',
      400,
    );
  }
  if (!isAdmin(ctx) && !isPktHead(ctx)) {
    throw createError(
      'Tài liệu đã phê duyệt — chỉ Quản trị viên hoặc Trưởng/Phó phòng KT-CN mới được lưu trữ.',
      403,
    );
  }
}

/**
 * Lưu trữ một phiên bản cụ thể của tài liệu.
 * - Nếu version đó đang là CurrentVersion: tự fallback CurrentVersion về phiên
 *   bản còn active mới nhất (theo VersionNumber DESC). Nếu không còn version
 *   active nào → archive cả tài liệu (status='ARCHIVED').
 * - Trả về { fallback: { newCurrentVersion, archivedDocument: bool } }.
 */
export async function archiveVersion(digitalAssetId, versionId, ctx) {
  const da = await model.findById(digitalAssetId);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  assertCanArchive(da, ctx);

  const version = await model.findVersionById(versionId);
  if (!version || Number(version.digitalAssetId) !== Number(digitalAssetId)) {
    throw createError('Phiên bản không thuộc tài liệu này', 404);
  }
  if (Number(version.isArchived) === 1) {
    throw createError('Phiên bản này đã được lưu trữ trước đó.', 400);
  }

  const wasCurrent = Number(version.versionNumber) === Number(da.currentVersion);
  const affected = await model.archiveVersion(versionId, ctx?.actorId);
  if (!affected) {
    throw createError('Không thể lưu trữ phiên bản (đã xử lý?)', 409);
  }

  let newCurrentVersion = da.currentVersion;
  let archivedDocument = false;
  if (wasCurrent) {
    const next = await model.findLatestActiveVersion(digitalAssetId);
    if (next) {
      await model.setCurrentVersion(digitalAssetId, next);
      newCurrentVersion = next.versionNumber;
    } else {
      await model.updateStatus(digitalAssetId, 'ARCHIVED');
      archivedDocument = true;
    }
  } else {
    // Không là current — nhưng nếu sau khi archive này hết version active
    // thì cũng archive cả tài liệu (đề phòng edge case).
    const remain = await model.countActiveVersions(digitalAssetId);
    if (remain === 0) {
      await model.updateStatus(digitalAssetId, 'ARCHIVED');
      archivedDocument = true;
    }
  }

  return {
    digitalAssetId: Number(digitalAssetId),
    versionId: Number(versionId),
    versionNumber: version.versionNumber,
    newCurrentVersion,
    archivedDocument,
  };
}

/** Lưu trữ cả tài liệu (status='ARCHIVED') + đánh dấu mọi version active. */
export async function archiveDocument(id, ctx) {
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  assertCanArchive(da, ctx);
  await model.archiveAllActiveVersions(id, ctx?.actorId);
  await model.updateStatus(id, 'ARCHIVED');
  return { digitalAssetId: Number(id), status: 'ARCHIVED' };
}

function assertCanRestore(ctx) {
  if (isAdmin(ctx) || isPktHead(ctx)) return;
  throw createError(
    'Chỉ Quản trị viên hoặc Trưởng/Phó phòng KT-CN mới được khôi phục tài liệu lưu trữ.',
    403,
  );
}

/**
 * Khôi phục một phiên bản đã lưu trữ về trạng thái active.
 * Nếu tài liệu đang ở status ARCHIVED, tự đưa về DRAFT để chủ rà soát lại
 * trước khi gửi duyệt; CurrentVersion được set sang phiên bản vừa khôi phục
 * (nếu có VersionNumber lớn hơn current hiện tại).
 */
export async function restoreVersion(versionId, ctx) {
  assertCanRestore(ctx);
  const version = await model.findVersionById(versionId);
  if (!version) throw createError('Không tìm thấy phiên bản', 404);
  if (Number(version.isArchived) === 0) {
    throw createError('Phiên bản này đang active — không cần khôi phục.', 400);
  }

  const affected = await model.restoreVersion(versionId);
  if (!affected) throw createError('Không thể khôi phục (đã xử lý?)', 409);

  const da = await model.findById(version.digitalAssetId);
  if (da) {
    if (da.status === 'ARCHIVED') {
      // Tài liệu đang archived → mở lại, current = phiên bản vừa khôi phục
      await model.updateStatus(version.digitalAssetId, 'DRAFT');
      await model.setCurrentVersion(version.digitalAssetId, version);
    } else if (Number(version.versionNumber) > Number(da.currentVersion)) {
      // Khôi phục một phiên bản mới hơn current → cập nhật current.
      await model.setCurrentVersion(version.digitalAssetId, version);
    }
  }
  return {
    digitalAssetId: Number(version.digitalAssetId),
    versionId: Number(versionId),
    versionNumber: version.versionNumber,
  };
}

/**
 * Khôi phục cả tài liệu lưu trữ: status từ ARCHIVED → DRAFT, KHÔNG tự un-archive
 * versions (giữ trạng thái lưu trữ riêng để người dùng chọn restore tiếp).
 */
export async function restoreDocument(id, ctx) {
  assertCanRestore(ctx);
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  if (da.status !== 'ARCHIVED') {
    throw createError('Tài liệu này chưa ở trạng thái lưu trữ.', 400);
  }
  await model.updateStatus(id, 'DRAFT');
  return { digitalAssetId: Number(id), status: 'DRAFT' };
}

/** Tab "Đã lưu trữ" — Admin + Trưởng/Phó PKT. */
export async function listArchivedVersions(query, ctx) {
  assertCanRestore(ctx); // Cùng bộ quyền với restore — gọn rule.
  const { page, limit, offset } = getPagination(query);
  const { items, total } = await model.findArchivedVersionsAll({
    q: query?.q,
    limit,
    offset,
  });
  return paginatedResult(items, total, page, limit);
}

async function removeDamPhysicalFile(filePath) {
  if (!filePath) return;
  if (isRemoteStorageUrl(filePath)) {
    await deleteStoredFile(filePath);
    return;
  }
  const abs = resolveDocumentAbsolutePath(filePath);
  if (abs) {
    try {
      await unlink(abs);
    } catch {
      /* file có thể đã bị xóa */
    }
  }
}

/**
 * Xoá vĩnh viễn khỏi DB — chỉ khi trạng thái DRAFT (bản nháp).
 * Gỡ file mọi phiên bản rồi DELETE DigitalAssets (CASCADE AssetVersions, AssetTags, …).
 */
export async function remove(id, ctx) {
  const da = await model.findById(id);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  if (da.status === 'PENDING') {
    throw createError(
      'Không thể xóa tài liệu đang chờ phê duyệt. Hãy gửi yêu cầu chỉnh sửa hoặc đợi xử lý duyệt.',
      400,
    );
  }
  if (da.status !== 'DRAFT') {
    throw createError(
      'Chỉ bản nháp mới xoá vĩnh viễn khỏi hệ thống. Tài liệu đã phê duyệt hãy dùng lưu trữ.',
      400,
    );
  }
  assertCanManageDigitalAsset(da, ctx, 'xoá vĩnh viễn');
  const vers = await model.getVersions(id, { includeArchived: true });
  const seen = new Set();
  for (const v of vers) {
    const p = v?.filePath;
    if (p && !seen.has(p)) {
      seen.add(p);
      // eslint-disable-next-line no-await-in-loop
      await removeDamPhysicalFile(p);
    }
  }
  const fp = da.filePath;
  if (fp && !seen.has(fp)) await removeDamPhysicalFile(fp);
  await model.remove(id);
}
