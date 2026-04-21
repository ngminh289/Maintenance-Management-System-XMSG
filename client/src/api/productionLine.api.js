/**
 * productionLine.api.js — Gọi API /production-lines (CRUD).
 * Dùng trong: pages/admin/AdminPage.jsx, pages/assets/AssetForm.jsx, AssetListPage.jsx.
 * Liên quan: server/routes/productionLine.routes.js.
 */
import { api } from './index.js';

export const productionLineApi = {
  getAll:    ()          => api.get('/production-lines'),
  getById:   (id)        => api.get(`/production-lines/${id}`),
  create:    (data)      => api.post('/production-lines', data),
  update:    (id, data)  => api.put(`/production-lines/${id}`, data),
  remove:    (id)        => api.delete(`/production-lines/${id}`),
};
