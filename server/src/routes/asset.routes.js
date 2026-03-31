/**
 * asset.routes.js — /api/assets (CRUD + PATCH status + bộ đếm giờ + predictive-events + QR).
 * Phân quyền nghiêm ngặt theo RBAC (Roles_Permissions).
 * DELETE là soft-delete (DECOMMISSIONED) theo project.rule.
 */
import { Router } from 'express';
import { requireAuth }        from '../middleware/auth.middleware.js';
import { requirePermission }  from '../middleware/requirePermission.js';
import { validate }           from '../middleware/validate.js';
import {
  createAssetSchema, updateAssetSchema, updateStatusSchema,
} from '../validators/asset.validator.js';
import { readingSchema } from '../validators/checklist.validator.js';
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
  ctrl.remove,                           // soft-delete → DECOMMISSIONED
);

// QR code
assetRouter.get('/:id/qr', ctrl.generateQR);

// Bộ đếm giờ chạy
assetRouter.get('/:assetId/counter',              counterCtrl.getCounter);
assetRouter.get('/:assetId/counter/history',      counterCtrl.getHistory);
assetRouter.get('/:assetId/predictive-events',    counterCtrl.getPredictiveEvents);
assetRouter.get('/:assetId/maintenance-history',   counterCtrl.getMaintenanceHistory);
assetRouter.post('/:assetId/readings',
  requirePermission('RUNTIME_LOG', 'CREATE'),
  validate(readingSchema),
  counterCtrl.recordReading,
);
assetRouter.post('/:assetId/counter/reset',
  requirePermission('ASSET', 'UPDATE'),
  counterCtrl.resetAfterMaintenance,
);
