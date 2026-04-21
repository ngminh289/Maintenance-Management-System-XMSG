/**
 * stats.routes.js — /api/stats (Dashboard & Báo cáo).
 * project.rule Phân hệ 6: thống kê tài sản, phiếu việc, checklist.
 * /performance — BFD 6.4: chỉ Trưởng phòng (L3, PID 6) và Giám đốc (L5+).
 * /resource-usage — CV KTS (L2), Trưởng phòng, Giám đốc.
 * /checklist-schedule-compliance, /approval-step-latencies, /checklist-ng-by-asset — chỉ Trưởng phòng + Ban GĐ.
 * Liên quan: controllers/stats.controller.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { fail } from '../utils/response.js';
import * as ctrl from '../controllers/stats.controller.js';

export const statsRouter = Router();

statsRouter.use(requireAuth);

/** Báo cáo hiệu suất tài sản: chỉ Trưởng phòng (L3+PID6) hoặc Ban GĐ (L5+). */
function requirePerformanceAccess(req, res, next) {
  const { positionLevel, positionId } = req.user ?? {};
  const lvl = positionLevel ?? 0;
  const pid = Number(positionId ?? 0);
  const allowed = (lvl === 3 && pid === 6) || lvl >= 5;
  if (!allowed) {
    return fail(
      res,
      'Chỉ Trưởng phòng hoặc Ban Giám đốc được xem báo cáo hiệu suất tài sản',
      403,
    );
  }
  return next();
}

/** Báo cáo sử dụng tài nguyên: Chuyên viên KTS (L2) + Trưởng phòng + Ban GĐ. */
function requireKTSorTruongPhongOrBGD(req, res, next) {
  const { positionLevel, positionId } = req.user ?? {};
  const lvl = positionLevel ?? 0;
  const pid = Number(positionId ?? 0);
  const allowed = lvl === 2 || (lvl === 3 && pid === 6) || lvl >= 5;
  if (!allowed) {
    return fail(
      res,
      'Chỉ Chuyên viên KTS, Trưởng phòng hoặc Ban Giám đốc được xem báo cáo này',
      403,
    );
  }
  return next();
}

/** Tỷ lệ checklist định kỳ + phân tích phê duyệt / NG theo máy — chỉ Trưởng phòng (L3+PID6) hoặc Ban GĐ (L5+) */
function requireTruongPhongOrBGD(req, res, next) {
  const { positionLevel, positionId } = req.user ?? {};
  const lvl = positionLevel ?? 0;
  const pid = Number(positionId ?? 0);
  const allowed = (lvl === 3 && pid === 6) || lvl >= 5;
  if (!allowed) {
    return fail(
      res,
      'Chỉ Trưởng phòng hoặc Ban Giám đốc được xem báo cáo nghiệp vụ checklist này',
      403,
    );
  }
  return next();
}

statsRouter.get('/',               ctrl.summary);
statsRouter.get('/checklist-trend',ctrl.checklistTrend);
statsRouter.get(
  '/checklist-schedule-compliance',
  requireTruongPhongOrBGD,
  ctrl.checklistScheduleCompliance,
);
statsRouter.get(
  '/approval-step-latencies',
  requireTruongPhongOrBGD,
  ctrl.approvalStepLatencies,
);
statsRouter.get(
  '/checklist-ng-by-asset',
  requireTruongPhongOrBGD,
  ctrl.checklistNgTrendByAsset,
);
statsRouter.get(
  '/resource-usage',
  requireKTSorTruongPhongOrBGD,
  ctrl.resourceUsageReport,
);
statsRouter.get('/top-faulty',     ctrl.topFaultyAssets);
statsRouter.get('/wo-completion',  ctrl.workOrderCompletion);
statsRouter.get('/digital-assets', ctrl.digitalAssetReport);
statsRouter.get('/performance',    requirePerformanceAccess, ctrl.performanceReport); // BFD 6.4
