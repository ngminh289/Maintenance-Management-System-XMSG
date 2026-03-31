/**
 * approval.routes.js — /api/approvals.
 * Luồng: submit → approve/reject/request-changes theo cấp.
 * POST /submit: requireInitApprovalFlow (MAINTENANCE_PLAN|DIGITAL_ASSET → SUBMIT; WORK_ORDER → CREATE).
 * Liên quan: controllers/approval.controller.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireLevel } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { requireInitApprovalFlow } from '../middleware/requireInitApprovalFlow.js';
import * as ctrl from '../controllers/approval.controller.js';

function approvalActionSchema(body) {
  if (body.comment !== undefined && typeof body.comment !== 'string') return 'Comment phải là chuỗi';
  if (body.assignEmployeeId !== undefined && body.assignEmployeeId !== null && body.assignEmployeeId !== '') {
    if (isNaN(Number(body.assignEmployeeId))) return 'assignEmployeeId phải là số';
  }
  return null;
}
function submitSchema(body) {
  if (!body.resourceType || !['WORK_ORDER', 'DIGITAL_ASSET', 'MAINTENANCE_PLAN'].includes(body.resourceType)) {
    return 'ResourceType không hợp lệ';
  }
  if (!body.resourceId || isNaN(Number(body.resourceId))) return 'ResourceID không hợp lệ';
  return null;
}

export const approvalRouter = Router();

approvalRouter.use(requireAuth);

// Danh sách chờ duyệt của tôi (theo positionId từ JWT)
approvalRouter.get('/pending', ctrl.getPending);

// Lịch sử phê duyệt của một tài nguyên
approvalRouter.get('/history/:resourceType/:resourceId', ctrl.getHistory);

// Gửi duyệt thủ công — quyền theo loại tài nguyên (BFD 4.1: SUBMIT / CREATE)
approvalRouter.post('/submit', validate(submitSchema), requireInitApprovalFlow, ctrl.submit);

// Hành động phê duyệt: Trưởng ca trở lên (NV Kỹ thuật L2 không duyệt — verifyApprover + workflow cũng khớp Position bước duyệt)
approvalRouter.post('/:logId/approve',          requireLevel(3), validate(approvalActionSchema), ctrl.approve);
approvalRouter.post('/:logId/reject',            requireLevel(3), validate(approvalActionSchema), ctrl.reject);
approvalRouter.post('/:logId/request-changes',   requireLevel(3), validate(approvalActionSchema), ctrl.requestChanges);
