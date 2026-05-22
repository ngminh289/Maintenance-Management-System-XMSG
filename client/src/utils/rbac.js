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
 * Báo cáo: operations + hiệu suất — TP/Phó hai phòng + Admin + GĐ (không CV KTS).
 * CV KTS (L2): chỉ /reports/resource-usage (sử dụng tài nguyên).
 * ACTION_ACCESS DAM: DOCUMENT:SUBMIT — CV KTS + Trưởng/Phó PKT (057); Admin không SUBMIT (034).
 * Phản hồi: DOCUMENT_FEEDBACK:CREATE mọi vai trừ KTS & PKT; REVIEW — KTS & PKT (cùng rule 038).
 * 055: Trưởng/Phó bảo trì 6,8; Trưởng/Phó PKT 7,9; ma trận cột 6 = headPtkT (7/9).
 * 056–057: Bảo trì chỉ đọc tài sản/mẫu/lịch (tạo lịch: 2,7,9). PKT = quyền KTS + duyệt DAM; 058: PKT chỉ READ WORK_ORDER.
 * WORK_ORDER:VIEW_ARCHIVED / RESTORE: xử lý trước canDoByDbPermission — không có trong DB nên tránh false sớm (Admin mất tab Lưu trữ).
 */

import {
  PID_TRUONG_PHONG_BAO_TRI,
  PID_TRUONG_PHONG_KT,
  PID_PHO_BAO_TRI,
  PID_PHO_PHONG_KT,
  PIDS_TUYEN_BAO_TRI,
  PIDS_TP_KT_HEAD,
} from '../constants/positionIds.js';

const PIDS_PKT_HEAD_UI = [PID_TRUONG_PHONG_KT, PID_PHO_PHONG_KT];

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
  truongPhong: "Lãnh đạo phòng Bảo trì",
  headPtkT: "Lãnh đạo phòng Kỹ thuật - CN",
  admin: "Admin",
  bGD: "Giám đốc",
};

/**
 * Nhãn chức vụ hiển thị người dùng cuối: Trưởng và Phó tách riêng theo PositionID.
 */
export function getRoleLabel(user) {
  if (!user) return "—";
  const pid = Number(user.positionId ?? 0);
  if (pid === PID_TRUONG_PHONG_BAO_TRI) return "Trưởng phòng Bảo trì";
  if (pid === PID_PHO_BAO_TRI) return "Phó phòng Bảo trì";
  if (pid === PID_TRUONG_PHONG_KT) return "Trưởng phòng Kỹ thuật - CN";
  if (pid === PID_PHO_PHONG_KT) return "Phó phòng Kỹ thuật - CN";
  const pn = String(user.positionName ?? "").trim();
  const ambiguousPn = /trưởng\s*\/\s*phó/i.test(pn);
  if (pn && !ambiguousPn) return pn;
  if (ambiguousPn) {
    const rk = getRoleKey(user);
    return ROLE_LABELS[rk] ?? "—";
  }
  const rk = getRoleKey(user);
  return ROLE_LABELS[rk] ?? rk;
}

/**
 * Badge gọn trong sidebar (một dòng, không gộp Trưởng/Phó).
 * @returns {{ label: string, color: string } | null}
 */
export function getSidebarRoleBadge(user) {
  if (!user) return null;
  const rk = getRoleKey(user);
  const pid = Number(user.positionId ?? 0);
  const base = {
    admin: { label: "Admin", color: "bg-red-500" },
    bGD: { label: "GĐ", color: "bg-purple-500" },
    truongCa: { label: "Trưởng ca", color: "bg-blue-500" },
    kyThuat: { label: "CV KTS", color: "bg-teal-500" },
    congNhan: { label: "KTV HT", color: "bg-gray-500" },
  };
  if (rk === "truongPhong") {
    if (pid === PID_TRUONG_PHONG_BAO_TRI) return { label: "TP Bảo trì", color: "bg-indigo-500" };
    if (pid === PID_PHO_BAO_TRI) return { label: "Phó BT", color: "bg-indigo-500" };
    return { label: "BT", color: "bg-indigo-500" };
  }
  if (rk === "headPtkT") {
    if (pid === PID_TRUONG_PHONG_KT) return { label: "TP KT-CN", color: "bg-teal-600" };
    if (pid === PID_PHO_PHONG_KT) return { label: "Phó KT-CN", color: "bg-teal-600" };
    return { label: "PKT", color: "bg-teal-600" };
  }
  return base[rk] ?? { label: "—", color: "bg-gray-500" };
}

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
  "checklist-manage":     [true,  true,  true,  true,  true,  true],
  documents:              [true,  true,  true,  true, true,  true],
  /** KTS + T/P PKT: menu dùng ma trận; nếu API trả permissions thì READ hoặc REVIEW đều mở (xử lý canAccess). */
  'document-feedback-inbox': [false, true, false, true,  false, true],
  workflows:              [false, false, false, true,  false, false],
  'admin-settings':       [false, false, false, true,  false, false],
  approvals:              [false, false, true,  true,  false, true],
  employees:              [false, true,  true,  true,  false, false],
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

