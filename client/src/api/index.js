/**
 * api/index.js — Axios instance + interceptors (401 → redirect login).
 * withCredentials: true để gửi httpOnly cookie.
 */
import axios from 'axios';

// Dùng proxy Vite ('/api') trong dev, VITE_API_BASE trong production
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let failQueue = [];

const processQueue = (error) => {
  failQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve());
  failQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failQueue.push({ resolve, reject });
        }).then(() => api(original)).catch(Promise.reject.bind(Promise));
      }
      original._retry = true;
      isRefreshing = true;
      try {
        await axios.post(
          `${import.meta.env.VITE_API_BASE || '/api'}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        processQueue(null);
        return api(original);
      } catch {
        processQueue(new Error('Session expired'));
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(err);
  },
);
