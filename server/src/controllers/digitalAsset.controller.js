/**
 * digitalAsset.controller.js — HTTP handler: /api/digital-assets.
 * Upload dùng multer (multipart/form-data). FilePath trong DB = chỉ tên file (không lưu path tuyệt đối Windows).
 * logDocumentView: POST /:id/view-log — ghi DigitalAssetViewLogs (mở file từ checklist / kho tài liệu).
 * damActor: truyền vào service để ràng chủ sở hữu bản nháp (056).
 *
 * Xoá vĩnh viễn: DELETE /:id — chỉ DRAFT (`remove`).
 * Liên quan: services/digitalAsset.service.js, routes/digitalAsset.routes.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, fail } from '../utils/response.js';
import { logAction } from '../utils/audit.js';
import * as service from '../services/digitalAsset.service.js';
import * as viewLogModel from '../models/digitalAssetViewLog.model.js';
import { extname } from 'path';

export const getAll = asyncHandler(async (req, res) =>
  ok(res, await service.getAll(req.query, req.user)));

export const getById = asyncHandler(async (req, res) =>
  ok(res, await service.getById(req.params.id, req.user, {
    forApproval: req.query.forApproval === '1' || req.query.forApproval === 'true',
  })));

/** Ghi nhận lượt mở file tài liệu (phục vụ Báo cáo sử dụng tài nguyên). */
export const logDocumentView = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return fail(res, 'Tài liệu không hợp lệ', 400);
  await service.getById(id, req.user);
  const employeeId = Number(req.user.sub);
  if (Number.isNaN(employeeId)) return fail(res, 'Phiên đăng nhập không hợp lệ', 401);
  await viewLogModel.insert({ digitalAssetId: id, employeeId });
  return ok(res, { ok: true, digitalAssetId: id });
});

/** POST /api/digital-assets — multipart/form-data */
export const upload = asyncHandler(async (req, res) => {
  if (!req.file) return fail(res, 'Chưa chọn file để upload', 400);
  const { assetId, description, tagIds, documentCategoryId, customFileName } = req.body;
  const parsedTagIds = tagIds ? JSON.parse(tagIds) : [];
  const displayName = (customFileName && String(customFileName).trim()) ? String(customFileName).trim() : req.file.originalname;
  const da = await service.create({
    fileName:   displayName,
    fileType:   extname(req.file.originalname).replace('.', '').toUpperCase(),
    assetId:    assetId ? Number(assetId) : null,
    documentCategoryId: documentCategoryId != null && documentCategoryId !== ''
      ? Number(documentCategoryId)
      : null,
    description,
    uploadedBy: req.user.sub,
    filePath:   req.file.secure_url || req.file.filename,
    fileSizeKB: Math.ceil(
      (req.file.size || req.file.buffer?.length || 0) / 1024,
    ),
    tagIds:     parsedTagIds,
  }, req.user);
  await logAction({ employeeId: req.user.sub, action: 'INSERT', tableName: 'DigitalAssets', recordId: da.digitalAssetId, newValue: da });
  return ok(res, da, 201);
});

const damActor = (req) => ({
  actorId: req.user.sub,
  positionLevel: req.user.positionLevel ?? 0,
  positionId: req.user.positionId ?? 0,
});

export const update = asyncHandler(async (req, res) =>
  ok(res, await service.update(req.params.id, req.body, damActor(req))));

export const submitForApproval = asyncHandler(async (req, res) =>
  ok(res, await service.submitForApproval(
    req.params.id,
    req.user.sub,
    req.body.workflowId,
    req.user.positionLevel ?? 0,
    req.user.positionId ?? 0,
  )));

/** GET /api/digital-assets/:id/versions */
export const getVersions = asyncHandler(async (req, res) => {
  const da = await service.getById(req.params.id, req.user);
  return ok(res, da.versions ?? []);
});

