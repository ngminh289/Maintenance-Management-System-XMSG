/**
 * checklist.routes.js — /api/checklists (templates + kết quả hiện trường).
 * Phân quyền nghiêm ngặt theo RBAC.
 * Templates: CV KTS + Trưởng/Phó PKT (2,7,9) CRUD; các vị trí còn lại chỉ READ.
 * Nghiệp vụ hiện tại: mỗi loại tài sản có thể có N template checklist.
 * Results: CN + Trưởng phòng nộp (CREATE); tiếp nhận = CHECKLIST_RESULT:APPROVE (UPDATE giữ tương thích DB cũ).
 */
import { Router } from 'express';
import { requireAuth }       from '../middleware/auth.middleware.js';
import { requirePermission, requirePermissionAny } from '../middleware/requirePermission.js';
import { validate }          from '../middleware/validate.js';
import { uploadChecklistSubmit } from '../config/upload.js';
import { cloudinaryAfterAny } from '../middleware/cloudinaryUpload.middleware.js';
import {
  templateSchema, templateItemSchema, submitChecklistSchema, reviewChecklistSchema,
} from '../validators/checklist.validator.js';
import * as ctrl from '../controllers/checklist.controller.js';

export const checklistRouter = Router();

checklistRouter.use(requireAuth);

// ── Templates ──────────────────────────────────────────────────────────────
checklistRouter.get('/templates',
  requirePermission('CHECKLIST_TEMPLATE', 'READ'),
  ctrl.getTemplates,
);
checklistRouter.get('/templates/:id',
  requirePermission('CHECKLIST_TEMPLATE', 'READ'),
  ctrl.getTemplateById,
);

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
  validate(templateItemSchema),
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

// Hàng chờ Trưởng ca (BFD mục 3) — trước /results/:id để không nhầm id
checklistRouter.get('/results/pending-review',
  requirePermissionAny('CHECKLIST_RESULT', ['APPROVE', 'UPDATE']),
  ctrl.getPendingReviewResults,
);

// GET danh sách kết quả — CN: APPROVED (mọi người) + phiếu của mình (mọi trạng thái); NVKT+ xem hết
checklistRouter.get('/results', ctrl.getResults);

// QUAN TRỌNG: /results/asset/:assetId phải đứng TRƯỚC /results/:id
checklistRouter.get('/results/asset/:assetId', ctrl.getResultsByAsset);

checklistRouter.post('/results/:id/review',
  requirePermissionAny('CHECKLIST_RESULT', ['APPROVE', 'UPDATE']),
  validate(reviewChecklistSchema),
  ctrl.reviewChecklistResult,
);

checklistRouter.get('/results/:id', ctrl.getResultById);

// Submit kết quả hiện trường — cần quyền CREATE CHECKLIST_RESULT
checklistRouter.post('/results',
  requirePermission('CHECKLIST_RESULT', 'CREATE'),
  uploadChecklistSubmit,
  cloudinaryAfterAny('warehouse/checklist-photos', 'image'),
  validate(submitChecklistSchema),
  ctrl.submitResult,
);
