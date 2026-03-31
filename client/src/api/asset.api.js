/**
 * asset.api.js — Gọi API tài sản, bộ đếm giờ, RuntimeLogs, predictive-events.
 */
import { api } from './index.js';
export const assetApi = {
  getAll:       (params) => api.get('/assets', { params }),
  getById:      (id)     => api.get(`/assets/${id}`),
  create:       (data)   => api.post('/assets', data),
  update:       (id, d)  => api.put(`/assets/${id}`, d),
  updateStatus: (id, status) => api.patch(`/assets/${id}/status`, { status }),
  remove:       (id)     => api.delete(`/assets/${id}`),
  getQRUrl:     (id)     => `${import.meta.env.VITE_API_BASE || '/api'}/assets/${id}/qr`,
  getCounter:   (id)     => api.get(`/assets/${id}/counter`),
  getHistory:   (id)     => api.get(`/assets/${id}/counter/history`),
  getPredictiveEvents: (id, params) => api.get(`/assets/${id}/predictive-events`, { params }),
  getMaintenanceHistory: (id, params) => api.get(`/assets/${id}/maintenance-history`, { params }),
  recordReading: (id, data) => api.post(`/assets/${id}/readings`, data),

  // Master data
  getTypes:     () => api.get('/asset-types'),
  getLocations: () => api.get('/locations'),
};
