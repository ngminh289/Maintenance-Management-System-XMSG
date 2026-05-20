/**
 * Sidebar.jsx — Dark sidebar, lọc menu theo role người dùng.
 * Cấu trúc menu 3 cấp theo UX mới:
 *   Cấp 1: Nhóm lớn (Tổng quan/Vận hành/...)
 *   Cấp 2: Mục cùng hàng (vd. Tài sản thiết bị, Bảo trì, Checklist)
 *   Cấp 3: Mục con thu gọn trong mục cha (vd. Bảo trì -> Lịch bảo trì, Phiếu việc)
 */
import { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Cpu, ClipboardList, Wrench, FileText,
  CheckSquare, ClipboardCheck, Layers, Users, ShieldCheck, ChevronRight,
  ListChecks, Factory, Activity, GitBranch, MessageSquare, Settings,
  ScrollText, ChevronsUpDown, KeyRound,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { canAccess, canDo, getSidebarRoleBadge, isAdminUser } from '../../utils/rbac.js';

// Định nghĩa menu 3 cấp — routeKey/action bám rbac.js
const MENU_GROUPS = [
  {
    label: 'Tổng quan',
    items: [
      {
        to: '/',
        routeKey: null,
        icon: LayoutDashboard,
        label: 'Dashboard',
        end: true,
      },
    ],
  },
  {
    label: 'Vận hành',
    items: [
      {
        to: '/assets',
        routeKey: 'assets',
        icon: Cpu,
        label: 'Tài sản thiết bị',
      },
      {
        key: 'maint',
        icon: ClipboardList,
        label: 'Bảo trì',
        children: [
          { to: '/schedules', routeKey: 'schedules', icon: ClipboardList, label: 'Lịch bảo trì' },
          { to: '/work-orders', routeKey: 'work-orders', icon: Wrench, label: 'Phiếu việc' },
        ],
      },
      {
        key: 'checklist',
        icon: CheckSquare,
        label: 'Checklist',
        children: [
          { to: '/checklists', routeKey: 'checklists', icon: CheckSquare, label: 'Quét mã QR', end: true },
          { to: '/checklists/history', routeKey: 'checklists', icon: ListChecks, label: 'Danh sách checklist' },
          { to: '/checklists/review', routeKey: 'checklists', icon: ClipboardCheck, label: 'Tiếp nhận checklist', action: 'CHECKLIST_RESULT:APPROVE' },
          { to: '/checklists/templates', routeKey: 'checklist-manage', icon: Layers, label: 'Mẫu checklist' },
        ],
      },
    ],
  },
  {
    label: 'Tài liệu và phê duyệt',
    items: [
      {
        key: 'docs',
        icon: FileText,
        label: 'Tài liệu',
        children: [
          { to: '/documents', routeKey: 'documents', icon: FileText, label: 'Kho tài liệu', end: true },
          { to: '/documents/feedback-inbox', routeKey: 'document-feedback-inbox', icon: MessageSquare, label: 'Phản hồi tài liệu' },
        ],
      },
      {
        to: '/approvals',
        routeKey: 'approvals',
        icon: ShieldCheck,
        label: 'Phê duyệt',
      },
    ],
  },
  {
    label: 'Báo cáo',
    items: [
      {
        to: '/reports/operations',
        routeKey: 'report-operations',
        icon: ScrollText,
        label: 'Nghiệp vụ và vận hành',
      },
      {
        to: '/reports/resource-usage',
        routeKey: 'report-resource-usage',
        icon: FileText,
        label: 'Sử dụng tài nguyên',
      },
      {
        to: '/reports/performance',
        routeKey: 'report-performance',
        icon: Activity,
        label: 'Hiệu suất & tình trạng',
      },
    ],
  },
  {
    label: 'Quản trị',
    items: [
      {
        to: '/employees',
        routeKey: 'employees',
        icon: Users,
        label: 'Nhân sự',
      },
      {
        to: '/workflows',
        routeKey: 'workflows',
        icon: GitBranch,
        label: 'Luồng phê duyệt',
      },
      {
        to: '/admin',
        routeKey: 'admin-settings',
        icon: Settings,
        label: 'Cấu hình hệ thống',
        end: true,
      },
      {
        to: '/admin/permissions',
        routeKey: 'admin-settings',
        icon: KeyRound,
        label: 'Phân quyền hệ thống',
      },
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

function ExpandableNavItem({
  icon: Icon,
  label,
  childrenItems,
  pathname,
  isOpen,
  onToggle,
}) {
  const hasActiveChild = childrenItems.some((c) => pathname.startsWith(c.to));
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
          ${hasActiveChild || isOpen
            ? 'bg-slate-700/70 text-white'
            : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
      >
        <Icon size={17} />
        <span className="flex-1 text-left">{label}</span>
        <ChevronsUpDown size={14} className={`transition-transform ${isOpen ? 'rotate-180 text-sky-300' : 'text-slate-500'}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-72 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="pl-8 space-y-0.5">
          {childrenItems.map(({ routeKey: _rk, action: _ac, ...item }) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end === true}
              className={({ isActive }) =>
                `flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-colors
                ${isActive ? 'text-sky-300 bg-slate-800/80' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`
              }
            >
              <item.icon size={13} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ open, onClose }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const badge = getSidebarRoleBadge(user);

  const visibleGroups = useMemo(() => MENU_GROUPS.map((group) => {
    const items = (group.items ?? [])
      .map((item) => {
        if (item.children) {
          const children = item.children.filter((ch) => {
            if (ch.routeKey !== null && !canAccess(user, ch.routeKey)) return false;
            if (ch.action && !canDo(user, ch.action) && !isAdminUser(user)) return false;
            return true;
          });
          return { ...item, children };
        }
        return item;
      })
      .filter((item) => {
        if (item.children) return item.children.length > 0;
        if (item.routeKey !== null && !canAccess(user, item.routeKey)) return false;
        if (item.action && !canDo(user, item.action) && !isAdminUser(user)) return false;
        return true;
      });
    return { ...group, items };
  }).filter((g) => g.items.length > 0), [user]);

  const [expanded, setExpanded] = useState(() => {
    const state = {};
    visibleGroups.forEach((g) => {
      g.items.forEach((it) => {
        if (it.children) {
          state[it.key] = it.children.some((c) => pathname.startsWith(c.to));
        }
      });
    });
    return state;
  });

  const toggleExpand = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Lọc menu: chỉ giữ group/item user có quyền xem
  const _legacyVisibleGroups = MENU_GROUPS.map((group) => {
    const sections = (group.sections ?? [])
      .map((section) => ({
        ...section,
        items: (section.items ?? []).filter((item) => {
          if (item.routeKey !== null && !canAccess(user, item.routeKey)) return false;
          if (item.action && !canDo(user, item.action)) return false;
          return true;
        }),
      }))
      .filter((s) => s.items.length > 0);
    return { ...group, sections };
  }).filter((g) => g.sections.length > 0);

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
              <div className="space-y-1">
                {group.items.map((item) => {
                  if (item.children) {
                    return (
                      <ExpandableNavItem
                        key={item.key}
                        icon={item.icon}
                        label={item.label}
                        childrenItems={item.children}
                        pathname={pathname}
                        isOpen={Boolean(expanded[item.key])}
                        onToggle={() => toggleExpand(item.key)}
                      />
                    );
                  }
                  const { routeKey: _rk, action: _ac, ...leaf } = item;
                  return <NavItem key={leaf.to} {...leaf} />;
                })}
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
                    <span className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded-md whitespace-nowrap ${badge.color}`}>
                      {badge.label}
                    </span>
                  )}
                  {user.departmentName ? (
                    <p className="text-xs text-slate-400 truncate">{user.departmentName}</p>
                  ) : null}
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
