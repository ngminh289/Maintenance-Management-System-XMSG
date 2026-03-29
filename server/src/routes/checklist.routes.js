/**
 * checklist.routes.js — /api/checklists (templates + kết quả hiện trường).
 * Phân quyền nghiêm ngặt theo RBAC.
 * Templates: Kỹ thuật viên C/U; Trưởng ca APPROVE; Trưởng phòng DELETE.
 * Results: Công nhân / Trưởng ca CREATE; mọi người READ.
 */
import { Router } from 'express';
import { requireAuth }       from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validate }          from '../middleware/validate.js';
import { uploadPhoto }       from '../config/upload.js';
import {
  templateSchema, submitChecklistSchema,
} from '../validators/checklist.validator.js';
import * as ctrl from '../controllers/checklist.controller.js';

export const checklistRouter = Router();

checklistRouter.use(requireAuth);

// ── Templates ──────────────────────────────────────────────────────────────
checklistRouter.get('/templates',     ctrl.getTemplates);
checklistRouter.get('/templates/:id', ctrl.getTemplateById);

checklistRouter.post('/templates',
  requirePermission('CHECKLIST_TEMPLATE', 'CREATE'),
  validate(templateSchema),
  ctrl.createTemplate,
);
checklistRouter.put('/templates/:id',
  requirePermission('CHECKLIST_TEMPLATE', 'UPDATE'),
  ctrl.updateTemplate,
);
checklistRouter.delete('/templates/:id',
  requirePermission('CHECKLIST_TEMPLATE', 'DELETE'),
  ctrl.removeTemplate,
);

// Template items (câu hỏi)
checklistRouter.post('/templates/:templateId/items',
  requirePermission('CHECKLIST_TEMPLATE', 'UPDATE'),
  ctrl.addItem,
);
checklistRouter.put('/items/:itemId',
  requirePermission('CHECKLIST_TEMPLATE', 'UPDATE'),
  ctrl.updateItem,
);
checklistRouter.delete('/items/:itemId',
  requirePermission('CHECKLIST_TEMPLATE', 'UPDATE'),
  ctrl.removeItem,
);

// ── QR Scan & Results ──────────────────────────────────────────────────────
// QR Scan — công nhân/KTV quét để lấy thông tin tài sản + template
checklistRouter.get('/qr/:assetId', ctrl.getQRInfo);

// GET danh sách kết quả checklist (tất cả user được auth đều xem được)
checklistRouter.get('/results', ctrl.getResults);

// QUAN TRỌNG: /results/asset/:assetId phải đứng TRƯỚC /results/:id
// để Express không match 'asset' làm :id
checklistRouter.get('/results/asset/:assetId', ctrl.getResultsByAsset);
checklistRouter.get('/results/:id',             ctrl.getResultById);

// Submit kết quả hiện trường — cần quyền CREATE CHECKLIST_RESULT
checklistRouter.post('/results',
  requirePermission('CHECKLIST_RESULT', 'CREATE'),
  uploadPhoto.single('photo'),
  validate(submitChecklistSchema),
  ctrl.submitResult,
);
