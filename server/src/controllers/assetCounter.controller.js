/**
 * assetCounter.controller.js — HTTP handler: bộ đếm giờ tài sản.
 * Endpoints mount trong asset.routes.js: /api/assets/:assetId/counter.
 * predictive-events: nhật ký thuật toán dự báo PM (luồng 1.1 / 2.1).
 * Liên quan: services/assetCounter.service.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/assetCounter.service.js';
import * as workOrderMaintSync from '../services/workOrderMaintenanceSync.service.js';

export const getCounter = asyncHandler(async (req, res) =>
  ok(res, await service.getCounter(req.params.assetId)));

export const recordReading = asyncHandler(async (req, res) =>
  ok(res, await service.recordReading({
    assetId:      Number(req.params.assetId),
    readingValue: Number(req.body.readingValue),
    dataSource:   req.body.dataSource || 'MANUAL',
  })));

export const getHistory = asyncHandler(async (req, res) =>
  ok(res, await service.getHistory(req.params.assetId, req.query.limit)));

export const getPredictiveEvents = asyncHandler(async (req, res) =>
  ok(res, await service.getPredictiveEvents(req.params.assetId, Number(req.query.limit) || 50)));

export const getMaintenanceHistory = asyncHandler(async (req, res) =>
  ok(res, await workOrderMaintSync.getMaintenanceHistoryForAsset(
    req.params.assetId,
    Number(req.query.limit) || 80,
  )));

export const resetAfterMaintenance = asyncHandler(async (req, res) => {
  await service.resetAfterMaintenance(Number(req.params.assetId));
  return ok(res, { message: 'Đã reset bộ đếm sau bảo trì.' });
});
