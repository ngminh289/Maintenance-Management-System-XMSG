/**
 * stats.routes.js — /api/stats (Dashboard & Báo cáo).
 * project.rule Phân hệ 6: thống kê tài sản, phiếu việc, checklist.
 * Liên quan: controllers/stats.controller.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import * as ctrl from '../controllers/stats.controller.js';

export const statsRouter = Router();

statsRouter.use(requireAuth);

statsRouter.get('/',               ctrl.summary);           // Tổng hợp dashboard
statsRouter.get('/checklist-trend',ctrl.checklistTrend);    // Xu hướng OK/NG/WARNING 30 ngày
statsRouter.get('/top-faulty',     ctrl.topFaultyAssets);   // Top tài sản hay hỏng
statsRouter.get('/wo-completion',  ctrl.workOrderCompletion); // Hoàn thành WO theo tuần
