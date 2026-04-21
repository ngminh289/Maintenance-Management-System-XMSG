/**
 * assetType.routes.js — /api/asset-types (CRUD).
 * Phân quyền: GET tất cả; POST/PUT/DELETE yêu cầu Level >= 2.
 * Liên quan: controllers/assetType.controller.js, validators/assetType.validator.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { assetTypeSchema } from '../validators/assetType.validator.js';
import * as ctrl from '../controllers/assetType.controller.js';

export const assetTypeRouter = Router();

assetTypeRouter.use(requireAuth);

assetTypeRouter.get('/',        ctrl.getAll);
assetTypeRouter.get('/leaves',  ctrl.getLeaves);  // Trước /:id — chỉ loại con (leaf)
assetTypeRouter.get('/:id',     ctrl.getById);
assetTypeRouter.post('/',   requireLevel(2), validate(assetTypeSchema), ctrl.create);
assetTypeRouter.put('/:id', requireLevel(2), validate(assetTypeSchema), ctrl.update);
assetTypeRouter.delete('/:id', requireLevel(3), ctrl.remove);
