/**
 * documentFeedback.routes.js — /api/document-feedback (inbox phản hồi).
 * GET /: READ hoặc UPDATE; PATCH /:feedbackId: UPDATE (xử lý trạng thái).
 * Nested GET/POST /api/digital-assets/:id/feedback khai báo trong digitalAsset.routes.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requirePermission, requirePermissionAny } from '../middleware/requirePermission.js';
import * as ctrl from '../controllers/documentFeedback.controller.js';

export const documentFeedbackRouter = Router();

documentFeedbackRouter.use(requireAuth);

documentFeedbackRouter.get(
  '/',
  requirePermissionAny('DOCUMENT_FEEDBACK', ['READ', 'UPDATE']),
  ctrl.listInbox,
);

documentFeedbackRouter.patch(
  '/:feedbackId',
  requirePermission('DOCUMENT_FEEDBACK', 'UPDATE'),
  ctrl.reviewUpdate,
);
