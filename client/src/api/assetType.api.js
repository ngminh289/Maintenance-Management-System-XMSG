/**
 * assetType.api.js — Gọi API /asset-types (CRUD).
 * Dùng trong: pages/admin/AdminPage.jsx.
 * Liên quan: server/routes/assetType.routes.js.
 */
import { api } from './index.js';

export const assetTypeApi = {
  getAll:    ()          => api.get('/asset-types'),
  /** Chỉ loại con (leaf) — dùng cho dropdown chọn loại khi tạo/sửa tài sản. */
  getLeaves: ()          => api.get('/asset-types/leaves'),
  getById:   (id)        => api.get(`/asset-types/${id}`),
  create:    (data)      => api.post('/asset-types', data),
  update:    (id, data)  => api.put(`/asset-types/${id}`, data),
  remove:    (id)        => api.delete(`/asset-types/${id}`),
};
