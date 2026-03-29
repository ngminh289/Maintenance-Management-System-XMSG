/**
 * requirePermission.js — Kiểm tra quyền chi tiết theo bảng Roles_Permissions.
 * Thay thế requireLevel cho các route cần RBAC nghiêm ngặt.
 *
 * Cách dùng:
 *   requirePermission('ASSET', 'CREATE')
 *   requirePermission('WORK_ORDER', 'APPROVE')
 *
 * ResourceType: ASSET | WORK_ORDER | DIGITAL_ASSET | MAINTENANCE_PLAN
 *               CHECKLIST_TEMPLATE | CHECKLIST_RESULT | RUNTIME_LOG
 *               EMPLOYEE | TAG | WORKFLOW | REPORT
 * PermissionName: CREATE | READ | UPDATE | DELETE | APPROVE | EXPORT
 *
 * Liên quan: middleware/auth.middleware.js (chạy trước), models/Roles_Permissions table.
 */
import { getPool }     from '../config/database.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createError }  from '../utils/createError.js';

export function requirePermission(resource, action) {
  return asyncHandler(async (req, _res, next) => {
    const positionId = req.user?.positionId;
    if (!positionId) throw createError('Chưa xác thực', 401);

    const [rows] = await getPool().query(
      `SELECT 1 FROM Roles_Permissions
       WHERE PositionID = ? AND ResourceType = ? AND PermissionName = ?
       LIMIT 1`,
      [positionId, resource, action],
    );

    if (!rows.length) {
      throw createError(
        `Chức vụ của bạn không có quyền [${action}] trên [${resource}]`,
        403,
      );
    }
    next();
  });
}
