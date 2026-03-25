/**
 * approval.controller.js — HTTP handler: /api/approvals.
 * Liên quan: services/approval.service.js, routes/approval.routes.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/approval.service.js';

/** Danh sách pending approval của user hiện tại */
export const getPending = asyncHandler(async (req, res) =>
  ok(res, await service.getPendingForMe(req.user.positionId)));

/** Lịch sử phê duyệt của một tài nguyên */
export const getHistory = asyncHandler(async (req, res) => {
  const { resourceType, resourceId } = req.params;
  return ok(res, await service.getHistory(resourceType, resourceId));
});

/** Gửi duyệt thủ công (DigitalAsset/MaintenancePlan — WO tự động gửi khi tạo) */
export const submit = asyncHandler(async (req, res) => {
  const { resourceType, resourceId, workflowId } = req.body;
  const logId = await service.submit({ resourceType, resourceId, submitterId: req.user.sub, workflowId });
  return ok(res, { logId }, 201);
});

export const approve = asyncHandler(async (req, res) =>
  ok(res, await service.approve({ logId: Number(req.params.logId), approverId: req.user.sub, comment: req.body.comment })));

export const reject = asyncHandler(async (req, res) => {
  await service.reject({ logId: Number(req.params.logId), approverId: req.user.sub, comment: req.body.comment });
  return ok(res, { message: 'Đã từ chối.' });
});

export const requestChanges = asyncHandler(async (req, res) => {
  await service.requestChanges({ logId: Number(req.params.logId), approverId: req.user.sub, comment: req.body.comment });
  return ok(res, { message: 'Đã yêu cầu chỉnh sửa.' });
});
