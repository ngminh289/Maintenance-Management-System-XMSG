/**
 * checklist.controller.js — HTTP handler: /api/checklists.
 * BFD mục 3: getPendingReviewResults + reviewChecklistResult (Trưởng ca APPROVE/REJECT).
 * getQRInfo / getResults / getResultById / getResultsByAsset: truyền viewer — CN chỉ xem APPROVED + phiếu của mình.
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
  ok(
    res,
    await service.getQRInfo(req.params.assetId, {
      employeeId: req.user.sub,
      positionLevel: req.user.positionLevel,
      woId: req.query.woId,
    }),
  ));

// ── Results ───────────────────────────────────────────────────────────────────
/** Chuẩn hoá đường dẫn lưu DB: URL Cloudinary giữ nguyên; local → uploads/photos/… */
function normalizedChecklistPhotoPath(filePath) {
  if (!filePath) return null;
  const s = String(filePath).replace(/\\/g, '/');
  if (/^https?:\/\//i.test(s)) return s;
  const u = s.toLowerCase().indexOf('uploads/');
  if (u >= 0) return s.slice(u);
  const parts = s.split('/').filter(Boolean);
  return parts.length ? `uploads/photos/${parts[parts.length - 1]}` : null;
}

export const submitResult = asyncHandler(async (req, res) => {
  const body = req.body;
  const details = typeof body.details === 'string' ? JSON.parse(body.details) : (body.details ?? []);
  let evidencePhoto = body.evidencePhoto ?? null;
  const files = Array.isArray(req.files) ? req.files : [];
  const itemPhotos = {};
  for (const f of files) {
    const stored = f.secure_url || f.path;
    if (!stored) continue;
    const norm = normalizedChecklistPhotoPath(stored);
    if (f.fieldname === 'photo') evidencePhoto = norm ?? stored;
    else {
      const m = /^item_(\d+)$/.exec(String(f.fieldname || ''));
      if (m) itemPhotos[Number(m[1])] = norm ?? stored;
    }
  }
  const merged = (details || []).map((row) => {
    const qid = Number(row.questionId);
    if (Number.isFinite(qid) && itemPhotos[qid]) {
      return { ...row, answerValue: itemPhotos[qid] };
    }
    return row;
  });
  return ok(res, await service.submitResult({
    ...body,
    details: merged,
    evidencePhoto,
    checkerId: req.user.sub,
  }), 201);
});

export const getResults = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.getResults(req.query, {
      employeeId: req.user.sub,
      positionLevel: req.user.positionLevel,
    }),
  ));

export const getResultById = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.getResultById(req.params.id, {
      employeeId: req.user.sub,
      positionLevel: req.user.positionLevel,
    }),
  ));

export const getResultsByAsset = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.getResultsByAsset(req.params.assetId, req.query.limit, {
      employeeId: req.user.sub,
      positionLevel: req.user.positionLevel,
    }),
  ));

export const getPendingReviewResults = asyncHandler(async (req, res) =>
  ok(res, await service.getPendingReviewResults(Number(req.query.limit) || 50)));

export const reviewChecklistResult = asyncHandler(async (req, res) => {
  const decision = String(req.body.decision || '').toUpperCase();
  return ok(res, await service.reviewChecklistResult(req.params.id, {
    supervisorId: req.user.sub,
    supervisorPositionId: req.user.positionId,
    decision,
    supervisorNotes: req.body.supervisorNotes?.trim() || null,
  }));
});
