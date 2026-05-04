import { api } from './index.js';
export const notificationApi = {
  getAll:    (params) => api.get('/notifications', { params }),
  getUnread: ()       => api.get('/notifications/unread-count'),
  markRead:  (id)     => api.patch(`/notifications/${id}/read`),
  markUnread:(id)     => api.patch(`/notifications/${id}/unread`),
  markAllRead: ()     => api.patch('/notifications/read-all'),
  markAllUnread: ()   => api.patch('/notifications/unread-all'),
};
