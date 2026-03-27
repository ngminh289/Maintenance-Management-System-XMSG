import { api } from './index.js';
export const statsApi = {
  summary:          ()       => api.get('/stats'),
  checklistTrend:   ()       => api.get('/stats/checklist-trend'),
  topFaulty:        (limit)  => api.get('/stats/top-faulty', { params: { limit } }),
  woCompletion:     ()       => api.get('/stats/wo-completion'),
  digitalAssets:    ()       => api.get('/stats/digital-assets'),
};
