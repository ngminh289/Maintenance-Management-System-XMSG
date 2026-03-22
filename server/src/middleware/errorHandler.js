/**
 * errorHandler.js — Bắt lỗi toàn cục; không lộ chi tiết stack ra client (production).
 */
import { env } from '../config/env.js';
import { fail } from '../utils/response.js';

export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message =
    status === 500 && env.nodeEnv === 'production'
      ? 'Lỗi máy chủ'
      : err.message || 'Lỗi không xác định';
  if (env.nodeEnv !== 'production') {
    console.error(err);
  }
  return fail(res, message, status);
}