const ACTION_RESOURCE_MAP = {
  ASSET: "ASSET",
  WORK_ORDER: "WORK_ORDER",
  DOCUMENT: "DIGITAL_ASSET",
  DIGITAL_ASSET: "DIGITAL_ASSET",
  SCHEDULE: "MAINTENANCE_PLAN",
  MAINTENANCE_PLAN: "MAINTENANCE_PLAN",
  CHECKLIST_TEMPLATE: "CHECKLIST_TEMPLATE",
  CHECKLIST_RESULT: "CHECKLIST_RESULT",
  RUNTIME_LOG: "RUNTIME_LOG",
  EMPLOYEE: "EMPLOYEE",
  TAG: "TAG",
  WORKFLOW: "WORKFLOW",
  REPORT: "REPORT",
  DOCUMENT_CATEGORY: "DOCUMENT_CATEGORY",
  DOCUMENT_FEEDBACK: "DOCUMENT_FEEDBACK",
};

const ROUTE_PERMISSION_MAP = {
  assets: { resourceType: "ASSET", permissionName: "READ" },
  schedules: { resourceType: "MAINTENANCE_PLAN", permissionName: "READ" },
  "work-orders": { resourceType: "WORK_ORDER", permissionName: "READ" },
  checklists: { resourceType: "CHECKLIST_RESULT", permissionName: "READ" },
  "checklist-manage": { resourceType: "CHECKLIST_TEMPLATE", permissionName: "READ" },
  documents: { resourceType: "DIGITAL_ASSET", permissionName: "READ" },
  employees: { resourceType: "EMPLOYEE", permissionName: "READ" },
};

function getPermissionSet(user) {
  const list = Array.isArray(user?.permissions) ? user.permissions : null;
  if (!list) return null;
  return new Set(
    list.map((p) =>
      `${String(p.resourceType || "").toUpperCase()}:${String(p.permissionName || "").toUpperCase()}`,
    ),
  );
}

function hasPermissionBySet(permissionSet, resourceType, permissionName) {
  if (!permissionSet) return null;
  const key = `${String(resourceType || "").toUpperCase()}:${String(permissionName || "").toUpperCase()}`;
  return permissionSet.has(key);
}

function canDoByDbPermission(user, action) {
  const permissionSet = getPermissionSet(user);
  if (!permissionSet || typeof action !== "string") return null;
  const [resourceKey, permissionName] = action.split(":");
  if (!resourceKey || !permissionName) return null;
  const resourceType = ACTION_RESOURCE_MAP[String(resourceKey).toUpperCase()];
  if (!resourceType) return null;
  return hasPermissionBySet(permissionSet, resourceType, permissionName);
}

/**
 * Báo cáo hiệu suất tài sản: Trưởng/Phó hai phòng (L3), Quản trị (L4+), Ban GĐ — không CV KTS.
 * Theo yêu cầu nghiệp vụ: ai xem được báo cáo này thì cũng được quyền xuất.
 */
export function canAccessPerformanceReport(user) {
  if (!user) return false;
  if (getRoleKey(user) === 'kyThuat') return false;
  const lvl = user.positionLevel ?? 0;
  const pid = Number(user.positionId ?? 0);
  if (lvl >= 4) return true;
  return lvl === 3 && PIDS_TRUONG_PHO_HAI_PHONG.includes(pid);
}

