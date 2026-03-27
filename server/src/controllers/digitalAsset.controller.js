/**
 * digitalAsset.controller.js — HTTP handler: /api/digital-assets.
 * Upload dùng multer (multipart/form-data).
 * Liên quan: services/digitalAsset.service.js, routes/digitalAsset.routes.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, fail } from '../utils/response.js';
import { logAction } from '../utils/audit.js';
import * as service from '../services/digitalAsset.service.js';
import { extname } from 'path';

export const getAll = asyncHandler(async (req, res) =>
  ok(res, await service.getAll(req.query)));

export const getById = asyncHandler(async (req, res) =>
  ok(res, await service.getById(req.params.id)));

/** POST /api/digital-assets — multipart/form-data */
export const upload = asyncHandler(async (req, res) => {
  if (!req.file) return fail(res, 'Chưa chọn file để upload', 400);
  const { assetId, description, tagIds } = req.body;
  const parsedTagIds = tagIds ? JSON.parse(tagIds) : [];
  const da = await service.create({
    fileName:   req.file.originalname,
    fileType:   extname(req.file.originalname).replace('.', '').toUpperCase(),
    assetId:    assetId ? Number(assetId) : null,
    description,
    uploadedBy: req.user.sub,
    filePath:   req.file.path,
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
    filePath:   req.file.path,
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
