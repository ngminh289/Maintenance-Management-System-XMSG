/**
 * auth.api.js — Gọi API /api/auth (đăng nhập, token, quên mật khẩu).
 * Không còn endpoint đăng ký công khai; tài khoản do Admin tạo tại Nhân viên.
 */
import { api } from "./index.js";

export const authApi = {
  verifyEmail: (token) => api.post("/auth/verify-email", { token }),
  login: (data) => api.post("/auth/login", data),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/auth/me"),
  refresh: () => api.post("/auth/refresh"),
  forgotPassword: (email) =>
    api.post("/auth/forgot-password", { email }),
  resetPassword: (data) => api.post("/auth/reset-password", data),
  changePassword: (data) =>
    api.patch("/auth/change-password", data),
};
