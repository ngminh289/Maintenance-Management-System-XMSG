/**
 * digitalAsset.routes.js — /api/digital-assets.
 * Phân quyền nghiêm ngặt theo RBAC.
 * Gửi duyệt: SUBMIT (NV Kỹ thuật — BFD 4). Upload/phiên bản: CREATE/UPDATE (không áp dụng khi PENDING — service).
 * GET|POST /:id/feedback — phản hồi tài liệu (CREATE trừ NV KT — migration 038).
 * POST /:id/view-log — thống kê mở file (Báo cáo sử dụng tài nguyên).
 */
import { Router } from 'express';
import { requireAuth }       from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireLevel }      from '../middleware/requireRole.js';
import { uploadDocument }    from '../config/upload.js';
import * as ctrl from '../controllers/digitalAsset.controller.js';
import * as fbCtrl from '../controllers/documentFeedback.controller.js';

export const digitalAssetRouter = Router();

digitalAssetRouter.use(requireAuth);

digitalAssetRouter.get('/',    ctrl.getAll);

// Phản hồi / góp ý tài liệu (READ mọi vai có quyền; CREATE trừ NV KT — migration 038)
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

// Upload tài liệu mới — Kỹ thuật viên trở lên
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

// Upload phiên bản mới — cần UPDATE (Kỹ thuật viên+)
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

// Lưu trữ: APPROVED → ARCHIVED — Trưởng ca trở lên
digitalAssetRouter.post('/:id/archive',
  requirePermission('DIGITAL_ASSET', 'APPROVE'),
  ctrl.archive,
);

// Tags — Kỹ thuật viên tạo/xoá tag trên tài liệu của mình
digitalAssetRouter.post('/:id/tags',
  requirePermission('TAG', 'CREATE'),
  ctrl.addTag,
);
digitalAssetRouter.delete('/:id/tags/:tagId',
  requirePermission('TAG', 'UPDATE'),
  ctrl.removeTag,
);

// Xóa cứng bất kể trạng thái — chỉ Trưởng phòng (Level >= 3)
digitalAssetRouter.delete('/:id/force',
  requireLevel(3),
  ctrl.forceRemove,
);

// Xóa (chỉ DRAFT/REJECTED) — Kỹ thuật viên xóa bản thảo của mình
digitalAssetRouter.delete('/:id',
  requirePermission('DIGITAL_ASSET', 'UPDATE'),
  ctrl.remove,
);
