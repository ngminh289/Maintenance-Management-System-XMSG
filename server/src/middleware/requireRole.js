/**
 * requireRole.js — Kiểm tra cấp độ chức vụ (RBAC đơn giản dựa Level từ Positions).
 * Level: 1 = NV | 2 = Trưởng nhóm | 3 = Quản lý | 4+ = Quản trị / Ban GĐ.
 * Dùng sau requireAuth trong: các routes cần phân quyền.
 */
import { fail } from '../utils/response.js';

export function requireLevel(minLevel) {
  return (req, res, next) => {
    if (!req.user) return fail(res, 'Chưa xác thực', 401);
    if ((req.user.positionLevel ?? 0) < minLevel) {
      return fail(res, 'Không đủ quyền thực hiện hành động này', 403);
    }
    return next();
  };
}