/** POST /api/digital-assets/:id/versions — multipart/form-data */
export const newVersion = asyncHandler(async (req, res) => {
  if (!req.file) return fail(res, 'Chưa chọn file để upload', 400);
  const result = await service.addVersion(req.params.id, {
    filePath:   req.file.secure_url || req.file.filename,
    fileSizeKB: Math.ceil(
      (req.file.size || req.file.buffer?.length || 0) / 1024,
    ),
    changedBy:  req.user.sub,
    changeNote: req.body.changeNote,
  }, damActor(req));
  return ok(res, result);
});

export const archive = asyncHandler(async (req, res) =>
  ok(res, await service.archive(req.params.id)));

export const addTag = asyncHandler(async (req, res) =>
  ok(res, await service.addTag(req.params.id, Number(req.body.tagId), damActor(req))));

export const removeTag = asyncHandler(async (req, res) =>
  ok(res, await service.removeTag(req.params.id, req.params.tagId, damActor(req))));

// ── Lưu trữ (archive) — thay cho xoá cứng ──────────────────────────────────

/** POST /api/digital-assets/:id/archive-document — lưu trữ cả tài liệu. */
export const archiveDocument = asyncHandler(async (req, res) => {
  const result = await service.archiveDocument(req.params.id, damActor(req));
  await logAction({
    employeeId: req.user.sub,
    action: 'UPDATE',
    tableName: 'DigitalAssets',
    recordId: Number(req.params.id),
    newValue: { archived: true, scope: 'DOCUMENT' },
  });
  return ok(res, { ...result, message: 'Đã lưu trữ cả tài liệu.' });
});

/** POST /api/digital-assets/:id/versions/:versionId/archive — lưu trữ 1 phiên bản. */
export const archiveVersion = asyncHandler(async (req, res) => {
  const result = await service.archiveVersion(
    req.params.id,
    req.params.versionId,
    damActor(req),
  );
  await logAction({
    employeeId: req.user.sub,
    action: 'UPDATE',
    tableName: 'AssetVersions',
    recordId: Number(req.params.versionId),
    newValue: { archived: true, ...result },
  });
  return ok(res, {
    ...result,
    message: result.archivedDocument
      ? 'Đã lưu trữ phiên bản — không còn phiên bản active, tài liệu cũng đã chuyển vào kho lưu trữ.'
      : 'Đã lưu trữ phiên bản. Phiên bản hiện tại đã được cập nhật.',
  });
});

/** POST /api/digital-assets/:id/restore — khôi phục tài liệu (Admin/PKT). */
export const restoreDocument = asyncHandler(async (req, res) => {
  const result = await service.restoreDocument(req.params.id, damActor(req));
  await logAction({
    employeeId: req.user.sub,
    action: 'UPDATE',
    tableName: 'DigitalAssets',
    recordId: Number(req.params.id),
    newValue: { restored: true, scope: 'DOCUMENT' },
  });
  return ok(res, { ...result, message: 'Đã khôi phục tài liệu (chuyển về DRAFT).' });
});

/** POST /api/digital-assets/:id/versions/:versionId/restore — khôi phục 1 phiên bản (Admin/PKT). */
export const restoreVersion = asyncHandler(async (req, res) => {
  const result = await service.restoreVersion(req.params.versionId, damActor(req));
  await logAction({
    employeeId: req.user.sub,
    action: 'UPDATE',
    tableName: 'AssetVersions',
    recordId: Number(req.params.versionId),
    newValue: { restored: true, ...result },
  });
  return ok(res, { ...result, message: 'Đã khôi phục phiên bản.' });
});

/** GET /api/digital-assets/archived-versions — list global cho tab Lưu trữ. */
export const listArchivedVersions = asyncHandler(async (req, res) =>
  ok(res, await service.listArchivedVersions(req.query, damActor(req))));

/** DELETE /api/digital-assets/:id — xoá vĩnh viễn; chỉ bản nháp (DRAFT). */
export const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id, damActor(req));
  await logAction({
    employeeId: req.user.sub,
    action: 'DELETE',
    tableName: 'DigitalAssets',
    recordId: Number(req.params.id),
  });
  return ok(res, { message: 'Đã xoá vĩnh viễn tài liệu (bản nháp).' });
});
