/**
 * digitalAsset.routes.js — /api/digital-assets.
 * Phân quyền nghiêm ngặt theo RBAC.
 * Gửi duyệt: SUBMIT (CV KTS + PKT). Upload/phiên bản: CREATE/UPDATE — service kiểm chủ sở hữu (056).
 * Archive: APPROVE (Trưởng/Phó PKT). Force delete: DIGITAL_ASSET DELETE (056).
 * GET|POST /:id/feedback — phản hồi (CREATE trừ CV KTS & Trưởng/Phó PKT — 038/057).
 * POST /:id/view-log — thống kê mở file (Báo cáo sử dụng tài nguyên).
 */
import { Router } from 'express';
import { requireAuth }       from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { uploadDocument }    from '../config/upload.js';
import * as ctrl from '../controllers/digitalAsset.controller.js';
import * as fbCtrl from '../controllers/documentFeedback.controller.js';

export const digitalAssetRouter = Router();

digitalAssetRouter.use(requireAuth);

digitalAssetRouter.get('/',    ctrl.getAll);

// Phản hồi / góp ý (READ mọi vai có quyền; CREATE trừ KTS & PKT — 038)
digitalAssetRouter.get(
  '/:id/feedback',
  requirePermission('DOCUMENT_FEEDBACK', 'READ'),
  fbCtrl.listForAsset,
);
digitalAssetRouter.post(
  '/:id/feedback',
  requirePermission('DOCUMENT_FEEDBACK', 'CREATE'),
  fbCtrl.createForAsset,
);

digitalAssetRouter.post(
  '/:id/view-log',
  requirePermission('DIGITAL_ASSET', 'READ'),
  ctrl.logDocumentView,
);

digitalAssetRouter.get('/:id', ctrl.getById);

// Upload tài liệu mới — CV KTS + Trưởng/Phó PKT (CREATE)
digitalAssetRouter.post('/',
  requirePermission('DIGITAL_ASSET', 'CREATE'),
  uploadDocument.single('file'),
  ctrl.upload,
);
digitalAssetRouter.put('/:id',
  requirePermission('DIGITAL_ASSET', 'UPDATE'),
  ctrl.update,
);

// Lịch sử phiên bản
digitalAssetRouter.get('/:id/versions', ctrl.getVersions);

// Upload phiên bản mới — CV KTS + PKT (UPDATE + chủ sở hữu ở service)
digitalAssetRouter.post('/:id/versions',
  requirePermission('DIGITAL_ASSET', 'UPDATE'),
  uploadDocument.single('file'),
  ctrl.newVersion,
);

// Gửi phê duyệt: DRAFT → PENDING (quyền SUBMIT — khởi tạo luồng 4.1)
digitalAssetRouter.post('/:id/submit',
  requirePermission('DIGITAL_ASSET', 'SUBMIT'),
  ctrl.submitForApproval,
);

// Lưu trữ: APPROVED → ARCHIVED — Trưởng/Phó PKT
digitalAssetRouter.post('/:id/archive',
  requirePermission('DIGITAL_ASSET', 'APPROVE'),
  ctrl.archive,
);

// Tags — CV KTS + PKT (TAG + chủ sở hữu ở service)
digitalAssetRouter.post('/:id/tags',
  requirePermission('TAG', 'CREATE'),
  ctrl.addTag,
);
digitalAssetRouter.delete('/:id/tags/:tagId',
  requirePermission('TAG', 'UPDATE'),
  ctrl.removeTag,
);

// Xóa cứng bất kể trạng thái — Trưởng/Phó PKT (quyền DELETE)
digitalAssetRouter.delete('/:id/force',
  requirePermission('DIGITAL_ASSET', 'DELETE'),
  ctrl.forceRemove,
);

// Xóa (chỉ DRAFT/REJECTED) — CV KTS + PKT, bản thảo của mình (service)
digitalAssetRouter.delete('/:id',
  requirePermission('DIGITAL_ASSET', 'UPDATE'),
  ctrl.remove,
);
