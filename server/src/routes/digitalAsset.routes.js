/**
 * digitalAsset.routes.js — /api/digital-assets.
 * Phân quyền nghiêm ngặt theo RBAC.
 * Gửi duyệt: SUBMIT (CV KTS + PKT). Upload/phiên bản: CREATE/UPDATE — service kiểm chủ sở hữu (056).
 * Archive / lưu trữ phiên bản (072): POST /:id/archive-document,
 * POST /:id/versions/:versionId/archive; khôi phục POST /:id/restore và
 * /:id/versions/:versionId/restore (Admin/PKT). DELETE /:id chỉ xoá vĩnh viễn
 * bản nháp (DRAFT) — service kiểm tra.
 * GET /archived-versions — tab "Đã lưu trữ".
 * GET|POST /:id/feedback — phản hồi (CREATE trừ CV KTS & Trưởng/Phó PKT — 038/057).
 * POST /:id/view-log — thống kê mở file (Báo cáo sử dụng tài nguyên).
 */
import { Router } from 'express';
import { requireAuth }       from '../middleware/auth.middleware.js';
import { requirePermission, requirePermissionAny } from '../middleware/requirePermission.js';
import { uploadDocument }    from '../config/upload.js';
import { isCloudinaryEnabled } from '../config/cloudinary.js';
import { cloudinaryAfterSingle } from '../middleware/cloudinaryUpload.middleware.js';
import * as ctrl from '../controllers/digitalAsset.controller.js';
import * as fbCtrl from '../controllers/documentFeedback.controller.js';

export const digitalAssetRouter = Router();

const damUpload =
  isCloudinaryEnabled()
    ? [uploadDocument.single('file'), cloudinaryAfterSingle('warehouse/documents', 'raw')]
    : [uploadDocument.single('file')];

digitalAssetRouter.use(requireAuth);

digitalAssetRouter.get('/',    ctrl.getAll);

// Tab "Đã lưu trữ" — list mọi phiên bản đã archive (Admin + Trưởng/Phó PKT).
// Đặt TRƯỚC route /:id để tránh khớp nhầm `archived-versions` thành :id.
digitalAssetRouter.get('/archived-versions',
  requirePermissionAny('DIGITAL_ASSET', ['UPDATE', 'DELETE', 'APPROVE']),
  ctrl.listArchivedVersions,
);

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
  ...damUpload,
  ctrl.upload,
);
// Sửa metadata: CV KTS có UPDATE; Admin/PKT có UPDATE hoặc DELETE — service
// kiểm tra cuối (role + status + owner) theo bảng nghiệp vụ.
digitalAssetRouter.put('/:id',
  requirePermissionAny('DIGITAL_ASSET', ['UPDATE', 'DELETE']),
  ctrl.update,
);

// Lịch sử phiên bản
digitalAssetRouter.get('/:id/versions', ctrl.getVersions);

// Upload phiên bản mới — CV KTS + PKT (UPDATE + chủ sở hữu ở service)
digitalAssetRouter.post('/:id/versions',
  requirePermission('DIGITAL_ASSET', 'UPDATE'),
  ...damUpload,
  ctrl.newVersion,
);

// Gửi phê duyệt: DRAFT → PENDING (quyền SUBMIT — khởi tạo luồng 4.1)
digitalAssetRouter.post('/:id/submit',
  requirePermission('DIGITAL_ASSET', 'SUBMIT'),
  ctrl.submitForApproval,
);

// Lưu trữ flow cũ: APPROVED → ARCHIVED — Trưởng/Phó PKT (giữ tương thích).
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

// ── Lưu trữ thay xoá cứng (072) ───────────────────────────────────────────
// Service kiểm tra chi tiết role + status + owner; middleware chỉ filter sơ.

// Lưu trữ cả tài liệu (button "Lưu trữ" → "Cả tài liệu").
digitalAssetRouter.post('/:id/archive-document',
  requirePermissionAny('DIGITAL_ASSET', ['UPDATE', 'DELETE', 'APPROVE']),
  ctrl.archiveDocument,
);

// Lưu trữ một phiên bản cụ thể (button "Lưu trữ" → "Chọn phiên bản").
digitalAssetRouter.post('/:id/versions/:versionId/archive',
  requirePermissionAny('DIGITAL_ASSET', ['UPDATE', 'DELETE', 'APPROVE']),
  ctrl.archiveVersion,
);

// Khôi phục cả tài liệu (Admin + Trưởng/Phó PKT).
digitalAssetRouter.post('/:id/restore',
  requirePermissionAny('DIGITAL_ASSET', ['UPDATE', 'DELETE', 'APPROVE']),
  ctrl.restoreDocument,
);

// Khôi phục một phiên bản (Admin + Trưởng/Phó PKT).
digitalAssetRouter.post('/:id/versions/:versionId/restore',
  requirePermissionAny('DIGITAL_ASSET', ['UPDATE', 'DELETE', 'APPROVE']),
  ctrl.restoreVersion,
);

// Xoá vĩnh viễn — chỉ DRAFT (bản nháp); tài liệu đã duyệt dùng archive.
digitalAssetRouter.delete('/:id',
  requirePermissionAny('DIGITAL_ASSET', ['UPDATE', 'DELETE']),
  ctrl.remove,
);