/** Báo cáo sử dụng tài nguyên: CV KTS (L2) + tuyến lãnh đạo hai phòng (L3) + Admin + GĐ. */
export function canAccessResourceUsageReport(user) {
  if (!user) return false;
  const lvl = user.positionLevel ?? 0;
  const pid = Number(user.positionId ?? 0);
  if (getRoleKey(user) === 'kyThuat') return true;
  if (lvl >= 4) return true;
  return lvl === 3 && PIDS_TRUONG_PHO_HAI_PHONG.includes(pid);
}

/** Báo cáo nghiệp vụ checklist: chỉ tuyến lãnh đạo hai phòng + Admin + GĐ. */
export function canAccessChecklistOperationsReport(user) {
  if (!user) return false;
  const lvl = user.positionLevel ?? 0;
  const pid = Number(user.positionId ?? 0);
  if (lvl >= 4) return true;
  return lvl === 3 && PIDS_TRUONG_PHO_HAI_PHONG.includes(pid);
}

/** Lối tắt báo cáo (không còn hub /reports): nghiệp vụ → tài nguyên → hiệu suất. */
export function getFirstAllowedReportPath(user) {
  if (!user) return null;
  if (canAccessChecklistOperationsReport(user)) return '/reports/operations';
  if (canAccessResourceUsageReport(user)) return '/reports/resource-usage';
  if (canAccessPerformanceReport(user)) return '/reports/performance';
  return null;
}

/** Quản trị (L4+): xem toàn bộ mục sidebar — không phụ thuộc ma trận từng route. */
export function isAdminUser(user) {
  if (!user) return false;
  return getRoleKey(user) === 'admin' || Number(user.positionLevel ?? 0) >= 4;
}

/** Tab Phê duyệt: Admin xem hàng chờ toàn hệ thống, không duyệt/từ chối (không có trong WorkflowSteps). */
export function isApprovalViewOnly(user) {
  return isAdminUser(user);
}

export function canAccess(user, routeKey) {
  if (!user) return false;
  if (isAdminUser(user) && routeKey) return true;

  const permissionSet = getPermissionSet(user);
  /** Hàng đợi phản hồi: DB có thể chỉ gán READ cho KTS; REVIEW vẫn dùng khi xử lý API. */
  if (routeKey === 'document-feedback-inbox' && permissionSet) {
    const rev = hasPermissionBySet(permissionSet, 'DOCUMENT_FEEDBACK', 'REVIEW');
    const read = hasPermissionBySet(permissionSet, 'DOCUMENT_FEEDBACK', 'READ');
    if (rev === true || read === true) return true;
  }
  if (routeKey === "checklist-review") {
    if (!permissionSet) {
      return Number(user?.positionId ?? 0) === 3;
    }
    const canApprove = hasPermissionBySet(permissionSet, "CHECKLIST_RESULT", "APPROVE");
    const canUpdate = hasPermissionBySet(permissionSet, "CHECKLIST_RESULT", "UPDATE");
    if (canApprove === true || canUpdate === true) return true;
    if (canApprove === false && canUpdate === false) return false;
    return Number(user?.positionId ?? 0) === 3;
  }
  if (routeKey === 'report-performance') return canAccessPerformanceReport(user);
  if (routeKey === 'report-resource-usage') return canAccessResourceUsageReport(user);
  if (routeKey === 'report-operations') {
    return canAccessChecklistOperationsReport(user);
  }
  const routePermission = ROUTE_PERMISSION_MAP[routeKey];
  if (routePermission && permissionSet) {
    return hasPermissionBySet(
      permissionSet,
      routePermission.resourceType,
      routePermission.permissionName,
    );
  }
  const matrix = ROUTE_ACCESS[routeKey];
  if (!matrix) return true; // route không kiểm soát → cho qua
  const idx = ROLE_IDX[getRoleKey(user)];
  return idx !== undefined ? matrix[idx] : false;
}

