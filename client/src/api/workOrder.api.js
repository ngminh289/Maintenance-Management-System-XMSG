/**
 * workOrder.api.js — Client gọi /api/work-orders.
 * Phân công: assign (cá nhân) + assignGroup (nhóm + trưởng nhóm).
 * Trưởng nhóm (isGroupLeader): người bắt đầu phiếu và ghi chú vật tư.
 */
import { api } from './index.js';
export const workOrderApi = {
  getAll:       (params) => api.get('/work-orders', { params }),
  getById:      (id)     => api.get(`/work-orders/${id}`),
  create:       (data)   => api.post('/work-orders', data),
  update:       (id, d)  => api.put(`/work-orders/${id}`, d),
  changeStatus: (id, status, data = {}) => api.patch(`/work-orders/${id}/status`, { status, ...data }),
  saveClosureNotes: (id, data) => api.patch(`/work-orders/${id}/closure-notes`, data),
  resetRuntimeBaseline: (id) => api.post(`/work-orders/${id}/counter-reset-baseline`),
  uploadPhotos: (id, formData) => api.post(`/work-orders/${id}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deletePhoto:  (id, photoId) => api.delete(`/work-orders/${id}/photos/${photoId}`),
  /** Phân công cá nhân (tự là trưởng nhóm). */
  assign:       (id, employeeId) => api.post(`/work-orders/${id}/assign`, { employeeId }),
  /** Phân công nhóm — trưởng nhóm tự động từ GroupMembers.IsGroupLeader. */
  assignGroup:  (id, groupId) => api.post(`/work-orders/${id}/assign-group`, { groupId }),
  unassign:     (id, employeeId) => api.delete(`/work-orders/${id}/assign/${employeeId}`),
  remove:       (id)     => api.delete(`/work-orders/${id}`),
};
