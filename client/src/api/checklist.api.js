import { api } from './index.js';
export const checklistApi = {
  getQRInfo:       (assetId) => api.get(`/checklists/qr/${assetId}`),
  submit:          (data)    => api.post('/checklists/results', data),
  // multipart khi kèm ảnh minh chứng
  submitWithPhoto: (formData) => api.post('/checklists/results', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getTemplates: (params)  => api.get('/checklists/templates', { params }),
  getResults:   (params)  => api.get('/checklists/results', { params }),
};
