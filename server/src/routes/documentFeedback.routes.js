/**
 * documentFeedback.routes.js — /api/document-feedback (hàng đợi xử lý cho NV Kỹ thuật).
 * Nested GET/POST /api/digital-assets/:id/feedback khai báo trong digitalAsset.routes.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/requirePermission.js';
import * as ctrl from '../controllers/documentFeedback.controller.js';

export const documentFeedbackRouter = Router();

documentFeedbackRouter.use(requireAuth);

documentFeedbackRouter.get(
  '/',
  requirePermission('DOCUMENT_FEEDBACK', 'UPDATE'),
  ctrl.listInbox,
);

documentFeedbackRouter.patch(
  '/:feedbackId',
  requirePermission('DOCUMENT_FEEDBACK', 'UPDATE'),
  ctrl.reviewUpdate,
);
