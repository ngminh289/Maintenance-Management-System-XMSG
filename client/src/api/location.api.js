/**
 * location.api.js — Gọi API /locations (CRUD).
 * Dùng trong: pages/admin/AdminPage.jsx.
 * Liên quan: server/routes/location.routes.js.
 */
import { api } from './index.js';

export const locationApi = {
  getAll:    ()          => api.get('/locations'),
  getTree:   ()          => api.get('/locations/tree'),
  getById:   (id)        => api.get(`/locations/${id}`),
  create:    (data)      => api.post('/locations', data),
  update:    (id, data)  => api.put(`/locations/${id}`, data),
  remove:    (id)        => api.delete(`/locations/${id}`),
};
