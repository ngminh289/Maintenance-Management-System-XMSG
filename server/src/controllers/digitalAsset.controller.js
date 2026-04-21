/**
 * digitalAsset.controller.js — HTTP handler: /api/digital-assets.
 * Upload dùng multer (multipart/form-data). FilePath trong DB = chỉ tên file (không lưu path tuyệt đối Windows).
 * logDocumentView: POST /:id/view-log — ghi DigitalAssetViewLogs (mở file từ checklist / kho tài liệu).
 * Liên quan: services/digitalAsset.service.js, routes/digitalAsset.routes.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, fail } from '../utils/response.js';
import { logAction } from '../utils/audit.js';
import * as service from '../services/digitalAsset.service.js';
import * as viewLogModel from '../models/digitalAssetViewLog.model.js';
import { extname } from 'path';

export const getAll = asyncHandler(async (req, res) =>
  ok(res, await service.getAll(req.query)));

export const getById = asyncHandler(async (req, res) =>
  ok(res, await service.getById(req.params.id)));

/** Ghi nhận lượt mở file tài liệu (phục vụ Báo cáo sử dụng tài nguyên). */
export const logDocumentView = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return fail(res, 'Tài liệu không hợp lệ', 400);
  const row = await service.getById(id);
  if (!row) return fail(res, 'Không tìm thấy tài liệu', 404);
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
  });
  await logAction({ employeeId: req.user.sub, action: 'INSERT', tableName: 'DigitalAssets', recordId: da.digitalAssetId, newValue: da });
  return ok(res, da, 201);
});

export const update = asyncHandler(async (req, res) =>
  ok(res, await service.update(req.params.id, req.body)));

export const submitForApproval = asyncHandler(async (req, res) =>
  ok(res, await service.submitForApproval(req.params.id, req.user.sub, req.body.workflowId)));

/** GET /api/digital-assets/:id/versions */
export const getVersions = asyncHandler(async (req, res) => {
  const da = await service.getById(req.params.id);
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
  });
  return ok(res, result);
});

export const archive = asyncHandler(async (req, res) =>
  ok(res, await service.archive(req.params.id)));

export const addTag = asyncHandler(async (req, res) =>
  ok(res, await service.addTag(req.params.id, Number(req.body.tagId))));

export const removeTag = asyncHandler(async (req, res) =>
  ok(res, await service.removeTag(req.params.id, req.params.tagId)));

export const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  await logAction({ employeeId: req.user.sub, action: 'DELETE', tableName: 'DigitalAssets', recordId: Number(req.params.id) });
  return ok(res, { message: 'Đã xóa tài liệu.' });
});

/** DELETE /api/digital-assets/:id/force — Trưởng phòng xóa cứng bất kể trạng thái */
export const forceRemove = asyncHandler(async (req, res) => {
  await service.forceRemove(req.params.id);
  await logAction({ employeeId: req.user.sub, action: 'DELETE', tableName: 'DigitalAssets', recordId: Number(req.params.id), newValue: { force: true } });
  return ok(res, { message: 'Đã xóa vĩnh viễn tài liệu.' });
});
