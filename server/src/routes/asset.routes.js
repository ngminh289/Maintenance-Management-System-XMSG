/**
 * asset.routes.js — /api/assets (CRUD + PATCH status).
 * Query params: ?page&limit&status&assetTypeId&locationId&search
 * Phân quyền: GET tất cả; tạo/sửa yêu cầu Level >= 1; xóa Level >= 3.
 * Liên quan: controllers/asset.controller.js, validators/asset.validator.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import {
  createAssetSchema,
  updateAssetSchema,
  updateStatusSchema,
} from '../validators/asset.validator.js';
import * as ctrl from '../controllers/asset.controller.js';

export const assetRouter = Router();

assetRouter.use(requireAuth);

assetRouter.get('/',             ctrl.getAll);
assetRouter.get('/:id',          ctrl.getById);
assetRouter.post('/',            requireLevel(2), validate(createAssetSchema), ctrl.create);
assetRouter.put('/:id',          requireLevel(2), validate(updateAssetSchema), ctrl.update);
assetRouter.patch('/:id/status', requireLevel(1), validate(updateStatusSchema), ctrl.updateStatus);
assetRouter.delete('/:id',       requireLevel(3), ctrl.remove);
