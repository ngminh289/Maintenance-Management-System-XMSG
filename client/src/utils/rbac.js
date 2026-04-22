/**
 * rbac.js — Frontend RBAC theo Positions (DB) + level.
 *
 * Vai trò UI (key code giữ congNhan/kyThuat; nhãn hiển thị: KTV hiện trường / Chuyên viên KTS):
 *   1 — congNhan     : KTV hiện trường
 *   2 — kyThuat      : Chuyên viên kỹ thuật số (rule/nv_kythuat.rule)
 *   truongCa    : Trưởng ca (PositionID 3; rule/truongca.rule)
 *   truongPhong : Trưởng phòng (PositionID 6, Level 3; duyệt bước 2 WO khẩn — migration 019)
 *   4 — admin        : Quản trị viên
 *   5 — bGD          : Ban Giám đốc
 *
 * Liên quan: Sidebar.jsx, DashboardPage.jsx, App.jsx; migration 019 (tách TC / Trưởng phòng).
 * Báo cáo: ba tab con /reports/operations|resource-usage|performance — TP/Phó hai phòng + Admin + GĐ; CV KTS chỉ tài nguyên.
 * ACTION_ACCESS DAM: DOCUMENT:SUBMIT — CV KTS + Trưởng/Phó PKT (057); Admin không SUBMIT (034).
 * Phản hồi: DOCUMENT_FEEDBACK:CREATE mọi vai trừ KTS & PKT; REVIEW — KTS & PKT (cùng rule 038).
 * 055: Trưởng/Phó bảo trì 6,8; Trưởng/Phó PKT 7,9; ma trận cột 6 = headPtkT (7/9).
 * 056–057: Bảo trì chỉ đọc tài sản/mẫu/lịch (tạo lịch: 2,7,9). PKT = quyền KTS + duyệt DAM; 058: PKT chỉ READ WORK_ORDER.
 */

import {
  PID_TRUONG_PHONG_BAO_TRI,
  PID_TRUONG_PHONG_KT,
  PID_PHO_BAO_TRI,
  PID_PHO_PHONG_KT,
  PIDS_TUYEN_BAO_TRI,
  PIDS_TP_KT_HEAD,
} from '../constants/positionIds.js';

// ── 1. Chuyển user thành role key ────────────────────────────────────────────
export const POSITION_TRUONG_PHONG = PID_TRUONG_PHONG_BAO_TRI;

export function getRoleKey(user) {
  if (!user) return "congNhan";
  const level = user.positionLevel ?? 1;
  if (level >= 5) return "bGD";
  if (level >= 4) return "admin";
  if (level >= 3) {
    const pid = Number(user.positionId);
    if (pid === PID_TRUONG_PHONG_BAO_TRI || pid === PID_PHO_BAO_TRI) return "truongPhong";
    if (pid === PID_TRUONG_PHONG_KT || pid === PID_PHO_PHONG_KT) return "headPtkT";
    return "truongCa";
  }
  if (level >= 2) return "kyThuat";
  return "congNhan";
}

export const ROLE_LABELS = {
  congNhan: "KTV hiện trường",
  kyThuat: "Chuyên viên KTS",
  truongCa: "Trưởng ca bảo trì",
  truongPhong: "Trưởng / Phó phòng Bảo trì",
  headPtkT: "Trưởng / Phó phòng Kỹ thuật - CN",
  admin: "Admin",
  bGD: "Giám đốc",
};

export const ROLE_COLORS = {
  congNhan: "gray",
  kyThuat: "green",
  truongCa: "blue",
  truongPhong: "indigo",
  headPtkT: "teal",
  admin: "red",
  bGD: "purple",
};

/** Level DB cho tầng giám sát (Trưởng ca Position 3, Trưởng phòng Position 6 — cùng Level 3). */
export const LEVEL_TRUONG_CA = 3;

/** Banner Dashboard — Trưởng ca / Trưởng phòng. */
export const TRUONG_CA_SUMMARY = {
  title: "Trưởng ca & Trưởng phòng",
  tagline:
    "Tuyến bảo trì: phê duyệt lịch, phiếu việc, checklist; WO khẩn hai bước. Tài liệu số do phòng Kỹ thuật - CN duyệt.",
  flows: [],
};

