/**
 * api/index.js — Axios instance + interceptors (401 → refresh → redirect login).
 * withCredentials: true để gửi httpOnly cookie.
 */
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

/** Khi gửi FormData, xóa Content-Type để browser tự thêm boundary đúng chuẩn multipart. */
api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

let isRefreshing = false;
let failQueue = [];

const processQueue = (error) => {
  failQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(),
  );
  failQueue = [];
};

// Các trang không cần redirect về /login khi gặp 401
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];
const isPublicPage = () =>
  PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p));

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      // Đang ở trang public → không refresh, không redirect
      if (isPublicPage()) return Promise.reject(err);

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failQueue.push({ resolve, reject });
        })
          .then(() => api(original))
          .catch(Promise.reject.bind(Promise));
      }
      original._retry = true;
      isRefreshing = true;
      try {
        await axios.post(
          `${import.meta.env.VITE_API_BASE || "/api"}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        processQueue(null);
        return api(original);
      } catch {
        processQueue(new Error("Session expired"));
        window.location.href = "/login";
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(err);
  },
);
