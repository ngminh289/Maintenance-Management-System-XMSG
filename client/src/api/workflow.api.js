/**
 * workflow.api.js — CRUD mẫu luồng phê duyệt (/api/workflows).
 * BFD 4.1: Admin cấu hình WorkflowTemplates + Steps.
 */
import { api } from './index.js';

export const workflowApi = {
  getAll: (params) => api.get('/workflows', { params }),
  getById: (id) => api.get(`/workflows/${id}`),
  create: (body) => api.post('/workflows', body),
  update: (id, body) => api.put(`/workflows/${id}`, body),
  remove: (id) => api.delete(`/workflows/${id}`),
};
