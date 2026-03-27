import { api } from './index.js';
export const statsApi = {
  summary:          () => api.get('/stats'),
  checklistTrend:   () => api.get('/stats/checklist-trend'),
  topFaulty:        () => api.get('/stats/top-faulty'),
  woCompletion:     () => api.get('/stats/wo-completion'),
};
