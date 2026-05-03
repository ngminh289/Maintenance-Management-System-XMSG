/**
 * stats.routes.js — /api/stats (Dashboard & Báo cáo).
 * project.rule Phân hệ 6: thống kê tài sản, phiếu việc, checklist.
 * /performance — Trưởng/Phó bảo trì + Trưởng/Phó PKT (L3, PID 6/8/7/9), Admin (L4+), Ban GĐ.
 * /resource-usage — CV KTS (L2) + Trưởng/Phó hai phòng (L3, PID 6/8/7/9), Admin (L4+), Ban GĐ.
 * /checklist-schedule-compliance, /approval-step-latencies, /checklist-ng-by-asset — cùng tuyến TP hai phòng + Admin + GĐ.
 * Liên quan: controllers/stats.controller.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { fail } from '../utils/response.js';
import * as ctrl from '../controllers/stats.controller.js';

export const statsRouter = Router();

statsRouter.use(requireAuth);

const TP_BAO_TRI = [6, 8];
const TUYEN_PKT = [7, 9];
const TP_HEAD_BOTH = [...TP_BAO_TRI, ...TUYEN_PKT];

/** Báo cáo hiệu suất: Trưởng/Phó hai phòng (L3), Admin (L4+), Ban GĐ — không CV KTS. */
function requirePerformanceAccess(req, res, next) {
  const { positionLevel, positionId } = req.user ?? {};
  const lvl = Number(positionLevel) || 0;
  const pid = Number(positionId) || 0;
  const allowed = lvl >= 4 || (lvl === 3 && TP_HEAD_BOTH.includes(pid));
  if (!allowed) {
    return fail(
      res,
      'Chỉ Trưởng/Phó phòng (Bảo trì hoặc Kỹ thuật-CN), Quản trị hoặc Ban Giám đốc được xem báo cáo hiệu suất tài sản',
      403,
    );
  }
  return next();
}

/** Báo cáo sử dụng tài nguyên: CV KTS (L2) + Trưởng/Phó (6/7/8/9) + Admin + Ban GĐ. */
function requireKTSorTruongPhongOrBGD(req, res, next) {
  const { positionLevel, positionId } = req.user ?? {};
  const lvl = Number(positionLevel) || 0;
  const pid = Number(positionId) || 0;
  const l3ok = lvl === 3 && TP_HEAD_BOTH.includes(pid);
  const allowed = lvl === 2 || l3ok || lvl >= 4;
  if (!allowed) {
    return fail(
      res,
      'Chỉ Chuyên viên KTS, Trưởng/Phó phòng (hai tuyến), Quản trị hoặc Ban Giám đốc được xem báo cáo này',
      403,
    );
  }
  return next();
}

/** Báo cáo nghiệp vụ checklist: Trưởng/Phó hai phòng, Admin, Ban GĐ. */
function requireTruongPhongOrBGD(req, res, next) {
  const { positionLevel, positionId } = req.user ?? {};
  const lvl = Number(positionLevel) || 0;
  const pid = Number(positionId) || 0;
  const allowed = lvl >= 4 || (lvl === 3 && TP_HEAD_BOTH.includes(pid));
  if (!allowed) {
    return fail(
      res,
      'Chỉ Trưởng/Phó phòng (Bảo trì hoặc Kỹ thuật-CN), Quản trị hoặc Ban Giám đốc được xem báo cáo nghiệp vụ checklist này',
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
