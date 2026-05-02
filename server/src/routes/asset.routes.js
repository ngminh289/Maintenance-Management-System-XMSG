/**
 * asset.routes.js — /api/assets (CRUD + PATCH status + bộ đếm giờ + predictive-events + QR + ảnh).
 * Phân quyền nghiêm ngặt theo RBAC (Roles_Permissions).
 * DELETE là soft-delete (DECOMMISSIONED) theo project.rule.
 * Ảnh: POST/DELETE /api/assets/:id/photos — chỉ ASSET:UPDATE.
 */
import { Router } from 'express';
import { requireAuth }        from '../middleware/auth.middleware.js';
import { requirePermission }  from '../middleware/requirePermission.js';
import { validate }           from '../middleware/validate.js';
import {
  createAssetSchema, updateAssetSchema, updateStatusSchema,
} from '../validators/asset.validator.js';
import { readingSchema } from '../validators/checklist.validator.js';
import { uploadAssetPhotos } from '../config/upload.js';
import { cloudinaryAfterArray } from '../middleware/cloudinaryUpload.middleware.js';
import * as ctrl        from '../controllers/asset.controller.js';
import * as counterCtrl from '../controllers/assetCounter.controller.js';

export const assetRouter = Router();

assetRouter.use(requireAuth);

// CRUD tài sản
assetRouter.get('/',    ctrl.getAll);
assetRouter.get('/:id', ctrl.getById);

assetRouter.post('/',
  requirePermission('ASSET', 'CREATE'),
  validate(createAssetSchema),
  ctrl.create,
);
assetRouter.put('/:id',
  requirePermission('ASSET', 'UPDATE'),
  validate(updateAssetSchema),
  ctrl.update,
);
assetRouter.patch('/:id/status',
  requirePermission('ASSET', 'UPDATE'),
  validate(updateStatusSchema),
  ctrl.updateStatus,
);
assetRouter.delete('/:id',
  requirePermission('ASSET', 'DELETE'),
  ctrl.remove,
);

// QR code
assetRouter.get('/:id/qr', ctrl.generateQR);

// Ảnh tài sản — chỉ ASSET:UPDATE mới upload/xóa được
assetRouter.get('/:id/photos', ctrl.getPhotos);
assetRouter.post('/:id/photos',
  requirePermission('ASSET', 'UPDATE'),
  uploadAssetPhotos.array('photos', 10),
  cloudinaryAfterArray('warehouse/assets', 'image'),
  ctrl.addPhotos,
);
assetRouter.delete('/:id/photos/:photoId',
  requirePermission('ASSET', 'UPDATE'),
  ctrl.deletePhoto,
);

// Bộ đếm giờ chạy
assetRouter.get('/:assetId/counter',             counterCtrl.getCounter);
assetRouter.get('/:assetId/counter/history',     counterCtrl.getHistory);
assetRouter.get('/:assetId/predictive-events',   counterCtrl.getPredictiveEvents);
assetRouter.get('/:assetId/maintenance-history', counterCtrl.getMaintenanceHistory);
assetRouter.post('/:assetId/readings',
  requirePermission('RUNTIME_LOG', 'CREATE'),
  validate(readingSchema),
  counterCtrl.recordReading,
);
assetRouter.post('/:assetId/counter/reset',
  requirePermission('ASSET', 'UPDATE'),
  counterCtrl.resetAfterMaintenance,
);
