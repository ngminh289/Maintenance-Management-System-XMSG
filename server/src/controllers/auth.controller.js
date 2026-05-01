/**
 * auth.controller.js — HTTP handler: /api/auth/*.
 * Chỉ xử lý request/response + cookie. Logic trong auth.service.js.
 * function.rule: JWT + refreshToken httpOnly cookie, verify Gmail, quên mật khẩu.
 * Không endpoint đăng ký công khai — tạo user qua employee (Admin).
 * Liên quan: services/auth.service.js, utils/cookie.js, routes/auth.routes.js.
 */
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok, fail } from "../utils/response.js";
import {
  setTokenCookies,
  setAccessCookie,
  clearTokenCookies,
  REFRESH_COOKIE,
} from "../utils/cookie.js";
import { logAction } from "../utils/audit.js";
import * as authService from "../services/auth.service.js";
import * as employeeService from "../services/employee.service.js";

export const login = asyncHandler(async (req, res) => {
  // Normalize: chấp nhận identifier | email | username
  const identifier = req.body.identifier || req.body.email || req.body.username;
  const { accessToken, refreshToken, user } = await authService.login({
    identifier,
    password: req.body.password,
  });
  setTokenCookies(res, { accessToken, refreshToken });
  await logAction({
    employeeId: user.employeeId,
    action: "LOGIN",
    tableName: "Employees",
    recordId: user.employeeId,
  });
  return ok(res, { user });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  await authService.verifyEmail(req.body.token);
  return ok(res, {
    message: "Xác thực email thành công. Bạn có thể đăng nhập.",
  });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  // Luôn trả success để không lộ email tồn tại
  return ok(res, {
    message: "Nếu email tồn tại, một liên kết đặt lại đã được gửi.",
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  return ok(res, { message: "Đặt lại mật khẩu thành công." });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  const { accessToken } = await authService.refreshTokens(token);
  // Chỉ cập nhật access cookie, giữ nguyên refresh
  setAccessCookie(res, accessToken);
  return ok(res, { message: "Làm mới token thành công." });
});

export const logout = asyncHandler(async (req, res) => {
  if (req.user?.sub) {
    await logAction({
      employeeId: req.user.sub,
      action: "LOGOUT",
      tableName: "Employees",
      recordId: req.user.sub,
    });
  }
  clearTokenCookies(res);
  return ok(res, { message: "Đăng xuất thành công." });
});

export const getMe = asyncHandler(async (req, res) => {
  const data = await authService.getMe(req.user.sub);
  return ok(res, data);
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    throw Object.assign(new Error("Thiếu thông tin mật khẩu"), { status: 400 });
  await employeeService.changePassword(req.user.sub, {
    currentPassword,
    newPassword,
  });
  return ok(res, { message: "Đổi mật khẩu thành công." });
});

// Giữ để không break routes cũ (đã thay thế hết)
export const postLogin = login;
export const postVerifyEmail = verifyEmail;
export const postForgotPassword = forgotPassword;
export const postResetPassword = resetPassword;
export const postRefresh = refresh;
export const postLogout = logout;
