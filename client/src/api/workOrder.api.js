/**
 * workOrder.api.js — Client gọi /api/work-orders (CRUD, ảnh, phân công, closure-notes nháp, reset mốc giờ CORRECTIVE).
 */
import { api } from './index.js';
export const workOrderApi = {
  getAll:       (params) => api.get('/work-orders', { params }),
  getById:      (id)     => api.get(`/work-orders/${id}`),
  create:       (data)   => api.post('/work-orders', data),
  update:       (id, d)  => api.put(`/work-orders/${id}`, d),
  changeStatus: (id, status, data = {}) => api.patch(`/work-orders/${id}/status`, { status, ...data }),
  saveClosureNotes: (id, data) =>
    api.patch(`/work-orders/${id}/closure-notes`, data),
  resetRuntimeBaseline: (id) =>
    api.post(`/work-orders/${id}/counter-reset-baseline`),
  uploadPhotos: (id, formData) => api.post(`/work-orders/${id}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deletePhoto:  (id, photoId) => api.delete(`/work-orders/${id}/photos/${photoId}`),
  assign:       (id, employeeId) => api.post(`/work-orders/${id}/assign`, { employeeId }),
  unassign:     (id, employeeId) => api.delete(`/work-orders/${id}/assign/${employeeId}`),
  remove:       (id)     => api.delete(`/work-orders/${id}`),
};
