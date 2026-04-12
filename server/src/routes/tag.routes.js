/**
 * tag.routes.js — /api/tags.
 * CRUD tag danh mục: quyền TAG (NV KT); GET mở cho mọi user đã đăng nhập (lọc UI).
 * Liên quan: controllers/tag.controller.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/requirePermission.js';
import * as ctrl from '../controllers/tag.controller.js';

export const tagRouter = Router();

tagRouter.use(requireAuth);

tagRouter.get('/',    ctrl.getAll);
tagRouter.get('/:id', ctrl.getById);
tagRouter.post('/',   requirePermission('TAG', 'CREATE'), ctrl.create);
tagRouter.put('/:id', requirePermission('TAG', 'UPDATE'), ctrl.update);
tagRouter.delete('/:id', requirePermission('TAG', 'DELETE'), ctrl.remove);
