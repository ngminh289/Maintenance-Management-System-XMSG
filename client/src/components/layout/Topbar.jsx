/**
 * Topbar.jsx — Thanh tiêu đề top với chuông thông báo + user menu.
 * v2 (migration 049): thông báo có link điều hướng, đánh dấu từng cái đã đọc,
 * số lượng chưa đọc, trang xem tất cả, message chi tiết.
 * Liên quan: api/notification.api.js, contexts/AuthContext.jsx.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, Bell, LogOut, User, ExternalLink, Check, CheckCheck, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { notificationApi } from '../../api/notification.api.js';
import { fFromNow } from '../../utils/format.js';
import { buildNotificationResourceUrl } from '../../utils/notificationLink.js';

const TYPE_META = {
  MAINTENANCE_DUE:        { label: 'Lịch bảo trì',            color: 'text-amber-700 bg-amber-50' },
  APPROVAL_REQUEST:       { label: 'Phê duyệt',               color: 'text-violet-700 bg-violet-50' },
  WORK_ORDER_ASSIGNED:    { label: 'Phiếu việc',              color: 'text-blue-700 bg-blue-50' },
  WORK_ORDER_COMPLETED:   { label: 'Hoàn thành',              color: 'text-green-700 bg-green-50' },
  SYSTEM_ALERT:           { label: 'Hệ thống',                color: 'text-gray-700 bg-gray-100' },
  TASK_OVERDUE:           { label: 'Quá hạn',                 color: 'text-red-700 bg-red-50' },
  DOCUMENT_FEEDBACK_NEW:  { label: 'Phản hồi (mới)',          color: 'text-teal-700 bg-teal-50' },
  DOCUMENT_FEEDBACK_STATUS:{ label: 'Phản hồi (cập nhật)',   color: 'text-teal-700 bg-teal-50' },
  MAINTENANCE_GROUP_JOINED:{ label: 'Nhóm bảo trì',           color: 'text-indigo-700 bg-indigo-50' },
  MAINTENANCE_GROUP_LEADER:{ label: 'Trưởng nhóm',            color: 'text-indigo-700 bg-indigo-100' },
};

function NotificationDropdown({ onClose, onUnreadChange }) {
  const navigate = useNavigate();
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationApi.getAll({ limit: 20 });
      const data = res.data.data;
      setItems(data?.items ?? []);
      onUnreadChange(data?.unreadCount ?? 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange]);

  useEffect(() => {
    load();
    const handler = (e) => !ref.current?.contains(e.target) && onClose();
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [load, onClose]);

  const handleMarkOne = async (e, notiId) => {
    e.stopPropagation();
    await notificationApi.markRead(notiId).catch(() => {});
    setItems(prev => prev.map(n => (n.notiId === notiId ? { ...n, isRead: true } : n)));
    onUnreadChange(prev => Math.max(0, prev - 1));
  };

  const handleMarkAll = async () => {
    await notificationApi.markAllRead().catch(() => {});
    setItems(prev => prev.map(n => ({ ...n, isRead: true })));
    onUnreadChange(0);
  };

  const handleMarkAllUnread = async () => {
    await notificationApi.markAllUnread().catch(() => {});
    setItems(prev => prev.map(n => ({ ...n, isRead: false })));
    await notificationApi.getUnread()
      .then((r) => onUnreadChange(r.data.data?.count ?? 0))
      .catch(() => {});
  };

  const handleMarkUnread = async (e, notiId) => {
    e.stopPropagation();
    await notificationApi.markUnread(notiId).catch(() => {});
    setItems(prev => prev.map(n => (n.notiId === notiId ? { ...n, isRead: false } : n)));
    await notificationApi.getUnread()
      .then((r) => onUnreadChange(r.data.data?.count ?? 0))
      .catch(() => {});
  };

  const handleClick = async (n) => {
    const id = n.notiId;
    if (!n.isRead) {
      await notificationApi.markRead(id).catch(() => {});
      setItems(prev => prev.map(x => (x.notiId === id ? { ...x, isRead: true } : x)));
      onUnreadChange(prev => Math.max(0, prev - 1));
    }
    const url = buildNotificationResourceUrl(n);
    if (url) {
      navigate(url);
      onClose();
    }
  };

  const unreadCount = items.filter(n => !n.isRead).length;

  return (
    <div ref={ref} className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 text-sm">Thông báo</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] text-center">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
          >
            <CheckCheck size={12} />
            Đọc tất cả
          </button>
        )}
        {items.length > 0 && (
          <button
            onClick={handleMarkAllUnread}
            className="flex items-center gap-1 text-xs text-gray-600 hover:underline font-medium"
          >
            <RotateCcw size={12} />
            Chưa đọc tất cả
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100">
        {loading && (
          <p className="text-sm text-gray-400 text-center py-8 animate-pulse">Đang tải...</p>
        )}
        {!loading && items.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">Không có thông báo nào</p>
        )}
        {!loading && items.map(n => {
          const id = n.notiId;
          const meta = TYPE_META[n.type] ?? { label: n.type ?? 'Thông báo', color: 'text-gray-700 bg-gray-100' };
          const url  = buildNotificationResourceUrl(n);
          return (
            <div
              key={id}
              onClick={() => handleClick(n)}
              className={`flex gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${!n.isRead ? 'bg-blue-50/70' : ''}`}
            >
              {/* Unread indicator */}
              <div className="mt-1 flex-shrink-0">
                {!n.isRead
                  ? <div className="w-2 h-2 rounded-full bg-blue-500 mt-0.5" />
                  : <div className="w-2 h-2 rounded-full bg-transparent mt-0.5" />
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${meta.color}`}>
                    {meta.label}
                  </span>
                  {url && <ExternalLink size={10} className="text-gray-400 flex-shrink-0" />}
                </div>
                <p className={`text-sm leading-snug ${!n.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                  {n.message}
                </p>
                <p className="text-[11px] text-gray-400 mt-1">{fFromNow(n.createdAt)}</p>
              </div>

              {/* Mark read button (chỉ hiện khi chưa đọc) */}
              {!n.isRead && (
                <button
                  onClick={(e) => handleMarkOne(e, id)}
                  title="Đánh dấu đã đọc"
                  className="flex-shrink-0 mt-1 p-1 rounded-full hover:bg-blue-100 text-blue-500 transition-colors"
                >
                  <Check size={13} />
                </button>
              )}
              {n.isRead && (
                <button
                  onClick={(e) => handleMarkUnread(e, id)}
                  title="Đánh dấu chưa đọc"
                  className="flex-shrink-0 mt-1 p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                >
                  <RotateCcw size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {items.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50 text-center">
          <button
            onClick={() => { navigate('/notifications'); onClose(); }}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            Xem tất cả thông báo →
          </button>
        </div>
      )}
    </div>
  );
}

export function Topbar({ onMenuClick, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotif, setShowNotif] = useState(false);
  const [showUser,  setShowUser]  = useState(false);
  const [unread,    setUnread]    = useState(0);

  const refreshUnread = useCallback(() =>
    notificationApi.getUnread().then(r => setUnread(r.data.data?.count ?? 0)).catch(() => {}),
  []);

  useEffect(() => {
    refreshUnread();
    const iv = setInterval(refreshUnread, 30_000);
    return () => clearInterval(iv);
  }, [refreshUnread]);

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
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
          {showNotif && (
            <NotificationDropdown
              onClose={() => setShowNotif(false)}
              onUnreadChange={setUnread}
            />
          )}
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
