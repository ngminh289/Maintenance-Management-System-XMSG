/**
 * requireInitApprovalFlow.js — POST /approvals/submit: quyền theo BFD 4.1 (SUBMIT / CREATE).
 * WORK_ORDER → CREATE; DIGITAL_ASSET | MAINTENANCE_PLAN → SUBMIT.
 * Liên quan: routes/approval.routes.js, middleware/requirePermission.js (hasPermission).
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { createError }  from '../utils/createError.js';
import { hasPermission } from './requirePermission.js';

const INIT_RULE = {
  WORK_ORDER:       ['WORK_ORDER', 'CREATE'],
  DIGITAL_ASSET:    ['DIGITAL_ASSET', 'SUBMIT'],
  MAINTENANCE_PLAN: ['MAINTENANCE_PLAN', 'SUBMIT'],
};

export const requireInitApprovalFlow = asyncHandler(async (req, _res, next) => {
  const resourceType = req.body?.resourceType;
  const pair = INIT_RULE[resourceType];
  if (!pair) throw createError('Loại tài nguyên không hỗ trợ khởi tạo luồng phê duyệt', 400);

  const allowed = await hasPermission(req.user.positionId, pair[0], pair[1]);
  if (!allowed) {
    throw createError(
      'Không có quyền khởi tạo luồng phê duyệt cho loại tài nguyên này (BFD 4.1).',
      403,
    );
  }
  next();
});
