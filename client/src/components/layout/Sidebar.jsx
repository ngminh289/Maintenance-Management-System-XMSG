/**
 * Sidebar.jsx — Dark sidebar, lọc menu theo role người dùng.
 * Dùng canAccess() từ utils/rbac.js để chỉ hiện item có quyền.
 * Danh sách checklist: /checklists/history (mọi role có route checklists).
 * /documents cần end:true — nếu không /documents/feedback-inbox làm cả hai NavLink active (đúp xanh).
 */
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Cpu, ClipboardList, Wrench, FileText,
  CheckSquare, ClipboardCheck, Layers, Users, ShieldCheck, ChevronRight,
  ListChecks,
  Factory, BarChart2, GitBranch, MessageSquare, Settings,
} from 'lucide-react';
import { useAuth }     from '../../contexts/AuthContext.jsx';
import { canAccess, canDo, getRoleKey } from '../../utils/rbac.js';

// roleKey → badge label hiển thị cạnh tên (TC / Trưởng phòng tách PositionID — rbac.js)
const ROLE_BADGE = {
  admin:       { label: 'Admin',         color: 'bg-red-500' },
  bGD:         { label: 'GĐ',            color: 'bg-purple-500' },
  truongCa:    { label: 'Trưởng ca',     color: 'bg-blue-500' },
  truongPhong: { label: 'Trưởng phòng', color: 'bg-indigo-500' },
  kyThuat:     { label: 'CV KTS',        color: 'bg-teal-500' },
  congNhan:    { label: 'KTV HT',        color: 'bg-gray-500' },
};

// Định nghĩa menu — routeKey phải khớp với key trong ROUTE_ACCESS (rbac.js)
const MENU_GROUPS = [
  {
    label: 'Tổng quan',
    items: [
      { to: '/', routeKey: null, icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Vận hành',
    items: [
      { to: '/assets',      routeKey: 'assets',      icon: Cpu,           label: 'Tài sản thiết bị' },
      { to: '/schedules',   routeKey: 'schedules',   icon: ClipboardList, label: 'Lịch bảo trì' },
      { to: '/work-orders', routeKey: 'work-orders', icon: Wrench,        label: 'Phiếu việc' },
      { to: '/checklists',  routeKey: 'checklists',  icon: CheckSquare,   label: 'Checklist / QR', end: true },
      { to: '/checklists/history', routeKey: 'checklists', icon: ListChecks, label: 'Danh sách checklist' },
      { to: '/checklists/review', routeKey: 'checklists', icon: ClipboardCheck, label: 'Tiếp nhận checklist', action: 'CHECKLIST_RESULT:APPROVE' },
      { to: '/checklists/templates', routeKey: 'checklist-manage', icon: Layers, label: 'Mẫu checklist (theo loại)' },
    ],
  },
  {
    label: 'Tài liệu & Phê duyệt',
    items: [
      { to: '/documents',   routeKey: 'documents',   icon: FileText,    label: 'Kho tài liệu số', end: true },
      { to: '/documents/feedback-inbox', routeKey: 'document-feedback-inbox', icon: MessageSquare, label: 'Phản hồi tài liệu (KT)' },
      { to: '/approvals',   routeKey: 'approvals',   icon: ShieldCheck, label: 'Phê duyệt' },
    ],
  },
  {
    label: 'Báo cáo',
    items: [
      { to: '/reports',     routeKey: 'reports',     icon: BarChart2,   label: 'Thống kê & Báo cáo' },
    ],
  },
  {
    label: 'Quản trị',
    items: [
      { to: '/employees',   routeKey: 'employees',      icon: Users,      label: 'Nhân sự' },
      { to: '/workflows',   routeKey: 'workflows',      icon: GitBranch,  label: 'Luồng phê duyệt' },
      { to: '/admin',       routeKey: 'admin-settings', icon: Settings,   label: 'Cấu hình hệ thống' },
    ],
  },
];

function NavItem({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to} end={end === true || to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
        ${isActive
          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
          : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`
      }
    >
      <Icon size={17} />
      <span>{label}</span>
    </NavLink>
  );
}

export function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const roleKey  = getRoleKey(user);
  const badge    = roleKey ? ROLE_BADGE[roleKey] : null;

  // Lọc menu: chỉ giữ group có ít nhất 1 item user được xem
  const visibleGroups = MENU_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (item.routeKey !== null && !canAccess(user, item.routeKey)) return false;
      if (item.action && !canDo(user, item.action)) return false;
      return true;
    }),
  })).filter(g => g.items.length > 0);

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={onClose} />}

      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-slate-900 z-30 flex flex-col
        transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700/60">
          <div className="p-2 bg-blue-500 rounded-xl shadow-lg shadow-blue-500/40">
            <Factory size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">Sông Gianh</p>
            <p className="text-xs text-slate-400">Quản lý bảo trì</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ routeKey: _rk, action: _ac, ...item }) => (
                  <NavItem key={item.to} {...item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User info */}
        {user && (
          <div className="px-3 py-4 border-t border-slate-700/60">
            <NavLink
              to="/profile"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-700 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                {user.fullName?.[0] ?? 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{user.fullName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {badge && (
                    <span className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded-md ${badge.color}`}>
                      {badge.label}
                    </span>
                  )}
                  <p className="text-xs text-slate-400 truncate">{user.positionName}</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-500 flex-shrink-0" />
            </NavLink>
          </div>
        )}
      </aside>
    </>
  );
}