// ── 2. Quyền truy cập route (menu visibility) ────────────────────────────────
// Cột: [ congNhan, kyThuat, truongCa, admin, bGD, headPtkT (Trưởng/Phó PKT 7,9) ]
const ROUTE_ACCESS = {
  //                        KTV HT  CV KTC TC  AD  BGD  T/P PKT
  assets:                 [true,  true,  true,  true, true,  true],
  schedules:              [false, true,  true,  true, false, true],
  "work-orders":          [true,  true,  true,  true, false, true],
  checklists:             [true,  true,  true,  true, true,  true],
  "checklist-manage":     [false, true,  true,  false, false, true],
  documents:              [true,  true,  true,  true, true,  true],
  'document-feedback-inbox': [false, true, false, false, false, true],
  workflows:              [false, false, false, true,  false, false],
  'admin-settings':       [false, false, false, true,  false, false],
  approvals:              [false, false, true,  false, false, true],
  employees:              [false, false, true,  true,  false, false],
};

const ROLE_IDX = {
  congNhan: 0,
  kyThuat: 1,
  truongCa: 2,
  truongPhong: 2,
  admin: 3,
  bGD: 4,
  headPtkT: 5,
};

const PIDS_TRUONG_PHO_HAI_PHONG = [
  PID_TRUONG_PHONG_BAO_TRI,
  PID_PHO_BAO_TRI,
  PID_TRUONG_PHONG_KT,
  PID_PHO_PHONG_KT,
];

/**
 * Báo cáo hiệu suất tài sản: Trưởng/Phó bảo trì & PKT (L3), Quản trị (L4+), Ban GĐ.
 * Không gồm CV KTS / Trưởng ca.
 */
export function canAccessPerformanceReport(user) {
  if (!user) return false;
  const lvl = user.positionLevel ?? 0;
  const pid = Number(user.positionId ?? 0);
  if (lvl >= 4) return true;
  return lvl === 3 && PIDS_TRUONG_PHO_HAI_PHONG.includes(pid);
}

/**
 * Báo cáo sử dụng tài nguyên: thêm CV KTS (L2); cùng tuyến lãnh đạo hai phòng + Admin + GĐ.
 */
export function canAccessResourceUsageReport(user) {
  if (!user) return false;
  const lvl = user.positionLevel ?? 0;
  const pid = Number(user.positionId ?? 0);
  if (lvl === 2) return true;
  if (lvl >= 4) return true;
  return lvl === 3 && PIDS_TRUONG_PHO_HAI_PHONG.includes(pid);
}

/**
 * Báo cáo nghiệp vụ checklist: cùng quyền với báo cáo hiệu suất (không gồm CV KTS).
 */
export function canAccessChecklistOperationsReport(user) {
  return canAccessPerformanceReport(user);
}

/** Lối tắt báo cáo (không còn hub /reports): nghiệp vụ → tài nguyên → hiệu suất. */
export function getFirstAllowedReportPath(user) {
  if (!user) return null;
  if (canAccessChecklistOperationsReport(user)) return '/reports/operations';
  if (canAccessResourceUsageReport(user)) return '/reports/resource-usage';
  if (canAccessPerformanceReport(user)) return '/reports/performance';
  return null;
}

export function canAccess(user, routeKey) {
  if (routeKey === 'report-performance') return canAccessPerformanceReport(user);
  if (routeKey === 'report-resource-usage') return canAccessResourceUsageReport(user);
  if (routeKey === 'report-operations') {
    return canAccessChecklistOperationsReport(user);
  }
  const matrix = ROUTE_ACCESS[routeKey];
  if (!matrix) return true; // route không kiểm soát → cho qua
  const idx = ROLE_IDX[getRoleKey(user)];
  return idx !== undefined ? matrix[idx] : false;
}

