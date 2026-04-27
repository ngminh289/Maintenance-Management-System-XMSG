/**
 * approval.api.js — Client gọi /api/approvals.
 * Backend map hành động: POST /:logId/approve | /reject | /request-changes
 * (không có /:logId/action — tránh 404 / lỗi giả).
 */
import { api } from './index.js';

export const approvalApi = {
  getPending: (params) => api.get('/approvals/pending', { params }),

  /** Thứ tự (resourceId, resourceType) giữ tương thích WorkOrderDetailPage. */
  getHistory: (resourceId, resourceType) =>
    api.get(`/approvals/history/${resourceType}/${resourceId}`),

  submit: (data) => api.post('/approvals/submit', data),

  /**
   * Duyệt / từ chối / yêu cầu chỉnh sửa theo logId (ApprovalLogs.LogID, không phải ScheduleID/WO_ID).
   * @param {number} logId
   * @param {{ action: 'APPROVED'|'REJECTED'|'REQUEST_CHANGES', comment?: string, assignEmployeeId?: number, assignGroupId?: number, estimatedHours?: number|string, plannedDate?: string, priority?: string, description?: string }} data
   */
  action: (logId, { action, comment, assignEmployeeId, assignGroupId, estimatedHours, plannedDate, priority, description }) => {
    const body = {
      comment: comment || undefined,
      ...(assignEmployeeId != null && assignEmployeeId !== ''
        ? { assignEmployeeId: Number(assignEmployeeId) }
        : {}),
      ...(assignGroupId != null && assignGroupId !== ''
        ? { assignGroupId: Number(assignGroupId) }
        : {}),
      ...(estimatedHours !== undefined &&
      estimatedHours !== null &&
      String(estimatedHours).trim() !== ''
        ? { estimatedHours: Number(String(estimatedHours).replace(',', '.')) }
        : {}),
      ...(plannedDate !== undefined &&
      plannedDate !== null &&
      String(plannedDate).trim() !== ''
        ? { plannedDate: String(plannedDate).trim() }
        : {}),
      ...(priority && String(priority).trim() !== '' ? { priority: String(priority).trim().toUpperCase() } : {}),
      ...(description !== undefined ? { description } : {}),
    };
    if (action === 'APPROVED') {
      return api.post(`/approvals/${logId}/approve`, body);
    }
    if (action === 'REJECTED') {
      return api.post(`/approvals/${logId}/reject`, body);
    }
    if (action === 'REQUEST_CHANGES') {
      return api.post(`/approvals/${logId}/request-changes`, body);
    }
    return Promise.reject(new Error(`Hành động phê duyệt không hợp lệ: ${action}`));
  },
};
