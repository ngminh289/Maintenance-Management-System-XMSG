/**
 * approval.service.js — Luồng phê duyệt đa cấp (WorkOrder, DigitalAsset, MaintenancePlan).
 * luongpheduyet.rule: PENDING_APPROVAL → cấp duyệt → APPROVED/REJECTED.
 * WO Routing (Workflow sheet 2.2):
 *   - Source SCHEDULE / Priority LOW|MEDIUM → Workflow thông thường (tên mẫu: Phê duyệt Work Order thông thường)
 *   - PREDICTIVE|CORRECTIVE / HIGH|EMERGENCY → WO khẩn: 2 bước — Position 3 (Trưởng ca) rồi Position 6 (Trưởng phòng)
 * Duyệt WO bước cuối: có thể kèm assignEmployeeId → phân công hiện trường ngay (tuỳ chọn).
 * Liên quan: models/approvalLog.model.js, workOrderFieldAssign.service.js.
 */
import { getPool } from '../config/database.js';
import { createError } from '../utils/createError.js';
import * as model from '../models/approvalLog.model.js';
import * as notifService from './notification.service.js';
import * as employeeModel from '../models/employee.model.js';
import { assignFieldTechnicianToWorkOrder } from './workOrderFieldAssign.service.js';

// Mapping ResourceType → trạng thái khi approved/rejected/revise
const STATUS_MAP = {
  WORK_ORDER:       { table: 'WorkOrders',          idCol: 'WO_ID',          approved: 'WAITING',   rejected: 'CANCELLED', revise: null },
  DIGITAL_ASSET:    { table: 'DigitalAssets',        idCol: 'DigitalAssetID', approved: 'APPROVED',  rejected: 'REJECTED',  revise: 'DRAFT' },
  MAINTENANCE_PLAN: { table: 'MaintenanceSchedules', idCol: 'ScheduleID',     approved: 'PENDING',   rejected: 'REJECTED',  revise: 'DRAFT' },
};

async function updateResourceStatus(resourceType, resourceId, status) {
  const map = STATUS_MAP[resourceType];
  if (!map || !status) return;
  await getPool().query(
    `UPDATE ${map.table} SET Status = ? WHERE ${map.idCol} = ?`,
    [status, resourceId],
  );
}

async function notifyApproversForStep(workflowId, level, message) {
  const step = await model.getWorkflowStep(workflowId, level);
  if (!step) return;
  const [rows] = await getPool().query(
    'SELECT EmployeeID AS employeeId FROM Employees WHERE PositionID = ? AND IsActive = TRUE',
    [step.positionId],
  );
  for (const r of rows) {
    await notifService.send(r.employeeId, message, 'APPROVAL_REQUEST');
  }
}

/**
 * Chọn WorkflowID phù hợp cho WorkOrder dựa trên source và priority.
 * - SCHEDULE / LOW|MEDIUM → workflow thông thường (Trưởng ca → Trưởng phòng)
 * - PREDICTIVE | CORRECTIVE / HIGH|EMERGENCY → workflow khẩn (bước 1 = Position 3, bước 2 = Position 6)
 */
async function getWorkflowForWO(woSource, priority) {
  const isUrgent = ['PREDICTIVE', 'CORRECTIVE'].includes(woSource)
    || ['HIGH', 'EMERGENCY'].includes(priority);

  const workflowName = isUrgent
    ? 'Phê duyệt WO khẩn cấp'
    : 'Phê duyệt Work Order thông thường';

  const [rows] = await getPool().query(
    'SELECT WorkflowID AS workflowId, TotalLevels AS totalLevels FROM WorkflowTemplates WHERE WorkflowName = ? AND DocumentType = ? LIMIT 1',
    [workflowName, 'WORK_ORDER'],
  );

  // Fallback: lấy workflow WORK_ORDER đầu tiên
  if (!rows[0]) {
    return model.getDefaultWorkflow('WORK_ORDER');
  }
  return rows[0];
}

/** Gửi tài nguyên vào luồng phê duyệt — tạo ApprovalLog cấp 1 */
export async function submit({ resourceType, resourceId, submitterId, workflowId: wfId, woSource, woPriority }) {
  let wf;
  if (wfId) {
    const [rows] = await getPool().query(
      'SELECT WorkflowID AS workflowId, TotalLevels AS totalLevels FROM WorkflowTemplates WHERE WorkflowID = ?',
      [wfId],
    );
    wf = rows[0];
  } else if (resourceType === 'WORK_ORDER' && (woSource || woPriority)) {
    // Smart routing theo source/priority của WO
    wf = await getWorkflowForWO(woSource, woPriority);
  } else {
    wf = await model.getDefaultWorkflow(resourceType);
  }

  if (!wf) throw createError(`Không tìm thấy workflow cho ${resourceType}`, 404);

  if (await model.hasPendingForResource(resourceId, resourceType)) {
    throw createError('Đã có yêu cầu phê duyệt đang chờ xử lý cho tài nguyên này', 400);
  }

  const logId = await model.create({
    resourceId, resourceType,
    workflowId: wf.workflowId,
    submittedBy: submitterId,
    currentLevel: 1,
    status: 'PENDING',
  });

  await notifyApproversForStep(wf.workflowId, 1, `Có yêu cầu phê duyệt mới (${resourceType} #${resourceId})`);
  return logId;
}

