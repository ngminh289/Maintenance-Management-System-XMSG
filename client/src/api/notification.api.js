import { api } from './index.js';
export const notificationApi = {
  getAll:    (params) => api.get('/notifications', { params }),
  getUnread: ()       => api.get('/notifications/unread-count'),
  markRead:  (id)     => api.patch(`/notifications/${id}/read`),
  markAllRead: ()     => api.patch('/notifications/read-all'),
};
