/**
 * cookie.js — Helper set/clear httpOnly cookie cho accessToken & refreshToken.
 * function.rule: JWT + refreshToken lưu httpOnly cookie.
 * Dùng trong: controllers/auth.controller.js.
 */
import { env } from '../config/env.js';

const SECURE = env.nodeEnv === 'production';
export const ACCESS_COOKIE = 'accessToken';
export const REFRESH_COOKIE = 'refreshToken';
export const REFRESH_COOKIE_PATH = '/api/auth/refresh';

const ACCESS_MAX_AGE = 15 * 60 * 1000;       // 15 phút
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 ngày

const BASE_OPTS = { httpOnly: true, sameSite: 'lax', secure: SECURE };

export function setTokenCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...BASE_OPTS, maxAge: ACCESS_MAX_AGE });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...BASE_OPTS,
    maxAge: REFRESH_MAX_AGE,
    path: REFRESH_COOKIE_PATH,
  });
}

export function clearTokenCookies(res) {
  res.clearCookie(ACCESS_COOKIE, BASE_OPTS);
  res.clearCookie(REFRESH_COOKIE, { ...BASE_OPTS, path: REFRESH_COOKIE_PATH });
}
