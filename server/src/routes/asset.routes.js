/**
 * asset.routes.js — /api/assets (CRUD + PATCH status + bộ đếm giờ + QR info).
 * Query params: ?page&limit&status&assetTypeId&locationId&search
 * Liên quan: controllers/asset.controller.js, controllers/assetCounter.controller.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import {
  createAssetSchema, updateAssetSchema, updateStatusSchema,
} from '../validators/asset.validator.js';
import { readingSchema } from '../validators/checklist.validator.js';
import * as ctrl from '../controllers/asset.controller.js';
import * as counterCtrl from '../controllers/assetCounter.controller.js';

export const assetRouter = Router();

assetRouter.use(requireAuth);

// CRUD tài sản
assetRouter.get('/',             ctrl.getAll);
assetRouter.get('/:id',          ctrl.getById);
assetRouter.post('/',            requireLevel(2), validate(createAssetSchema), ctrl.create);
assetRouter.put('/:id',          requireLevel(2), validate(updateAssetSchema), ctrl.update);
assetRouter.patch('/:id/status', requireLevel(1), validate(updateStatusSchema), ctrl.updateStatus);
assetRouter.delete('/:id',       requireLevel(3), ctrl.remove);

// Bộ đếm giờ chạy (luong1.rule)
assetRouter.get('/:assetId/counter',         counterCtrl.getCounter);
assetRouter.get('/:assetId/counter/history', counterCtrl.getHistory);
assetRouter.post('/:assetId/readings',       validate(readingSchema), counterCtrl.recordReading);
assetRouter.post('/:assetId/counter/reset',  requireLevel(2), counterCtrl.resetAfterMaintenance);
