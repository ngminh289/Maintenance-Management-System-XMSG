/**
 * asyncHandler.js — Bọc async controller, tự động chuyển lỗi sang errorHandler.
 * Dùng trong: tất cả controllers.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
