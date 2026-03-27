import { api } from './index.js';
export const employeeApi = {
  getAll:    (params) => api.get('/employees', { params }),
  getById:   (id)     => api.get(`/employees/${id}`),
  create:    (data)   => api.post('/employees', data),
  update:    (id, d)  => api.put(`/employees/${id}`, d),
  deactivate:(id)     => api.patch(`/employees/${id}/deactivate`),
  activate:  (id)     => api.patch(`/employees/${id}/activate`),
  changePassword: (id, data) => api.patch(`/employees/${id}/password`, data),

  // Master data
  getDepartments: () => api.get('/departments'),
  getPositions:   () => api.get('/positions'),
};
