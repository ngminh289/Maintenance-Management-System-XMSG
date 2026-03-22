/**
 * notFound.js — 404 cho route không tồn tại.
 */
import { fail } from '../utils/response.js';

export function notFoundHandler(req, res) {
  return fail(res, 'Không tìm thấy tài nguyên', 404);
}
