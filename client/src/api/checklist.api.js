/**
 * checklist.api.js — /api/checklists: QR, kết quả (phân quyền xem theo level), tiếp nhận TC, mẫu (BFD §5).
 */
import { api } from './index.js';
export const checklistApi = {
  getQRInfo:       (assetId, params) => api.get(`/checklists/qr/${assetId}`, { params }),
  submit:          (data)    => api.post('/checklists/results', data),
  submitWithPhoto: (formData) => api.post('/checklists/results', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getTemplates:    (params)  => api.get('/checklists/templates', { params }),
  getTemplateById: (id)     => api.get(`/checklists/templates/${id}`),
  createTemplate:  (data)   => api.post('/checklists/templates', data),
  updateTemplate:  (id, d)  => api.put(`/checklists/templates/${id}`, d),
  deleteTemplate:  (id)     => api.delete(`/checklists/templates/${id}`),
  addTemplateItem:    (templateId, data) => api.post(`/checklists/templates/${templateId}/items`, data),
  updateTemplateItem: (itemId, data)     => api.put(`/checklists/items/${itemId}`, data),
  deleteTemplateItem: (itemId)           => api.delete(`/checklists/items/${itemId}`),
  getResults:   (params)  => api.get('/checklists/results', { params }),
  getResultById: (id)     => api.get(`/checklists/results/${id}`),
  getPendingReview: (params) => api.get('/checklists/results/pending-review', { params }),
  reviewResult:   (checklistId, body) => api.post(`/checklists/results/${checklistId}/review`, body),
};
