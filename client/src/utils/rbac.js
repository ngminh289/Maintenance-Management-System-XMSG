/**
 * rbac.js — Frontend RBAC: 5 vai trò theo thiết kế BFD/DFD đề tài KLTN.
 *
 * Vai trò (theo Level trong DB):
 *   1 — congNhan     : Công nhân           (hiện trường: QR, checklist, log giờ)
 *   2 — kyThuat      : Nhân viên Kỹ thuật  (soạn thảo, quản lý kỹ thuật)
 *   3 — truongCa     : Trưởng ca/phòng     (giám sát, phê duyệt, điều phối)
 *   4 — admin        : Quản trị viên       (cấu hình, RBAC, nhân sự)
 *   5 — bGD          : Ban Giám đốc        (đọc báo cáo, phê duyệt cấp cao)
 *
 * Liên quan: Sidebar.jsx, DashboardPage.jsx, App.jsx, ProtectedRoute.jsx.
 */

// ── 1. Chuyển user thành role key ────────────────────────────────────────────
export function getRoleKey(user) {
  if (!user) return 'congNhan';
  const level = user.positionLevel ?? 1;
  if (level >= 5) return 'bGD';
  if (level >= 4) return 'admin';
  if (level >= 3) return 'truongCa';
  if (level >= 2) return 'kyThuat';
  return 'congNhan';
}

export const ROLE_LABELS = {
  congNhan: 'Công nhân',
  kyThuat:  'Nhân viên KT',
  truongCa: 'Trưởng ca',
  admin:    'Admin',
  bGD:      'Ban GĐ',
};

export const ROLE_COLORS = {
  congNhan: 'gray',
  kyThuat:  'green',
  truongCa: 'blue',
  admin:    'red',
  bGD:      'purple',
};

// ── 2. Quyền truy cập route (menu visibility) ────────────────────────────────
// Thứ tự cột: [ congNhan, kyThuat, truongCa, admin, bGD ]
const ROUTE_ACCESS = {
  //              CN      KT     TC     AD     BGD
  'assets':     [true,   true,  true,  true,  true ],  // tất cả xem tài sản
  'schedules':  [false,  true,  true,  false, false],  // KT/TC lập & duyệt lịch
  'work-orders':[true,   true,  true,  false, false],  // CN/KT/TC xử lý WO
  'checklists': [true,   true,  true,  false, false],  // hiện trường + giám sát
  'documents':  [true,   true,  true,  false, false],  // kho tài liệu
  'approvals':  [false,  true,  true,  false, false],  // duyệt: KT submit, TC approve
  'reports':    [false,  true,  true,  true,  true ],  // báo cáo từ KT trở lên
  'employees':  [false,  false, false, true,  false],  // nhân sự: admin only
};

const ROLE_IDX = { congNhan: 0, kyThuat: 1, truongCa: 2, admin: 3, bGD: 4 };

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
  'ASSET:CREATE':               [false,  false, true,  false, false],
  'ASSET:DELETE':               [false,  false, true,  false, false],
  'SCHEDULE:CREATE':            [false,  true,  true,  false, false],
  'SCHEDULE:SUBMIT':            [false,  true,  false, false, false], // KT submit duyệt
  'SCHEDULE:APPROVE':           [false,  false, true,  false, false],
  'WORK_ORDER:CREATE':          [false,  true,  true,  false, false],
  'WORK_ORDER:APPROVE':         [false,  true,  true,  false, true ],
  'WORK_ORDER:DELETE':          [false,  false, false, false, true ],
  'DOCUMENT:CREATE':            [false,  true,  false, false, false],
  'DOCUMENT:APPROVE':           [false,  false, true,  false, false],
  'CHECKLIST_TEMPLATE:CREATE':  [false,  true,  true,  false, false],
  'CHECKLIST_RESULT:CREATE':    [true,   false, true,  false, false], // CN nộp checklist
  'EMPLOYEE:CREATE':            [false,  false, false, true,  false],
  'REPORT:EXPORT':              [false,  false, false, false, true ],
};

export function canDo(user, action) {
  const matrix = ACTION_ACCESS[action];
  if (!matrix) return false;
  const idx = ROLE_IDX[getRoleKey(user)];
  return idx !== undefined ? matrix[idx] : false;
}

// ── 4. Dashboard type cho mỗi role ────────────────────────────────────────────
export function getDashboardType(user) {
  const role = getRoleKey(user);
  if (role === 'bGD')      return 'director';    // báo cáo tổng thể, KPI
  if (role === 'admin')    return 'admin';        // quản lý hệ thống, user
  if (role === 'truongCa') return 'supervisor';   // WO đang xử lý, checklist hôm nay
  return 'field';                                  // KT/CN: WO của mình, QR nhanh
}
