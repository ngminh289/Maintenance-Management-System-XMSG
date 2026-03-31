/**
 * digitalAsset.routes.js — /api/digital-assets.
 * Phân quyền nghiêm ngặt theo RBAC.
 * Gửi duyệt: SUBMIT (NV KT + Admin — BFD 4.1). Upload/phiên bản: CREATE/UPDATE.
 */
import { Router } from 'express';
import { requireAuth }       from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { uploadDocument }    from '../config/upload.js';
import * as ctrl from '../controllers/digitalAsset.controller.js';

export const digitalAssetRouter = Router();

digitalAssetRouter.use(requireAuth);

digitalAssetRouter.get('/',    ctrl.getAll);
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

// Xóa (chỉ DRAFT/REJECTED) — Kỹ thuật viên xóa bản thảo của mình
digitalAssetRouter.delete('/:id',
  requirePermission('DIGITAL_ASSET', 'UPDATE'),
  ctrl.remove,
);
