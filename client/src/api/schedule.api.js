import { api } from './index.js';
export const scheduleApi = {
  getAll:      (params)  => api.get('/maintenance-schedules', { params }),
  getById:     (id)      => api.get(`/maintenance-schedules/${id}`),
  create:      (data)    => api.post('/maintenance-schedules', data),
  update:      (id, d)   => api.put(`/maintenance-schedules/${id}`, d),
  remove:      (id)      => api.delete(`/maintenance-schedules/${id}`),
  generateWO:  (id)      => api.post(`/maintenance-schedules/${id}/generate-work-order`),
  submit:      (id)      => api.post(`/maintenance-schedules/${id}/submit`),
};