// ── 3. Quyền hành động (UI) — 6 cột, cột 5 = headPtkT (7/9). APPROVE tuyến tách ở canDo theo positionId.
const ACTION_ACCESS = {
  "ASSET:CREATE":            [false, true,  false, false, false, true],
  "ASSET:UPDATE":            [false, true,  false, false, false, true],
  "ASSET:DELETE":            [false, false, false, false, false, false],
  "RUNTIME_LOG:CREATE":      [true,  false, false, false, false, false],
  "SCHEDULE:CREATE":         [false, true,  false, false, false, true],
  "SCHEDULE:UPDATE":         [false, true,  false, false, false, true],
  "SCHEDULE:SUBMIT":         [false, true,  false, false, false, true],
  "SCHEDULE:APPROVE":        [false, false, true,  false, false, false],
  "SCHEDULE:DELETE":         [false, true,  false, false, false, true],
  "WORK_ORDER:CREATE":       [false, true,  true,  true,  false, false],
  "WORK_ORDER:UPDATE":       [true,  true,  true,  false, false, false],
  "WORK_ORDER:ASSIGN":       [false, false, true,  false, false, false],
  "WORK_ORDER:APPROVE":      [false, false, true,  false, false, false],
  "WORK_ORDER:DELETE":       [false, false, false, false, false, false],
  "DOCUMENT:CREATE":         [false, true,  false, false, false, true],
  "DOCUMENT:SUBMIT":         [false, true,  false, false, false, true],
  "DOCUMENT:UPDATE":         [false, true,  false, false, false, true],
  "DOCUMENT:APPROVE":        [false, false, false, false, false, true],
  "DOCUMENT:DELETE":         [false, false, false, true,  false, true],
  "TAG:CREATE":              [false, true,  false, false, false, true],
  "TAG:UPDATE":              [false, true,  false, false, false, true],
  "TAG:DELETE":              [false, true,  false, false, false, true],
  "DOCUMENT_CATEGORY:READ":  [true,  true,  true,  true,  true,  true],
  "DOCUMENT_CATEGORY:CREATE":[false, true,  false, false, false, true],
  "DOCUMENT_CATEGORY:UPDATE":[false, true,  false, false, false, true],
  "DOCUMENT_CATEGORY:DELETE":[false, true,  false, false, false, true],
  "CHECKLIST_TEMPLATE:CREATE":[false, true,  false, false, false, true],
  "CHECKLIST_TEMPLATE:UPDATE": [false, true,  false, false, false, true],
  "CHECKLIST_TEMPLATE:DELETE": [false, true,  false, false, false, true],
  "CHECKLIST_TEMPLATE:APPROVE": [false, false, false, false, false, false],
  "CHECKLIST_RESULT:CREATE": [false, false, false, false, false, false],
  "EMPLOYEE:CREATE":         [false, false, false, true,  false, false],
  "EMPLOYEE:UPDATE":         [false, false, false, true,  false, false],
  "EMPLOYEE:DELETE":         [false, false, false, true,  false, false],
  "REPORT:EXPORT":         [false, false, false, false, true,  false],
  "MAINTENANCE_GROUP:WRITE": [false, true,  true,  true,  false, true],
  "MAINTENANCE_GROUP:DELETE":[false, false, true,  true,  false, false],
  "WORKFLOW:CREATE":         [false, false, false, true,  false, false],
  "WORKFLOW:UPDATE":         [false, false, false, true,  false, false],
  "WORKFLOW:DELETE":         [false, false, false, true,  false, false],
  "DOCUMENT_FEEDBACK:CREATE": [true,  false, true,  true,  true,  false],
  "DOCUMENT_FEEDBACK:REVIEW": [false, true,  false, false, false, true],
};

function canApproveByPid(pid, list) {
  return list.includes(Number(pid));
}

export function canDo(user, action) {
  const pid = Number(user?.positionId ?? 0);
  if (action === "CHECKLIST_RESULT:CREATE") {
    const k = getRoleKey(user);
    return k === "congNhan" || k === "truongPhong";
  }
  if (action === "CHECKLIST_RESULT:APPROVE" || action === "CHECKLIST_REVIEW:WRITE") {
    return canApproveByPid(pid, PIDS_TUYEN_BAO_TRI);
  }
  if (action === "SCHEDULE:APPROVE" || action === "WORK_ORDER:APPROVE") {
    return canApproveByPid(pid, PIDS_TUYEN_BAO_TRI);
  }
  if (action === "CHECKLIST_TEMPLATE:APPROVE") {
    return false;
  }
  if (action === "DOCUMENT:APPROVE" || action === "DIGITAL_ASSET:APPROVE") {
    return canApproveByPid(pid, PIDS_TP_KT_HEAD) || user?.positionLevel === 4;
  }
  const matrix = ACTION_ACCESS[action];
  if (!matrix) return false;
  const r = getRoleKey(user);
  const idx = ROLE_IDX[r];
  return idx !== undefined && matrix[idx] === true;
}

// ── 4. Dashboard type cho mỗi role ────────────────────────────────────────────
export function getDashboardType(user) {
  const role = getRoleKey(user);
  if (role === "bGD") return "director";
  if (role === "admin") return "admin";
  if (role === "truongCa" || role === "truongPhong" || role === "headPtkT") {
    return "supervisor";
  }
  return "field";
}
