/**
 * documentCategory.routes.js — /api/document-categories.
 * Đọc: mọi user có READ DOCUMENT_CATEGORY; C/U/D: NV KT (và quyền tương ứng).
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/requirePermission.js';
import * as ctrl from '../controllers/documentCategory.controller.js';

export const documentCategoryRouter = Router();

documentCategoryRouter.use(requireAuth);

documentCategoryRouter.get('/', requirePermission('DOCUMENT_CATEGORY', 'READ'), ctrl.getAll);
documentCategoryRouter.get('/:id', requirePermission('DOCUMENT_CATEGORY', 'READ'), ctrl.getById);
documentCategoryRouter.post(
  '/',
  requirePermission('DOCUMENT_CATEGORY', 'CREATE'),
  ctrl.create,
);
documentCategoryRouter.put(
  '/:id',
  requirePermission('DOCUMENT_CATEGORY', 'UPDATE'),
  ctrl.update,
);
documentCategoryRouter.delete(
  '/:id',
  requirePermission('DOCUMENT_CATEGORY', 'DELETE'),
  ctrl.remove,
);
