/**
 * documentFeedback.controller.js — HTTP: nested /digital-assets/:id/feedback + /document-feedback (hàng đợi KT).
 * Liên quan: services/documentFeedback.service.js, routes/documentFeedback.routes.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/documentFeedback.service.js';

export const createForAsset = asyncHandler(async (req, res) => {
  const row = await service.createForAsset(req.params.id, {
    employeeId: req.user.sub,
    positionId: req.user.positionId,
    positionLevel: req.user.positionLevel ?? 0,
    body: req.body?.body,
  });
  return ok(res, row, 201);
});

export const listForAsset = asyncHandler(async (req, res) => {
  const rows = await service.listForAsset(req.params.id, {
    employeeId: req.user.sub,
    positionId: req.user.positionId,
    positionLevel: req.user.positionLevel ?? 0,
  });
  return ok(res, rows);
});

export const listInbox = asyncHandler(async (req, res) => {
  const data = await service.listInbox({
    positionId: req.user.positionId,
    status: req.query.status || null,
    page: req.query.page,
    limit: req.query.limit,
  });
  return ok(res, data);
});

export const reviewUpdate = asyncHandler(async (req, res) => {
  const row = await service.reviewUpdate(req.params.feedbackId, {
    employeeId: req.user.sub,
    positionId: req.user.positionId,
    status: req.body?.status,
    reviewNote: req.body?.reviewNote,
  });
  return ok(res, row);
});
