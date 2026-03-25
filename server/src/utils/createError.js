/**
 * createError.js — Tạo Error có status code chuẩn để errorHandler xử lý.
 * Dùng trong: tất cả services khi throw lỗi nghiệp vụ.
 */
export function createError(message, status = 500) {
  const err = new Error(message);
  err.status = status;
  return err;
}
