/**
 * index.js — Gom tất cả route API /api/*.
 * Thứ tự mount: auth (public) → các module yêu cầu auth.
 * Liên quan: app.js, mọi *.routes.js.
 */
import { Router } from 'express';
import { healthRouter }     from './health.routes.js';
import { authRouter }       from './auth.routes.js';
import { departmentRouter } from './department.routes.js';
import { positionRouter }   from './position.routes.js';
import { employeeRouter }   from './employee.routes.js';
import { assetTypeRouter }  from './assetType.routes.js';
import { locationRouter }   from './location.routes.js';
import { assetRouter }      from './asset.routes.js';

export const apiRouter = Router();

apiRouter.use('/health',      healthRouter);
apiRouter.use('/auth',        authRouter);
apiRouter.use('/departments', departmentRouter);
apiRouter.use('/positions',   positionRouter);
apiRouter.use('/employees',   employeeRouter);
apiRouter.use('/asset-types', assetTypeRouter);
apiRouter.use('/locations',   locationRouter);
apiRouter.use('/assets',      assetRouter);
