/**
 * approval.controller.js — HTTP handler: /api/approvals.
 * Liên quan: services/approval.service.js, routes/approval.routes.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/approval.service.js';

/** Danh sách pending approval của user hiện tại */
export const getPending = asyncHandler(async (req, res) =>
  ok(res, await service.getPendingForMe(req.user.positionId, req.user.positionLevel)));

/** Lịch sử phê duyệt của một tài nguyên */
export const getHistory = asyncHandler(async (req, res) => {
  const { resourceType, resourceId } = req.params;
  return ok(res, await service.getHistory(resourceType, resourceId));
});

/** Gửi duyệt thủ công; WO: có thể gửi lại sau REQUEST_CHANGES (body tuỳ chọn woSource, woPriority). */
export const submit = asyncHandler(async (req, res) => {
  const { resourceType, resourceId, workflowId, woSource, woPriority } = req.body;
  const logId = await service.submit({
    resourceType,
    resourceId: Number(resourceId),
    submitterId: req.user.sub,
    workflowId,
    woSource,
    woPriority,
  });
  return ok(res, { logId }, 201);
});

export const approve = asyncHandler(async (req, res) =>
  ok(res, await service.approve({
    logId: Number(req.params.logId),
    approverId: req.user.sub,
    comment: req.body.comment,
    assignEmployeeId: req.body.assignEmployeeId,
    assignGroupId: req.body.assignGroupId,
    estimatedHours: req.body.estimatedHours,
    plannedDate: req.body.plannedDate,
    priority: req.body.priority,
    description: req.body.description,
  })));

export const reject = asyncHandler(async (req, res) => {
  await service.reject({ logId: Number(req.params.logId), approverId: req.user.sub, comment: req.body.comment });
  return ok(res, { message: 'Đã từ chối.' });
});

export const requestChanges = asyncHandler(async (req, res) => {
  await service.requestChanges({ logId: Number(req.params.logId), approverId: req.user.sub, comment: req.body.comment });
  return ok(res, { message: 'Đã yêu cầu chỉnh sửa.' });
});
