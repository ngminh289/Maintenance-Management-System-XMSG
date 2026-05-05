/**
 * stats.api.js — Gọi /api/stats (dashboard, báo cáo checklist, phê duyệt, hiệu suất).
 * RBAC: /performance và /resource-usage kiểm tra trên server (khớp rbac.js).
 */
import { api } from './index.js';
export const statsApi = {
  summary:           ()         => api.get('/stats'),
  checklistTrend:    ()         => api.get('/stats/checklist-trend'),
  /** Slot WO từ lịch — RBAC: Trưởng phòng + Ban GĐ */
  checklistScheduleCompliance: (months) =>
    api.get('/stats/checklist-schedule-compliance', { params: { months } }),
  /** Hiệu ActionDate giữa các bước CurrentLevel trong ApprovalLogs */
  approvalStepLatencies: (months) =>
    api.get('/stats/approval-step-latencies', { params: { months } }),
  /** NG theo ngày × thiết bị (top N tài sản hay NG); RBAC: Trưởng phòng + Ban GĐ */
  checklistNgByAsset: (months, topAssets) =>
    api.get('/stats/checklist-ng-by-asset', { params: { months, topAssets } }),
  topFaulty:         (limit)    => api.get('/stats/top-faulty', { params: { limit } }),
  woCompletion:      ()         => api.get('/stats/wo-completion'),
  digitalAssets:     ()         => api.get('/stats/digital-assets'),
  /** BFD 6.4 — Báo cáo hiệu suất: MTBF, MTTR, Downtime, Kế hoạch vs Thực tế, Pareto. */
  performance:       (months, employeeId, planType)   => api.get('/stats/performance', {
    params: {
      months,
      employeeId: employeeId || undefined,
      planType: planType || undefined,
    },
  }),
  /** Báo cáo sử dụng tài nguyên (QR, mở tài liệu, góp ý…); RBAC: CV KTS + Trưởng phòng + Ban GĐ. */
  resourceUsage:     (months)   => api.get('/stats/resource-usage', { params: { months } }),
};
