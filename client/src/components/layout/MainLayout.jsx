/**
 * MainLayout.jsx — Layout chính: Sidebar + Topbar + nội dung trang.
 * Responsive: sidebar ẩn trên mobile, hiện qua hamburger.
 * PAGE_TITLES: ưu tiên /checklists/history trước prefix /checklists để tiêu đề Topbar đúng.
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
  '/checklists/history': 'Danh sách checklist',
  '/checklists/review': 'Tiếp nhận checklist',
  '/checklists/templates': 'Mẫu checklist',
  '/documents':   'Kho tài liệu số',
  '/documents/feedback-inbox': 'Phản hồi tài liệu',
  '/approvals':   'Phê duyệt',
  '/workflows':   'Luồng phê duyệt',
  '/employees':   'Quản lý nhân sự',
  '/reports/operations':   'Báo cáo nghiệp vụ và vận hành',
  '/reports/resource-usage': 'Báo cáo sử dụng tài nguyên',
  '/reports/performance':  'Báo cáo hiệu suất tài sản',
  '/admin':       'Cấu hình hệ thống',
  '/admin/permissions': 'Phân quyền hệ thống',
  '/notifications': 'Thông báo',
  '/settings':    'Cài đặt hệ thống',
  '/profile':     'Hồ sơ cá nhân',
};

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  const title =
    PAGE_TITLES[pathname] ??
  (pathname.startsWith('/checklists/history')
    ? PAGE_TITLES['/checklists/history']
    : pathname.startsWith('/checklists/review')
      ? PAGE_TITLES['/checklists/review']
      : pathname.startsWith('/checklists/templates')
        ? PAGE_TITLES['/checklists/templates']
        : pathname.startsWith('/documents/feedback-inbox')
          ? PAGE_TITLES['/documents/feedback-inbox']
      : PAGE_TITLES[
          Object.keys(PAGE_TITLES).find(
            (k) => pathname.startsWith(k) && k !== '/',
          ) ?? '/'
        ]) ??
    '';

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
