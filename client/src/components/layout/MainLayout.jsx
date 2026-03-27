/**
 * MainLayout.jsx — Layout chính: Sidebar + Topbar + nội dung trang.
 * Responsive: sidebar ẩn trên mobile, hiện qua hamburger.
 */
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar.jsx';
import { Topbar }  from './Topbar.jsx';

const PAGE_TITLES = {
  '/':            'Dashboard',
  '/assets':      'Tài sản thiết bị',
  '/schedules':   'Lịch bảo trì',
  '/work-orders': 'Phiếu việc (Work Orders)',
  '/checklists':  'Checklist & QR Scan',
  '/documents':   'Kho tài liệu số',
  '/approvals':   'Phê duyệt',
  '/employees':   'Quản lý nhân sự',
  '/settings':    'Cài đặt hệ thống',
  '/profile':     'Hồ sơ cá nhân',
};

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  const title = PAGE_TITLES[pathname] ?? PAGE_TITLES[Object.keys(PAGE_TITLES).find(k => pathname.startsWith(k) && k !== '/') ?? '/'] ?? '';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
