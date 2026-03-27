/**
 * Sidebar.jsx — Dark sidebar dễ đọc, phân nhóm menu rõ ràng.
 */
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Cpu, ClipboardList, Wrench, FileText,
  CheckSquare, Users, Settings, ShieldCheck, ChevronRight,
  Factory, BarChart2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';

const MENU = [
  {
    label: 'Tổng quan',
    items: [
      { to: '/',           icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Vận hành',
    items: [
      { to: '/assets',      icon: Cpu,           label: 'Tài sản thiết bị' },
      { to: '/schedules',   icon: ClipboardList, label: 'Lịch bảo trì' },
      { to: '/work-orders', icon: Wrench,        label: 'Phiếu việc' },
      { to: '/checklists',  icon: CheckSquare,   label: 'Checklist / QR' },
    ],
  },
  {
    label: 'Tài liệu & Phê duyệt',
    items: [
      { to: '/documents',   icon: FileText,     label: 'Kho tài liệu số' },
      { to: '/approvals',   icon: ShieldCheck,  label: 'Phê duyệt' },
    ],
  },
  {
    label: 'Báo cáo',
    items: [
      { to: '/reports',     icon: BarChart2,    label: 'Thống kê & Báo cáo' },
    ],
  },
  {
    label: 'Quản trị',
    items: [
      { to: '/employees',   icon: Users,        label: 'Nhân sự' },
      { to: '/settings',    icon: Settings,     label: 'Cài đặt hệ thống' },
    ],
  },
];

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to} end={to === '/'}
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
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {MENU.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavItem key={item.to} {...item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
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
                <p className="text-xs text-slate-400 truncate">{user.positionName}</p>
              </div>
              <ChevronRight size={14} className="text-slate-500 flex-shrink-0" />
            </NavLink>
          </div>
        )}
      </aside>
    </>
  );
}
