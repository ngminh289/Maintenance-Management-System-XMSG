import { api } from './index.js';
export const approvalApi = {
  getPending:  (params)  => api.get('/approvals/pending', { params }),
  getHistory:  (id, type) => api.get(`/approvals/history/${type}/${id}`),
  submit:      (data)    => api.post('/approvals/submit', data),
  action:      (logId, data) => api.post(`/approvals/${logId}/action`, data),
};
