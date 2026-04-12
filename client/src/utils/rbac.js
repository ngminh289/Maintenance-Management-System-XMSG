/**
 * rbac.js — Frontend RBAC theo Positions (DB) + level.
 *
 * Vai trò UI:
 *   1 — congNhan     : Công nhân
 *   2 — kyThuat      : Nhân viên Kỹ thuật (rule/nv_kythuat.rule)
 *   truongCa    : Trưởng ca (PositionID 3; rule/truongca.rule)
 *   truongPhong : Trưởng phòng (PositionID 6, Level 3; duyệt bước 2 WO khẩn — migration 019)
 *   4 — admin        : Quản trị viên
 *   5 — bGD          : Ban Giám đốc
 *
 * Liên quan: Sidebar.jsx, DashboardPage.jsx, App.jsx; migration 019 (tách TC / Trưởng phòng).
 * ACTION_ACCESS DAM: DOCUMENT:SUBMIT chỉ NV KT (BFD 4); migration 034 dọn SUBMIT Admin.
 * Phản hồi tài liệu: DOCUMENT_FEEDBACK:CREATE mọi vai trừ NV KT; DOCUMENT_FEEDBACK:REVIEW chỉ NV KT (038).
 */

// ── 1. Chuyển user thành role key ────────────────────────────────────────────
/** PositionID Trưởng phòng trong DB (migration 019). */
export const POSITION_TRUONG_PHONG = 6;

export function getRoleKey(user) {
  if (!user) return "congNhan";
  const level = user.positionLevel ?? 1;
  if (level >= 5) return "bGD";
  if (level >= 4) return "admin";
  if (level >= 3) {
    return Number(user.positionId) === POSITION_TRUONG_PHONG
      ? "truongPhong"
      : "truongCa";
  }
  if (level >= 2) return "kyThuat";
  return "congNhan";
}

export const ROLE_LABELS = {
  congNhan: "Công nhân",
  kyThuat: "Nhân viên KT",
  truongCa: "Trưởng ca",
  truongPhong: "Trưởng phòng",
  admin: "Admin",
  bGD: "Ban GĐ",
};

export const ROLE_COLORS = {
  congNhan: "gray",
  kyThuat: "green",
  truongCa: "blue",
  truongPhong: "indigo",
  admin: "red",
  bGD: "purple",
};

/** Level DB cho tầng giám sát (Trưởng ca Position 3, Trưởng phòng Position 6 — cùng Level 3). */
export const LEVEL_TRUONG_CA = 3;

/** Banner Dashboard — Trưởng ca / Trưởng phòng. */
export const TRUONG_CA_SUMMARY = {
  title: "Trưởng ca & Trưởng phòng",
  tagline:
    "Phê duyệt lịch, phiếu việc và tài liệu; điều phối WO. WO khẩn: hai bước TC → Trưởng phòng.",
  flows: [],
};

// ── 2. Quyền truy cập route (menu visibility) ────────────────────────────────
// Thứ tự cột: [ congNhan, kyThuat, truongCa, admin, bGD ]
const ROUTE_ACCESS = {
  //              CN      KT     TC     AD     BGD
  assets: [true, true, true, true, true], // tất cả xem tài sản
  schedules: [false, true, true, true, false], // KT + TC + Admin: lập lịch; TC gửi duyệt + duyệt (Approvals)
  "work-orders": [true, true, true, true, false], // Admin tạo WO chờ duyệt (4.1)
  /** QR / xem tài sản: mọi vai (kể cả Admin, Ban GĐ) — nộp checklist tách quyền CHECKLIST_RESULT:CREATE */
  checklists: [true, true, true, true, true],
  /** §5.1 — chỉ NV KT + Trưởng ca/Trưởng phòng quản lý mẫu theo loại */
  "checklist-manage": [false, true, true, false, false],
  /** DAM: CN/KT/TC/Admin/BGD đọc kho; upload/SUBMIT/phiên bản chỉ KT (ACTION_ACCESS). */
  documents: [true, true, true, true, true],
  /** Hàng đợi phản hồi / góp ý tài liệu — chỉ NV KT (xem xét). */
  'document-feedback-inbox': [false, true, false, false, false],
  workflows: [false, false, false, true, false], // mẫu luồng phê duyệt — Admin C/U (4.1)
  approvals: [false, false, true, false, false], // chỉ Trưởng ca xử lý hàng chờ duyệt; Ban GĐ chỉ R (báo cáo)
  reports: [false, true, true, true, true], // báo cáo từ KT trở lên
  employees: [false, false, false, true, false], // nhân sự: admin only
};

/** truongCa và truongPhong dùng chung cột ma trận (Level 3, quyền tương đương trên UI). */
const ROLE_IDX = {
  congNhan: 0,
  kyThuat: 1,
  truongCa: 2,
  truongPhong: 2,
  admin: 3,
  bGD: 4,
};

export function canAccess(user, routeKey) {
  const matrix = ROUTE_ACCESS[routeKey];
  if (!matrix) return true; // route không kiểm soát → cho qua
  const idx = ROLE_IDX[getRoleKey(user)];
  return idx !== undefined ? matrix[idx] : false;
}

