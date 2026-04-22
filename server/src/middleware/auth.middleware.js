/**
 * auth.middleware.js — Đọc JWT access từ cookie httpOnly hoặc header Authorization Bearer.
 * function.rule: accessToken lưu httpOnly cookie.
 * Dùng trong: tất cả routes yêu cầu xác thực.
 * Liên quan: config/jwt.js, utils/cookie.js.
 */
import { verifyAccessToken } from '../config/jwt.js';
import { fail } from '../utils/response.js';

const ACCESS_COOKIE = 'accessToken';

/** Có JWT (header hoặc cookie) thì gán req.user; lỗi token → bỏ qua (khách). Dùng GET /uploads/documents. */
export function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization;
    const bearer =
      header && header.startsWith('Bearer ') ? header.slice(7) : null;
    const fromCookie = req.cookies?.[ACCESS_COOKIE];
    const token = bearer || fromCookie;
    if (token) {
      req.user = verifyAccessToken(token);
    }
  } catch {
    /* không đăng nhập hoặc token hết hạn — vẫn cho tải file công khai */
  }
  next();
}

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    const bearer =
      header && header.startsWith('Bearer ') ? header.slice(7) : null;
    const fromCookie = req.cookies?.[ACCESS_COOKIE];
    const token = bearer || fromCookie;
    if (!token) {
      return fail(res, 'Chưa đăng nhập', 401);
    }
    const payload = verifyAccessToken(token);
    req.user = payload;
    return next();
  } catch {
    return fail(res, 'Token không hợp lệ hoặc hết hạn', 401);
  }
}
