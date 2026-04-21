/**
 * index.js — Gom tất cả route API /api/*.
 * Liên quan: app.js, mọi *.routes.js; /document-feedback (NV KT xử lý phản hồi tài liệu).
 */
import { Router } from 'express';
import { healthRouter }              from './health.routes.js';
import { authRouter }                from './auth.routes.js';
import { departmentRouter }          from './department.routes.js';
import { positionRouter }            from './position.routes.js';
import { employeeRouter }            from './employee.routes.js';
import { assetTypeRouter }           from './assetType.routes.js';
import { locationRouter }            from './location.routes.js';
import { assetRouter }               from './asset.routes.js';
import { maintenanceScheduleRouter } from './maintenanceSchedule.routes.js';
import { workOrderRouter }           from './workOrder.routes.js';
import { approvalRouter }            from './approval.routes.js';
import { checklistRouter }           from './checklist.routes.js';
import { notificationRouter }        from './notification.routes.js';
import { digitalAssetRouter }        from './digitalAsset.routes.js';
import { documentFeedbackRouter }    from './documentFeedback.routes.js';
import { tagRouter }                 from './tag.routes.js';
import { documentCategoryRouter }    from './documentCategory.routes.js';
import { maintenanceGroupRouter }    from './maintenanceGroup.routes.js';
import { auditLogRouter }            from './auditLog.routes.js';
import { workflowRouter }            from './workflow.routes.js';
import { permissionRouter }          from './permission.routes.js';
import { retentionPolicyRouter }     from './retentionPolicy.routes.js';
import { statsRouter }               from './stats.routes.js';
import { productionLineRouter }      from './productionLine.routes.js';

export const apiRouter = Router();

// Core
apiRouter.use('/health',               healthRouter);
apiRouter.use('/auth',                 authRouter);

// Master data
apiRouter.use('/departments',          departmentRouter);
apiRouter.use('/positions',            positionRouter);
apiRouter.use('/employees',            employeeRouter);
apiRouter.use('/asset-types',          assetTypeRouter);
apiRouter.use('/locations',            locationRouter);
apiRouter.use('/production-lines',     productionLineRouter);
apiRouter.use('/tags',                 tagRouter);
apiRouter.use('/document-categories',  documentCategoryRouter);

// Operations
apiRouter.use('/assets',               assetRouter);
apiRouter.use('/maintenance-schedules', maintenanceScheduleRouter);
apiRouter.use('/maintenance-groups',   maintenanceGroupRouter);
apiRouter.use('/work-orders',          workOrderRouter);
apiRouter.use('/checklists',           checklistRouter);
apiRouter.use('/digital-assets',       digitalAssetRouter);
apiRouter.use('/document-feedback',    documentFeedbackRouter);

// Workflows & Approvals
apiRouter.use('/workflows',            workflowRouter);
apiRouter.use('/approvals',            approvalRouter);
apiRouter.use('/permissions',          permissionRouter);

// Notifications & Audit
apiRouter.use('/notifications',        notificationRouter);
apiRouter.use('/audit-logs',           auditLogRouter);
apiRouter.use('/retention-policies',   retentionPolicyRouter);

// Dashboard & Báo cáo (project.rule Phân hệ 6)
apiRouter.use('/stats',                statsRouter);
