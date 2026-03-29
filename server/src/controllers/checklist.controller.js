/**
 * checklist.controller.js — HTTP handler: /api/checklists.
 * Liên quan: services/checklist.service.js, routes/checklist.routes.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/checklist.service.js';

// ── Templates ─────────────────────────────────────────────────────────────────
export const getTemplates = asyncHandler(async (req, res) =>
  ok(res, await service.getTemplates(req.query.assetTypeId)));

export const getTemplateById = asyncHandler(async (req, res) =>
  ok(res, await service.getTemplateById(req.params.id)));

export const createTemplate = asyncHandler(async (req, res) =>
  ok(res, await service.createTemplate(req.body), 201));

export const updateTemplate = asyncHandler(async (req, res) =>
  ok(res, await service.updateTemplate(req.params.id, req.body)));

export const removeTemplate = asyncHandler(async (req, res) => {
  await service.removeTemplate(req.params.id);
  return ok(res, { message: 'Đã xóa mẫu checklist.' });
});

export const addItem = asyncHandler(async (req, res) =>
  ok(res, await service.addItem(req.params.templateId, req.body), 201));

export const updateItem = asyncHandler(async (req, res) => {
  await service.updateItem(req.params.itemId, req.body);
  return ok(res, { message: 'Đã cập nhật câu hỏi.' });
});

export const removeItem = asyncHandler(async (req, res) => {
  await service.removeItem(req.params.itemId);
  return ok(res, { message: 'Đã xóa câu hỏi.' });
});

// ── QR Scan Info ───────────────────────────────────────────────────────────────
export const getQRInfo = asyncHandler(async (req, res) =>
  ok(res, await service.getQRInfo(req.params.assetId)));

// ── Results ───────────────────────────────────────────────────────────────────
export const submitResult = asyncHandler(async (req, res) => {
  // Hỗ trợ multipart (khi có upload ảnh) và JSON thuần
  const body    = req.body;
  const details = typeof body.details === 'string' ? JSON.parse(body.details) : (body.details ?? []);
  const evidencePhoto = req.file?.path ?? body.evidencePhoto ?? null;
  return ok(res, await service.submitResult({
    ...body,
    details,
    evidencePhoto,
    checkerId: req.user.sub,
  }), 201);
});

export const getResults = asyncHandler(async (req, res) =>
  ok(res, await service.getResults(req.query)));

export const getResultById = asyncHandler(async (req, res) =>
  ok(res, await service.getResultById(req.params.id)));

export const getResultsByAsset = asyncHandler(async (req, res) =>
  ok(res, await service.getResultsByAsset(req.params.assetId, req.query.limit)));
