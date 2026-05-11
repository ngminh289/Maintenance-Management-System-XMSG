/**
 * workflow.api.js — CRUD mẫu luồng phê duyệt + Steps (/api/workflows).
 * BFD 4.1: Admin cấu hình WorkflowTemplates; service BE khoá sửa bước khi
 * mẫu đã có ApprovalLogs sử dụng.
 */
import { api } from './index.js';

export const workflowApi = {
  getAll: (params) => api.get('/workflows', { params }),
  getById: (id) => api.get(`/workflows/${id}`),
  create: (body) => api.post('/workflows', body),
  update: (id, body) => api.put(`/workflows/${id}`, body),
  remove: (id) => api.delete(`/workflows/${id}`),
  addStep: (id, body) => api.post(`/workflows/${id}/steps`, body),
  updateStep: (id, stepId, body) => api.put(`/workflows/${id}/steps/${stepId}`, body),
  removeStep: (id, stepId) => api.delete(`/workflows/${id}/steps/${stepId}`),
};
