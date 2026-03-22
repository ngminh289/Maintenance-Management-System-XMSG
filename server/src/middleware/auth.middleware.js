/**
 * auth.middleware.js — Đọc JWT access từ cookie httpOnly hoặc header Authorization.
 * Dùng sau khi triển khai đăng nhập (function.rule).
 */
import { verifyAccessToken } from '../config/jwt.js';
import { fail } from '../utils/response.js';

const ACCESS_COOKIE = 'accessToken';

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
