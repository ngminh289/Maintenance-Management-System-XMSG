/**
 * workOrder.routes.js — /api/work-orders.
 * Phân quyền nghiêm ngặt theo RBAC.
 * Admin: READ + CREATE (khởi tạo phiếu chờ duyệt — BFD 4.1); không UPDATE/assign trừ khi bổ sung quyền.
 * PATCH /:id/closure-notes — lưu nháp ghi chú/vật tư (WAITING…PAUSED); POST /:id/counter-reset-baseline — CORRECTIVE reset mốc giờ PM.
 */
import { Router } from 'express';
import { requireAuth }       from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validate }          from '../middleware/validate.js';
import {
  createWOSchema,
  updateWOSchema,
  changeStatusSchema,
  assignSchema,
  closureNotesDraftSchema,
  workOrderPowerSchema,
} from '../validators/workOrder.validator.js';
import { uploadWoPhotos } from '../config/upload.js';
import { cloudinaryAfterArray } from '../middleware/cloudinaryUpload.middleware.js';
import * as ctrl from '../controllers/workOrder.controller.js';

export const workOrderRouter = Router();

workOrderRouter.use(requireAuth);

/**
 * Tab "Đã lưu trữ" — chỉ Admin (positionId = 4).
 * Đặt trước /:id để Express không nhầm "archived" thành id.
 */
function requireAdmin(req, res, next) {
  if (Number(req.user?.positionId) !== 4) {
    return res.status(403).json({ message: 'Chỉ Quản trị viên được truy cập kho lưu trữ phiếu việc.' });
  }
  return next();
}

workOrderRouter.get('/archived', requireAdmin, ctrl.getArchived);

workOrderRouter.get('/',    ctrl.getAll);

workOrderRouter.patch('/:id/closure-notes',
  requirePermission('WORK_ORDER', 'UPDATE'),
  validate(closureNotesDraftSchema),
  ctrl.saveClosureNotesDraft,
);
workOrderRouter.post('/:id/counter-reset-baseline',
  requirePermission('WORK_ORDER', 'UPDATE'),
  ctrl.resetRuntimeBaselineForCorrective,
);

workOrderRouter.get('/:id', ctrl.getById);

workOrderRouter.post('/',
  requirePermission('WORK_ORDER', 'CREATE'),
  validate(createWOSchema),
  ctrl.create,
);
workOrderRouter.put('/:id',
  requirePermission('WORK_ORDER', 'UPDATE'),
  validate(updateWOSchema),
  ctrl.update,
);

// Chuyển trạng thái — cần quyền UPDATE (nhận việc, hoàn thành)
workOrderRouter.patch('/:id/status',
  requirePermission('WORK_ORDER', 'UPDATE'),
  validate(changeStatusSchema),
  ctrl.changeStatus,
);
workOrderRouter.patch('/:id/power-state',
  requirePermission('WORK_ORDER', 'UPDATE'),
  validate(workOrderPowerSchema),
  ctrl.setPowerState,
);

workOrderRouter.post('/:id/photos',
  requirePermission('WORK_ORDER', 'UPDATE'),
  uploadWoPhotos.array('photos', 15),
  cloudinaryAfterArray('warehouse/work-orders', 'image'),
  ctrl.addPhotos,
);

workOrderRouter.delete('/:id/photos/:photoId',
  requirePermission('WORK_ORDER', 'UPDATE'),
  ctrl.deletePhoto,
);

// Phân công cá nhân
workOrderRouter.post('/:id/assign',
  requirePermission('WORK_ORDER', 'UPDATE'),
  validate(assignSchema),
  ctrl.assign,
);
// Phân công nhóm — { groupId, leaderId }
workOrderRouter.post('/:id/assign-group',
  requirePermission('WORK_ORDER', 'UPDATE'),
  ctrl.assignGroup,
);
workOrderRouter.delete('/:id/assign/:employeeId',
  requirePermission('WORK_ORDER', 'UPDATE'),
  ctrl.unassign,
);

workOrderRouter.delete('/:id',
  requirePermission('WORK_ORDER', 'DELETE'),
  ctrl.remove,
);

workOrderRouter.post('/:id/restore', requireAdmin, ctrl.restore);
