import { api } from './index.js';
export const authApi = {
  register:    (data)  => api.post('/auth/register', data),
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
  login:  (data) => api.post('/auth/login', data),
  logout: ()     => api.post('/auth/logout'),
  me:     ()     => api.get('/auth/me'),
  refresh: ()    => api.post('/auth/refresh'),
  forgotPassword:  (email) => api.post('/auth/forgot-password', { email }),
  resetPassword:   (data)  => api.post('/auth/reset-password', data),
  changePassword:  (data)  => api.patch('/auth/change-password', data),
};
