/**
 * checklist.routes.js — /api/checklists (templates + kết quả hiện trường).
 * Luồng QR: GET /qr/:assetId → POST /results → auto-logic → WO.
 * Liên quan: controllers/checklist.controller.js.
 */
import { Router } from 'express';
import { requireAuth }  from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import { validate }     from '../middleware/validate.js';
import { uploadPhoto }  from '../config/upload.js';
import { templateSchema, submitChecklistSchema } from '../validators/checklist.validator.js';
import * as ctrl from '../controllers/checklist.controller.js';

export const checklistRouter = Router();

checklistRouter.use(requireAuth);

// Templates
checklistRouter.get('/templates',                    ctrl.getTemplates);
checklistRouter.get('/templates/:id',                ctrl.getTemplateById);
checklistRouter.post('/templates', requireLevel(2),  validate(templateSchema), ctrl.createTemplate);
checklistRouter.put('/templates/:id', requireLevel(2), ctrl.updateTemplate);
checklistRouter.delete('/templates/:id', requireLevel(3), ctrl.removeTemplate);

// Template items (câu hỏi)
checklistRouter.post('/templates/:templateId/items', requireLevel(2), ctrl.addItem);
checklistRouter.put('/items/:itemId',                requireLevel(2), ctrl.updateItem);
checklistRouter.delete('/items/:itemId',             requireLevel(2), ctrl.removeItem);

// QR Scan — công nhân quét QR lấy thông tin tài sản + template
checklistRouter.get('/qr/:assetId', ctrl.getQRInfo);

// Results — hỗ trợ upload ảnh minh chứng (field: "photo", tùy chọn)
checklistRouter.post('/results',
  uploadPhoto.single('photo'),
  validate(submitChecklistSchema),
  ctrl.submitResult,
);
checklistRouter.get('/results/:id', ctrl.getResultById);
checklistRouter.get('/results/asset/:assetId', ctrl.getResultsByAsset);