async function verifyApprover(log, approverId) {
  const step = await model.getWorkflowStep(log.workflowId, log.currentLevel);
  if (!step) throw createError('Không tìm thấy bước phê duyệt', 404);

  const emp = await employeeModel.findById(approverId);
  if (!emp) throw createError('Không tìm thấy nhân viên', 404);
  if (emp.positionId !== step.positionId) throw createError('Bạn không có quyền phê duyệt bước này', 403);
  return { emp, step };
}

/** Duyệt — cấp cuối: cập nhật resource; với WORK_ORDER có thể kèm assignEmployeeId (phân công L1/L2 ngay). */
export async function approve({ logId, approverId, comment, assignEmployeeId }) {
  const log = await model.findById(logId);
  if (!log) throw createError('Không tìm thấy approval log', 404);
  if (log.status !== 'PENDING') throw createError('Log này đã được xử lý', 400);

  await verifyApprover(log, approverId);
  await model.update(logId, { approverId, status: 'APPROVED', comment });

  if (log.currentLevel < log.totalLevels) {
    // Tạo log cho cấp tiếp theo
    const nextLogId = await model.create({
      resourceId: log.resourceId, resourceType: log.resourceType,
      workflowId: log.workflowId, submittedBy: log.submittedBy,
      currentLevel: log.currentLevel + 1, status: 'PENDING',
    });
    await notifyApproversForStep(log.workflowId, log.currentLevel + 1,
      `Yêu cầu phê duyệt cấp ${log.currentLevel + 1} (${log.resourceType} #${log.resourceId})`);
    return { nextLogId };
  }

  // Cấp cuối cùng → cập nhật resource
  await updateResourceStatus(log.resourceType, log.resourceId, STATUS_MAP[log.resourceType]?.approved);

  // Khi WO CORRECTIVE được duyệt hoàn tất → máy chuyển sang MAINTENANCE (đang sửa chữa)
  // Khi WO hoàn thành (changeStatus COMPLETED) → asset sẽ chuyển về AVAILABLE
  if (log.resourceType === 'WORK_ORDER') {
    const [woRows] = await getPool().query(
      'SELECT AssetID AS assetId, WO_Source AS woSource FROM WorkOrders WHERE WO_ID = ?',
      [log.resourceId],
    );
    const wo = woRows[0];
    if (wo?.assetId && wo.woSource === 'CORRECTIVE') {
      await getPool().query(
        "UPDATE Assets SET Status = 'MAINTENANCE' WHERE AssetID = ?",
        [wo.assetId],
      );
    }
  }

  // Thông báo người gửi
  if (log.submittedBy) {
    await notifService.send(log.submittedBy, `Yêu cầu của bạn (${log.resourceType} #${log.resourceId}) đã được phê duyệt`, 'APPROVAL_REQUEST');
  }

  if (log.resourceType === 'WORK_ORDER' && assignEmployeeId != null && assignEmployeeId !== '') {
    const aid = Number(assignEmployeeId);
    if (!Number.isFinite(aid) || aid < 1) throw createError('assignEmployeeId không hợp lệ', 400);
    const approverEmp = await employeeModel.findById(approverId);
    await assignFieldTechnicianToWorkOrder(log.resourceId, aid, approverEmp?.positionLevel ?? 0);
  }

  return { approved: true };
}

/** Từ chối */
export async function reject({ logId, approverId, comment }) {
  const log = await model.findById(logId);
  if (!log) throw createError('Không tìm thấy approval log', 404);
  if (log.status !== 'PENDING') throw createError('Log này đã được xử lý', 400);

  await verifyApprover(log, approverId);
  await model.update(logId, { approverId, status: 'REJECTED', comment });
  await updateResourceStatus(log.resourceType, log.resourceId, STATUS_MAP[log.resourceType]?.rejected);

  if (log.submittedBy) {
    await notifService.send(log.submittedBy, `Yêu cầu (${log.resourceType} #${log.resourceId}) đã bị từ chối. Lý do: ${comment || 'Không có'}`, 'APPROVAL_REQUEST');
  }
}

/** Yêu cầu chỉnh sửa → tài nguyên về DRAFT */
export async function requestChanges({ logId, approverId, comment }) {
  const log = await model.findById(logId);
  if (!log) throw createError('Không tìm thấy approval log', 404);
  if (log.status !== 'PENDING') throw createError('Log này đã được xử lý', 400);

  await verifyApprover(log, approverId);
  await model.update(logId, { approverId, status: 'REQUEST_CHANGES', comment });
  await updateResourceStatus(log.resourceType, log.resourceId, STATUS_MAP[log.resourceType]?.revise);

  if (log.submittedBy) {
    await notifService.send(log.submittedBy, `Yêu cầu chỉnh sửa (${log.resourceType} #${log.resourceId}): ${comment || ''}`, 'APPROVAL_REQUEST');
  }
}

export async function getPendingForMe(positionId) {
  return model.findPendingForPosition(positionId);
}

export async function getHistory(resourceType, resourceId) {
  return model.findByResource(resourceId, resourceType);
}
