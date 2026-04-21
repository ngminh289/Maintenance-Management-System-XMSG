/**
 * digitalAsset.controller.js — HTTP handler: /api/digital-assets.
 * Upload dùng multer (multipart/form-data). FilePath trong DB = chỉ tên file (không lưu path tuyệt đối Windows).
 * logDocumentView: POST /:id/view-log — ghi DigitalAssetViewLogs (mở file từ checklist / kho tài liệu).
 * damActor: truyền vào service để ràng chủ sở hữu bản nháp (056).
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
  ok(res, await service.getById(req.params.id, req.user)));

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
    filePath:   req.file.filename,
    fileSizeKB: Math.ceil(req.file.size / 1024),
    tagIds:     parsedTagIds,
  }, req.user);
  await logAction({ employeeId: req.user.sub, action: 'INSERT', tableName: 'DigitalAssets', recordId: da.digitalAssetId, newValue: da });
  return ok(res, da, 201);
});

const damActor = (req) => ({
  actorId: req.user.sub,
  positionLevel: req.user.positionLevel ?? 0,
});

export const update = asyncHandler(async (req, res) =>
  ok(res, await service.update(req.params.id, req.body, damActor(req))));

export const submitForApproval = asyncHandler(async (req, res) =>
  ok(res, await service.submitForApproval(
    req.params.id,
    req.user.sub,
    req.body.workflowId,
    req.user.positionLevel ?? 0,
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
    filePath:   req.file.filename,
    fileSizeKB: Math.ceil(req.file.size / 1024),
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

export const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id, damActor(req));
  await logAction({ employeeId: req.user.sub, action: 'DELETE', tableName: 'DigitalAssets', recordId: Number(req.params.id) });
  return ok(res, { message: 'Đã xóa tài liệu.' });
});

/** DELETE /api/digital-assets/:id/force — Trưởng/Phó PKT hoặc Admin (DIGITAL_ASSET:DELETE) */
export const forceRemove = asyncHandler(async (req, res) => {
  await service.forceRemove(req.params.id);
  await logAction({ employeeId: req.user.sub, action: 'DELETE', tableName: 'DigitalAssets', recordId: Number(req.params.id), newValue: { force: true } });
  return ok(res, { message: 'Đã xóa vĩnh viễn tài liệu.' });
});
