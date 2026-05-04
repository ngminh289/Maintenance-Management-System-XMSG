/**
 * NotificationsPage.jsx — Trang xem tất cả thông báo với phân trang, filter chưa đọc.
 * Liên quan: api/notification.api.js, Topbar.jsx (link "Xem tất cả").
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, ExternalLink, RotateCcw } from 'lucide-react';
import { notificationApi } from '../api/notification.api.js';
import { fFromNow } from '../utils/format.js';
import { buildNotificationResourceUrl } from '../utils/notificationLink.js';

const TYPE_META = {
  MAINTENANCE_DUE:         { label: 'Lịch bảo trì',          color: 'text-amber-700 bg-amber-50 border-amber-200' },
  APPROVAL_REQUEST:        { label: 'Phê duyệt',              color: 'text-violet-700 bg-violet-50 border-violet-200' },
  WORK_ORDER_ASSIGNED:     { label: 'Phiếu việc',             color: 'text-blue-700 bg-blue-50 border-blue-200' },
  WORK_ORDER_COMPLETED:    { label: 'Hoàn thành',             color: 'text-green-700 bg-green-50 border-green-200' },
  SYSTEM_ALERT:            { label: 'Hệ thống',               color: 'text-gray-700 bg-gray-100 border-gray-200' },
  TASK_OVERDUE:            { label: 'Quá hạn',                color: 'text-red-700 bg-red-50 border-red-200' },
  DOCUMENT_FEEDBACK_NEW:   { label: 'Phản hồi (mới)',         color: 'text-teal-700 bg-teal-50 border-teal-200' },
  DOCUMENT_FEEDBACK_STATUS:{ label: 'Phản hồi (cập nhật)',    color: 'text-teal-700 bg-teal-50 border-teal-200' },
  MAINTENANCE_GROUP_JOINED:{ label: 'Nhóm bảo trì',           color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  MAINTENANCE_GROUP_LEADER:{ label: 'Trưởng nhóm',            color: 'text-indigo-700 bg-indigo-100 border-indigo-300' },
};

export function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems]       = useState([]);
  const [unreadCount, setUnread] = useState(0);
  const [loading, setLoading]   = useState(false);
  const [readFilter, setReadFilter] = useState('all'); // all | unread | read
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const LIMIT = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationApi.getAll({
        limit: LIMIT,
        offset: (page - 1) * LIMIT,
        read: readFilter === 'all' ? undefined : String(readFilter === 'read'),
      });
      const data = res.data.data;
      setItems(data?.items ?? []);
      setUnread(data?.unreadCount ?? 0);
      setTotal(Number(data?.total) || 0);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }, [page, readFilter]);

  useEffect(() => { load(); }, [load]);

  const handleMarkOne = async (notiId) => {
    await notificationApi.markRead(notiId).catch(() => {});
    await load();
  };

  const handleMarkUnreadOne = async (notiId) => {
    await notificationApi.markUnread(notiId).catch(() => {});
    await load();
  };

  const handleMarkAll = async () => {
    await notificationApi.markAllRead().catch(() => {});
    await load();
  };

  const handleMarkAllUnread = async () => {
    await notificationApi.markAllUnread().catch(() => {});
    await load();
  };

  const handleClick = async (n) => {
    if (!n.isRead) await handleMarkOne(n.notiId);
    const url = buildNotificationResourceUrl(n);
    if (url) navigate(url);
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Bell size={22} className="text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900">Thông báo</h1>
        {unreadCount > 0 && (
          <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
            {unreadCount} chưa đọc
          </span>
        )}
        <div className="flex-1" />
        {items.length > 0 && (
          <button
            onClick={handleMarkAllUnread}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:underline font-medium"
          >
            <RotateCcw size={15} />
            Đánh dấu tất cả chưa đọc
          </button>
        )}
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline font-medium"
          >
            <CheckCheck size={15} />
            Đánh dấu tất cả đã đọc
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setReadFilter('all'); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${readFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Tất cả
        </button>
        <button
          onClick={() => { setReadFilter('unread'); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${readFilter === 'unread' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Chưa đọc {unreadCount > 0 && `(${unreadCount})`}
        </button>
        <button
          onClick={() => { setReadFilter('read'); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${readFilter === 'read' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Đã đọc
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden shadow-sm">
        {loading && (
          <p className="text-sm text-gray-400 text-center py-12 animate-pulse">Đang tải...</p>
        )}
        {!loading && items.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-12">
            {readFilter === 'unread' ? 'Không có thông báo chưa đọc' : (readFilter === 'read' ? 'Không có thông báo đã đọc' : 'Không có thông báo nào')}
          </p>
        )}
        {!loading && items.map(n => {
          const meta = TYPE_META[n.type] ?? { label: n.type ?? 'Thông báo', color: 'text-gray-700 bg-gray-100 border-gray-200' };
          const url = buildNotificationResourceUrl(n);
          return (
            <div
              key={n.notiId}
              onClick={() => handleClick(n)}
              className={`flex gap-3 px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors ${!n.isRead ? 'bg-blue-50/60' : ''}`}
            >
              <div className="mt-1.5 flex-shrink-0">
                {!n.isRead
                  ? <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  : <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${meta.color}`}>
                    {meta.label}
                  </span>
                  {url && <ExternalLink size={10} className="text-gray-400" />}
                </div>
                <p className={`text-sm leading-snug ${!n.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                  {n.message}
                </p>
                <p className="text-xs text-gray-400 mt-1">{fFromNow(n.createdAt)}</p>
              </div>
              {!n.isRead && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleMarkOne(n.notiId); }}
                  title="Đánh dấu đã đọc"
                  className="flex-shrink-0 self-center p-1.5 rounded-full hover:bg-blue-100 text-blue-500 transition-colors"
                >
                  <Check size={14} />
                </button>
              )}
              {n.isRead && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleMarkUnreadOne(n.notiId); }}
                  title="Đánh dấu chưa đọc"
                  className="flex-shrink-0 self-center p-1.5 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>Trang {page}/{totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Trước
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
