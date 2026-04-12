/**
 * Topbar.jsx — Thanh tiêu đề top với chuông thông báo + user menu.
 * RBAC: không có link admin riêng (điều hướng theo Sidebar + canAccess); không cần ẩn thêm.
 * Nhãn loại thông báo: DOCUMENT_FEEDBACK_* (migration 039) + các loại hệ thống.
 */
import { useState, useEffect, useRef } from 'react';
import { Menu, Bell, LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { notificationApi } from '../../api/notification.api.js';
import { fFromNow } from '../../utils/format.js';

const NOTIFICATION_TYPE_LABEL = {
  MAINTENANCE_DUE: 'Lịch bảo trì',
  APPROVAL_REQUEST: 'Phê duyệt',
  WORK_ORDER_ASSIGNED: 'Phiếu việc',
  WORK_ORDER_COMPLETED: 'Phiếu việc',
  SYSTEM_ALERT: 'Hệ thống',
  TASK_OVERDUE: 'Quá hạn',
  DOCUMENT_FEEDBACK_NEW: 'Góp ý tài liệu (mới)',
  DOCUMENT_FEEDBACK_STATUS: 'Góp ý tài liệu (cập nhật)',
};

function NotificationDropdown({ onClose }) {
  const [items, setItems]   = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    notificationApi.getAll({ limit: 8 }).then(r => setItems(r.data.data?.items ?? [])).catch(() => {});
    const handler = (e) => !ref.current?.contains(e.target) && onClose();
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const markAll = async () => {
    await notificationApi.markAllRead().catch(() => {});
    setItems(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  return (
    <div ref={ref} className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <span className="font-semibold text-gray-900 text-sm">Thông báo</span>
        <button onClick={markAll} className="text-xs text-blue-600 hover:underline font-medium">Đọc tất cả</button>
      </div>
      <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
        {items.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">Không có thông báo</p>
        )}
        {items.map(n => {
          const id = n.notiId ?? n.notificationId;
          const typeLabel = NOTIFICATION_TYPE_LABEL[n.type] ?? n.type ?? 'Thông báo';
          return (
            <div
              key={id}
              className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${!n.isRead ? 'bg-blue-50' : ''}`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700 mb-1">{typeLabel}</p>
              <p className="text-sm font-semibold text-gray-900 leading-snug">{n.message}</p>
              <p className="text-xs font-medium text-gray-600 mt-1">{fFromNow(n.createdAt)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Topbar({ onMenuClick, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotif, setShowNotif] = useState(false);
  const [showUser,  setShowUser]  = useState(false);
  const [unread,    setUnread]    = useState(0);

  const refreshUnread = () =>
    notificationApi.getUnread().then(r => setUnread(r.data.data?.count ?? 0)).catch(() => {});

  useEffect(() => {
    refreshUnread();
    const iv = setInterval(refreshUnread, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (showNotif) refreshUnread();
  }, [showNotif]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 sticky top-0 z-10 shadow-sm">
      <button onClick={onMenuClick} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 lg:hidden">
        <Menu size={20} />
      </button>

      <h1 className="font-bold text-gray-900 text-base flex-1">{title}</h1>

      <div className="flex items-center gap-1">
        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => { setShowNotif(p => !p); setShowUser(false); }}
            className="relative p-2 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <Bell size={19} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          {showNotif && <NotificationDropdown onClose={() => setShowNotif(false)} />}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => { setShowUser(p => !p); setShowNotif(false); }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
              {user?.fullName?.[0] ?? 'U'}
            </div>
            <span className="text-sm font-semibold text-gray-800 hidden sm:block">{user?.fullName}</span>
          </button>
          {showUser && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50">
              <button
                onClick={() => { navigate('/profile'); setShowUser(false); }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50 font-medium"
              >
                <User size={15} className="text-gray-500" /> Hồ sơ cá nhân
              </button>
              <hr className="my-1 border-gray-100" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 font-medium"
              >
                <LogOut size={15} /> Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
