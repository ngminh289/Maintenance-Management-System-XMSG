/**
 * workflow.controller.js — HTTP handler: /api/workflows (admin).
 * Liên quan: services/workflow.service.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/workflow.service.js';

export const getAll   = asyncHandler(async (req, res) => ok(res, await service.getAll(req.query.documentType)));
export const getById  = asyncHandler(async (req, res) => ok(res, await service.getById(req.params.id)));
export const create   = asyncHandler(async (req, res) => ok(res, await service.create(req.body), 201));
export const update   = asyncHandler(async (req, res) => ok(res, await service.update(req.params.id, req.body)));
export const remove   = asyncHandler(async (req, res) => { await service.remove(req.params.id); return ok(res, { message: 'Đã xóa workflow.' }); });
export const addStep  = asyncHandler(async (req, res) => ok(res, await service.addStep(req.params.id, req.body)));
export const updateStep = asyncHandler(async (req, res) => ok(res, await service.updateStep(req.params.stepId, req.body)));
export const removeStep = asyncHandler(async (req, res) => ok(res, await service.removeStep(req.params.stepId)));