// ── 3. Quyền hành động (UI) — 6 cột, cột 5 = headPtkT (7/9). APPROVE tuyến tách ở canDo theo positionId.
// ASSET:* — phân biệt rõ TC (chỉ xem) vs TP (đủ quyền) qua xử lý đặc biệt trong canDo (matrix
// dùng chung index 2 cho truongCa/truongPhong). Yêu cầu nghiệp vụ:
//   QTV/Trưởng phòng: đủ quyền | CV KTS: xem + sửa | TC, KTV HT, BGD: chỉ xem.
const ACTION_ACCESS = {
  "ASSET:CREATE":            [false, false, false, true,  false, true],
  "ASSET:UPDATE":            [false, true,  false, true,  false, true],
  "ASSET:DELETE":            [false, false, false, true,  false, true],
  "RUNTIME_LOG:CREATE":      [true,  false, false, false, false, false],
  "SCHEDULE:CREATE":         [false, true,  false, false, false, true],
  "SCHEDULE:UPDATE":         [false, true,  false, false, false, true],
  "SCHEDULE:SUBMIT":         [false, true,  false, false, false, true],
  "SCHEDULE:APPROVE":        [false, false, true,  false, false, false],
  "SCHEDULE:DELETE":         [false, true,  false, false, false, true],
  "WORK_ORDER:CREATE":       [false, true,  true,  true,  false, false],
  "WORK_ORDER:UPDATE":       [true,  true,  true,  true,  false, true],
  "WORK_ORDER:ASSIGN":       [false, false, true,  false, false, false],
  "WORK_ORDER:APPROVE":      [false, false, true,  false, false, false],
  "WORK_ORDER:DELETE":       [false, false, false, true,  false, true],
  /** Tab "Đã lưu trữ" + nút khôi phục: chỉ Quản trị viên (positionId = 4). */
  "WORK_ORDER:RESTORE":      [false, false, false, true,  false, false],
  "WORK_ORDER:VIEW_ARCHIVED":[false, false, false, true,  false, false],
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
  "CHECKLIST_TEMPLATE:READ":   [true,  true,  true,  true,  true,  true],
  "CHECKLIST_TEMPLATE:CREATE": [false, true,  false, false, false, true],
  "CHECKLIST_TEMPLATE:UPDATE": [false, true,  false, false, false, true],
  "CHECKLIST_TEMPLATE:DELETE": [false, true,  false, false, false, true],
  "CHECKLIST_TEMPLATE:APPROVE": [false, false, false, false, false, false],
  "CHECKLIST_RESULT:CREATE": [false, false, false, false, false, false],
  "EMPLOYEE:CREATE":         [false, true,  false, true,  false, false],
  "EMPLOYEE:UPDATE":         [false, true,  false, true,  false, false],
  "EMPLOYEE:DELETE":         [false, true,  false, true,  false, false],
  "REPORT:EXPORT":         [false, false, false, false, true,  false],
  "MAINTENANCE_GROUP:WRITE": [false, true,  true,  true,  false, true],
  "MAINTENANCE_GROUP:DELETE":[false, false, true,  true,  false, false],
  "WORKFLOW:CREATE":         [false, false, false, true,  false, false],
  "WORKFLOW:UPDATE":         [false, false, false, true,  false, false],
  "WORKFLOW:DELETE":         [false, false, false, true,  false, false],
  "DOCUMENT_FEEDBACK:CREATE": [true,  false, true,  true,  true,  false],
  /** Inbox xử lý: khớp Roles_Permissions UPDATE (server không dùng tên REVIEW). */
  "DOCUMENT_FEEDBACK:REVIEW": [false, true,  false, false, false, true],
  "DOCUMENT_FEEDBACK:UPDATE": [false, true,  false, false, false, true],
};

function canApproveByPid(pid, list) {
  return list.includes(Number(pid));
}

/**
 * Phân công WO (UI): DB chỉ có WORK_ORDER READ/CREATE/UPDATE/DELETE/APPROVE — không có ASSIGN.
 * API dùng UPDATE + actorLevel >= 3 (workOrderFieldAssign.service.js).
 */
/**
 * Upload phiên bản mới (DAM): ai có DOCUMENT:UPDATE (CV KTS, PKT, Admin).
 * Không giới hạn người tạo (uploadedBy).
 */
export function canAddDocumentVersion(user, doc) {
  if (!user || !doc) return false;
  if (!canDo(user, "DOCUMENT:UPDATE")) return false;
  if (doc.status === "PENDING" || doc.status === "ARCHIVED") return false;
  return true;
}

