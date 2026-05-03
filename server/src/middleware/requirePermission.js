/**
 * requirePermission.js — Kiểm tra quyền chi tiết theo bảng Roles_Permissions.
 * Thay thế requireLevel cho các route cần RBAC nghiêm ngặt.
 *
 * Cách dùng:
 *   requirePermission('ASSET', 'CREATE')
 *   requirePermission('WORK_ORDER', 'APPROVE')
 *   requirePermissionAny('DOCUMENT_FEEDBACK', ['READ', 'UPDATE'])
 *
 * ResourceType: ASSET | WORK_ORDER | DIGITAL_ASSET | MAINTENANCE_PLAN
 *               CHECKLIST_TEMPLATE | CHECKLIST_RESULT | RUNTIME_LOG
 *               EMPLOYEE | TAG | WORKFLOW | REPORT | DOCUMENT_CATEGORY | DOCUMENT_FEEDBACK
 * PermissionName: CREATE | READ | UPDATE | DELETE | APPROVE | EXPORT | SUBMIT
 *
 * Liên quan: middleware/auth.middleware.js (chạy trước), models/Roles_Permissions table.
 */
import { getPool } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createError } from "../utils/createError.js";

/** Kiểm tra một quyền (dùng cho middleware tùy biến, ví dụ POST /approvals/submit). */
export async function hasPermission(positionId, resource, action) {
  if (!positionId) return false;
  const [rows] = await getPool().query(
    `SELECT 1 FROM Roles_Permissions
     WHERE PositionID = ? AND ResourceType = ? AND PermissionName = ?
     LIMIT 1`,
    [positionId, resource, action],
  );
  return rows.length > 0;
}

export function requirePermission(resource, action) {
  return asyncHandler(async (req, _res, next) => {
    const positionId = req.user?.positionId;
    if (!positionId) throw createError("Chưa xác thực", 401);

    const ok = await hasPermission(positionId, resource, action);
    if (!ok) {
      throw createError(
        `Chức vụ của bạn không có quyền [${action}] trên [${resource}]`,
        403,
      );
    }
    next();
  });
}

/** Một trong các quyền (vd. READ hoặc UPDATE cho inbox phản hồi). */
export function requirePermissionAny(resource, actions) {
  const list = Array.isArray(actions) ? actions : [];
  return asyncHandler(async (req, _res, next) => {
    const positionId = req.user?.positionId;
    if (!positionId) throw createError("Chưa xác thực", 401);
    for (const action of list) {
      if (await hasPermission(positionId, resource, action)) {
        return next();
      }
    }
    throw createError(
      `Chức vụ của bạn không có quyền phù hợp trên [${resource}]`,
      403,
    );
  });
}
