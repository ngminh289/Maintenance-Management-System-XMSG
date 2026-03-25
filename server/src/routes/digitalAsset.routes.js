/**
 * digitalAsset.routes.js — /api/digital-assets.
 * Upload dùng multipart/form-data (multer). Field name: "file".
 * Flow: upload → DRAFT → submit → PENDING → approve → APPROVED.
 * Liên quan: controllers/digitalAsset.controller.js, config/upload.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import { uploadDocument } from '../config/upload.js';
import * as ctrl from '../controllers/digitalAsset.controller.js';

export const digitalAssetRouter = Router();

digitalAssetRouter.use(requireAuth);

digitalAssetRouter.get('/',    ctrl.getAll);
digitalAssetRouter.get('/:id', ctrl.getById);

// Upload tài liệu mới (field: "file")
digitalAssetRouter.post('/',
  uploadDocument.single('file'),
  ctrl.upload,
);

digitalAssetRouter.put('/:id', ctrl.update);

// Upload phiên bản mới (trở về DRAFT để chờ duyệt lại)
digitalAssetRouter.post('/:id/new-version',
  uploadDocument.single('file'),
  ctrl.newVersion,
);

// Gửi phê duyệt: DRAFT → PENDING
digitalAssetRouter.post('/:id/submit',   ctrl.submitForApproval);

// Lưu trữ: APPROVED → ARCHIVED (Level >= 2)
digitalAssetRouter.post('/:id/archive',  requireLevel(2), ctrl.archive);

// Tags
digitalAssetRouter.post('/:id/tags',     ctrl.addTag);
digitalAssetRouter.delete('/:id/tags/:tagId', ctrl.removeTag);

// Xóa (chỉ DRAFT/REJECTED)
digitalAssetRouter.delete('/:id', ctrl.remove);