export function canAssignWorkOrder(user) {
  if (!user) return false;
  const role = getRoleKey(user);
  if (role === "truongCa" || role === "truongPhong" || role === "headPtkT") return true;
  if (role === "admin") {
    const byDb = canDoByDbPermission(user, "WORK_ORDER:UPDATE");
    if (byDb !== null) return byDb;
    return true;
  }
  return false;
}

export function canDo(user, action) {
  // Tab "Đã lưu trữ" / Khôi phục: không có trong bảng Roles_Permissions — nếu để
  // canDoByDbPermission chạy trước thì Set.has → false và thoát sớm, Admin cũng không thấy tab.
  if (action === "WORK_ORDER:RESTORE" || action === "WORK_ORDER:VIEW_ARCHIVED") {
    return getRoleKey(user) === "admin" || Number(user?.positionId) === 4;
  }
  // ASSIGN không có trong Roles_Permissions — tránh canDoByDb → false khi user có permissions[].
  if (action === "WORK_ORDER:ASSIGN") {
    return canAssignWorkOrder(user);
  }

  const canByDb = canDoByDbPermission(user, action);
  if (canByDb !== null) {
    return canByDb;
  }
  const pid = Number(user?.positionId ?? 0);
  // ASSET:* — phân biệt Trưởng phòng (đủ quyền) với Trưởng ca (chỉ xem) khi DB
  // không trả permissions. Áp đúng bảng nghiệp vụ:
  //   admin, truongPhong, headPtkT: đủ quyền (CREATE + UPDATE + DELETE).
  //   kyThuat: xem + sửa (chỉ UPDATE).
  //   truongCa, congNhan, bGD: chỉ xem.
  if (action === "ASSET:CREATE" || action === "ASSET:UPDATE" || action === "ASSET:DELETE") {
    const role = getRoleKey(user);
    if (role === "admin" || role === "truongPhong" || role === "headPtkT") return true;
    if (role === "kyThuat") return action === "ASSET:UPDATE";
    return false;
  }
  // SCHEDULE:* — bảng nghiệp vụ Lịch bảo trì (Xem/Sửa/Xoá):
  //   admin, truongPhong (BT), headPtkT (PKT): đủ CRUD + SUBMIT + DELETE.
  //   kyThuat: CRUD + SUBMIT (BE chặn theo status DRAFT/REJECTED).
  //   truongCa: chỉ UPDATE — UI sẽ ẩn nút Sửa nếu lịch chưa qua phê duyệt.
  //   congNhan, bGD: chỉ xem.
  if (
    action === "SCHEDULE:CREATE" ||
    action === "SCHEDULE:UPDATE" ||
    action === "SCHEDULE:SUBMIT" ||
    action === "SCHEDULE:DELETE"
  ) {
    const role = getRoleKey(user);
    if (role === "admin" || role === "truongPhong" || role === "headPtkT") return true;
    if (role === "kyThuat") return true;
    if (role === "truongCa") return action === "SCHEDULE:UPDATE";
    return false;
  }
  // WORK_ORDER:UPDATE — KTV HT cần UPDATE để chuyển trạng thái nhận việc/hoàn thành;
  // CV KTS được sửa pre-approval, Trưởng ca được sửa post-approval (BE xác thực status).
  if (action === "WORK_ORDER:UPDATE") {
    const role = getRoleKey(user);
    if (role === "admin" || role === "truongPhong" || role === "headPtkT") return true;
    if (role === "kyThuat" || role === "truongCa" || role === "congNhan") return true;
    return false;
  }
  // WORK_ORDER:DELETE — TC + KTS không có quyền (theo xác nhận user). Chỉ Admin / TP.
  if (action === "WORK_ORDER:DELETE") {
    const role = getRoleKey(user);
    return role === "admin" || role === "truongPhong" || role === "headPtkT";
  }
  if (action === "CHECKLIST_RESULT:CREATE") {
    const k = getRoleKey(user);
    return k === "congNhan" || k === "truongCa" || k === "truongPhong";
  }
  if (action === "CHECKLIST_RESULT:APPROVE" || action === "CHECKLIST_REVIEW:WRITE") {
    const byDb = canDoByDbPermission(user, "CHECKLIST_RESULT:APPROVE");
    if (byDb === true) return true;
    const byUpdate = canDoByDbPermission(user, "CHECKLIST_RESULT:UPDATE");
    if (byUpdate === true) return true;
    if (byDb === false && byUpdate === false) return false;
    return pid === 3;
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

// ── WO row helpers ───────────────────────────────────────────────────────────
// Tách logic "có cho hiện nút Sửa/Xoá ở List/Detail không?" để FE không gọi API
// bị 403 — backend vẫn là nguồn xác thực cuối cùng (workOrder.service.js).
const WO_EDITABLE_STATUSES = new Set(["PENDING_APPROVAL", "WAITING"]);
const WO_DELETABLE_STATUSES = new Set([
  "PENDING_APPROVAL",
  "WAITING",
  "COMPLETED",
  "CANCELLED",
]);

/** Có hiển thị icon Sửa cho phiếu này không (dựa trên role + status hiện tại). */
export function canEditWorkOrderRow(user, wo) {
  if (!user || !wo) return false;
  if (Number(wo.isDeleted) === 1) return false;
  if (!WO_EDITABLE_STATUSES.has(wo.status)) return false;
  const role = getRoleKey(user);
  if (role === "admin" || role === "truongPhong" || role === "headPtkT") return true;
  if (role === "kyThuat") return wo.status === "PENDING_APPROVAL";
  if (role === "truongCa") return wo.status === "WAITING";
  return false;
}

/** Có hiển thị icon Xoá cho phiếu này không (TC + KTS đã loại theo yêu cầu user). */
export function canDeleteWorkOrderRow(user, wo) {
  if (!user || !wo) return false;
  if (Number(wo.isDeleted) === 1) return false;
  if (!WO_DELETABLE_STATUSES.has(wo.status)) return false;
  return canDo(user, "WORK_ORDER:DELETE");
}

/** Có quyền truy cập tab "Đã lưu trữ" + khôi phục (chỉ Admin). */
export function canViewArchivedWorkOrders(user) {
  return canDo(user, "WORK_ORDER:VIEW_ARCHIVED");
}
export function canRestoreWorkOrder(user) {
  return canDo(user, "WORK_ORDER:RESTORE");
}

// ── Digital Asset (Tài liệu số) row helpers ─────────────────────────────────
// Lưu trữ (072): chỉ khi đã APPROVED — Admin/PKT.
// Xoá vĩnh viễn DB: chỉ bản nháp DRAFT — CV KTS có quyền hoặc Admin/PKT.
const DA_EDITABLE_STATUSES = new Set(["DRAFT", "REJECTED", "APPROVED"]);

function isDaFullAccess(role) {
  return role === "admin" || role === "headPtkT";
}

/** Có hiển thị nút Sửa cho tài liệu này không (role + status). */
export function canEditDigitalAssetRow(user, doc) {
  if (!user || !doc) return false;
  const status = String(doc.status || "").toUpperCase();
  if (!DA_EDITABLE_STATUSES.has(status)) return false;
  const role = getRoleKey(user);
  if (isDaFullAccess(role)) return true;
  if (role === "kyThuat") {
    return status === "DRAFT" || status === "REJECTED";
  }
  return false;
}

/** Có hiển thị nút "Lưu trữ" — chỉ tài liệu đã duyệt; chỉ Admin/PKT. */
export function canArchiveDigitalAssetRow(user, doc) {
  if (!user || !doc) return false;
  const status = String(doc.status || "").toUpperCase();
  if (status !== "APPROVED") return false;
  const role = getRoleKey(user);
  return isDaFullAccess(role);
}

/** Xoá vĩnh viễn khỏi DB — chỉ DRAFT; chủ KTS hoặc Admin/PKT (BE kiểm chủ). */
export function canHardDeleteDraftDigitalAssetRow(user, doc) {
  if (!user || !doc) return false;
  if (String(doc.status || "").toUpperCase() !== "DRAFT") return false;
  const role = getRoleKey(user);
  if (isDaFullAccess(role)) return true;
  return role === "kyThuat";
}

/** Tab "Đã lưu trữ" của Tài liệu số: Admin + Trưởng/Phó PKT. */
export function canViewArchivedDocuments(user) {
  if (!user) return false;
  const role = getRoleKey(user);
  return role === "admin" || role === "headPtkT";
}

/** Khôi phục tài liệu / phiên bản đã lưu trữ. */
export function canRestoreDocument(user) {
  return canViewArchivedDocuments(user);
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
