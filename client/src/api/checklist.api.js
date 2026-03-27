import { api } from './index.js';
export const checklistApi = {
  getQRInfo:    (assetId) => api.get(`/checklists/qr/${assetId}`),
  submit:       (data)    => api.post('/checklists/results', data),
  getTemplates: (params)  => api.get('/checklists/templates', { params }),
  getResults:   (params)  => api.get('/checklists/results', { params }),
};