// ── 3. Quyền hành động (UI button visibility) ────────────────────────────────
// Thứ tự cột: [ congNhan, kyThuat, truongCa, admin, bGD ]
const ACTION_ACCESS = {
  //                              CN      KT     TC     AD     BGD
  "ASSET:CREATE": [false, false, true, false, false],
  "ASSET:UPDATE": [false, true, true, false, false],
  "ASSET:DELETE": [false, false, true, false, false],
  "RUNTIME_LOG:CREATE": [true, false, false, false, false],
  "SCHEDULE:CREATE": [false, true, true, false, false],
  "SCHEDULE:UPDATE": [false, true, true, false, false],
  /** Gửi lịch vào duyệt: NV KT + Trưởng ca/Trưởng phòng (cùng cột TC) + Admin. */
  "SCHEDULE:SUBMIT": [false, true, true, true, false],
  "SCHEDULE:APPROVE": [false, false, true, false, false],
  /** DB chưa gán DELETE MAINTENANCE_PLAN cho role nào — ẩn nút xóa lịch. */
  "SCHEDULE:DELETE": [false, false, false, false, false],
  "WORK_ORDER:CREATE": [false, true, true, true, false],
  "WORK_ORDER:UPDATE": [true, true, true, false, false],
  /** Phân công WO: service yêu cầu actorLevel >= 3 (Trưởng ca). */
  "WORK_ORDER:ASSIGN": [false, false, true, false, false],
  "WORK_ORDER:APPROVE": [false, false, true, false, false], // TC (3) + Trưởng phòng (6): server kiểm tra đúng bước workflow
  "WORK_ORDER:DELETE": [false, false, false, false, false],
  "DOCUMENT:CREATE": [false, true, false, false, false],
  /** Gửi bản nháp vào phê duyệt — SUBMIT API (BFD 4; chỉ Chuyên viên / NV KT). */
  "DOCUMENT:SUBMIT": [false, true, false, false, false],
  /** Phiên bản mới sau duyệt — UPDATE API (chỉ NV KT; Admin DAM chỉ READ). */
  "DOCUMENT:UPDATE": [false, true, false, false, false],
  "DOCUMENT:APPROVE": [false, false, true, false, false],
  /** Danh mục tag (CRUD): chỉ NV KT (migration 035: DELETE TAG). */
  "TAG:CREATE": [false, true, false, false, false],
  "TAG:UPDATE": [false, true, false, false, false],
  "TAG:DELETE": [false, true, false, false, false],
  /** Phân loại tài liệu DAM — đọc danh mục: mọi role vào trang tài liệu; C/U/D: NV KT. */
  "DOCUMENT_CATEGORY:READ": [true, true, true, true, true],
  "DOCUMENT_CATEGORY:CREATE": [false, true, false, false, false],
  "DOCUMENT_CATEGORY:UPDATE": [false, true, false, false, false],
  "DOCUMENT_CATEGORY:DELETE": [false, true, false, false, false],
  "CHECKLIST_TEMPLATE:CREATE": [false, true, true, false, false],
  "CHECKLIST_TEMPLATE:UPDATE": [false, true, true, false, false],
  /** §5.1 (A) — phê duyệt mẫu trong DB; UI mở rộng luồng sau */
  "CHECKLIST_TEMPLATE:APPROVE": [false, false, true, false, false],
  /** Ma trận không dùng cho CREATE — xử lý trong canDo (chỉ CN + Trưởng phòng). */
  "CHECKLIST_RESULT:CREATE": [false, false, false, false, false],
  "EMPLOYEE:CREATE": [false, false, false, true, false],
  "EMPLOYEE:UPDATE": [false, false, false, true, false],
  "EMPLOYEE:DELETE": [false, false, false, true, false], // PATCH activate/deactivate
  "REPORT:EXPORT": [false, false, false, false, true],
  /** Nhóm bảo trì: routes requireLevel(2) CRUD thành viên, xóa nhóm requireLevel(3). */
  "MAINTENANCE_GROUP:WRITE": [false, true, true, true, false],
  "MAINTENANCE_GROUP:DELETE": [false, false, true, true, false],
  /** Cấu hình mẫu WorkflowTemplates (Admin — 4.1 C/U). */
  "WORKFLOW:CREATE": [false, false, false, true, false],
  "WORKFLOW:UPDATE": [false, false, false, true, false],
  "WORKFLOW:DELETE": [false, false, false, true, false],
  /** Góp ý tài liệu: CN/TC/TP/Admin/BGD gửi; NV KT không gửi (server chặn CREATE). */
  "DOCUMENT_FEEDBACK:CREATE": [true, false, true, true, true],
  /** NV KT cập nhật trạng thái / ghi chú xử lý. */
  "DOCUMENT_FEEDBACK:REVIEW": [false, true, false, false, false],
};

export function canDo(user, action) {
  /** Nộp checklist quét QR: chỉ Công nhân + Trưởng phòng (Trưởng ca / NV KT / Admin / BGD chỉ xem). */
  if (action === "CHECKLIST_RESULT:CREATE") {
    const k = getRoleKey(user);
    return k === "congNhan" || k === "truongPhong";
  }
  /** Tiếp nhận kết quả: Trưởng ca hoặc Trưởng phòng */
  if (action === "CHECKLIST_RESULT:APPROVE") {
    const k = getRoleKey(user);
    return k === "truongCa" || k === "truongPhong";
  }
  const matrix = ACTION_ACCESS[action];
  if (!matrix) return false;
  const idx = ROLE_IDX[getRoleKey(user)];
  return idx !== undefined ? matrix[idx] : false;
}

// ── 4. Dashboard type cho mỗi role ────────────────────────────────────────────
export function getDashboardType(user) {
  const role = getRoleKey(user);
  if (role === "bGD") return "director"; // báo cáo tổng thể, KPI
  if (role === "admin") return "admin"; // quản lý hệ thống, user
  if (role === "truongCa" || role === "truongPhong") return "supervisor";
  return "field"; // KT/CN: WO của mình, QR nhanh
}
