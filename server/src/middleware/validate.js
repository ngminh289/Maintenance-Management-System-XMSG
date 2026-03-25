/**
 * validate.js — Middleware validation đơn giản (schema là function trả chuỗi lỗi | null).
 * Dùng trong: tất cả routes trước controller.
 */
import { fail } from '../utils/response.js';

export function validate(schemaFn) {
  return (req, res, next) => {
    const error = schemaFn(req.body);
    if (error) return fail(res, error, 400);
    return next();
  };
}
