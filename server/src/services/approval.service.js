/**
 * approval.service.js — Luồng phê duyệt đa cấp (WorkOrder, DigitalAsset, MaintenancePlan).
 * luongpheduyet.rule: PENDING_APPROVAL → cấp duyệt → APPROVED/REJECTED.
 * WO Routing (Workflow sheet 2.2):
 *   - Mặc định 1 bước — Trưởng ca (workflow thông thường).
 *   - Chỉ sự cố nghiêm trọng mới 2 bước — B1 Trưởng ca → B2 Trưởng phòng (workflow khẩn):
 *     Priority = EMERGENCY, hoặc (CORRECTIVE + HIGH).
 * Duyệt WO bước cuối: có thể kèm assignEmployeeId → phân công hiện trường ngay (tuỳ chọn).
 * Trạng thái tài sản MAINTENANCE khi KTV bắt đầu thực hiện (IN_PROGRESS) — xem workOrder.service.js; không gán MAINTENANCE tại bước phê duyệt WO.
 * Phân công được validate trước khi ghi APPROVED / WAITING — tránh lỗi nghỉ phép làm “log đã xử lý”.
 * Liên quan: models/approvalLog.model.js, workOrderFieldAssign.service.js.
 */
import { getPool } from "../config/database.js";
import { createError } from "../utils/createError.js";
import * as model from "../models/approvalLog.model.js";
import * as notifService from "./notification.service.js";
import * as employeeModel from "../models/employee.model.js";
import {
  assignFieldTechnicianToWorkOrder,
  validateFieldTechnicianAssignment,
} from "./workOrderFieldAssign.service.js";

// Mapping ResourceType → trạng thái khi approved/rejected/revise
const STATUS_MAP = {
  WORK_ORDER: {
    table: "WorkOrders",
    idCol: "WO_ID",
    approved: "WAITING",
    rejected: "CANCELLED",
    /** null: giữ PENDING_APPROVAL — người có quyền sửa WO rồi POST /approvals/submit lại (từ bước 1). */
    revise: null,
  },
  DIGITAL_ASSET: {
    table: "DigitalAssets",
    idCol: "DigitalAssetID",
    approved: "APPROVED",
    rejected: "REJECTED",
    revise: "DRAFT",
  },
  MAINTENANCE_PLAN: {
    table: "MaintenanceSchedules",
    idCol: "ScheduleID",
    approved: "PENDING",
    rejected: "REJECTED",
    revise: "DRAFT",
  },
};

async function updateResourceStatus(resourceType, resourceId, status) {
  const map = STATUS_MAP[resourceType];
  if (!map || !status) return;
  await getPool().query(
    `UPDATE ${map.table} SET Status = ? WHERE ${map.idCol} = ?`,
    [status, resourceId],
  );
}

async function notifyApproversForStep(workflowId, level, message, ctx = {}) {
  const step = await model.getWorkflowStep(workflowId, level);
  if (!step) return;
  const [rows] = await getPool().query(
    "SELECT EmployeeID AS employeeId FROM Employees WHERE PositionID = ? AND IsActive = TRUE",
    [step.positionId],
  );
  for (const r of rows) {
    await notifService.send(r.employeeId, message, "APPROVAL_REQUEST", ctx);
  }
}

/**
 * 2 bước duyệt (TC → Trưởng phòng) chỉ cho sự cố nghiêm trọng:
 * - EMERGENCY (mọi nguồn), hoặc
 * - CORRECTIVE + HIGH.
 */
function workOrderNeedsTwoStepApproval(woSource, priority) {
  if (priority === "EMERGENCY") return true;
  if (woSource === "CORRECTIVE" && priority === "HIGH") return true;
  return false;
}

/**
 * Chọn WorkflowID phù hợp cho WorkOrder dựa trên source và priority.
 */
async function getWorkflowForWO(woSource, priority) {
  const workflowName = workOrderNeedsTwoStepApproval(woSource, priority)
    ? "Phê duyệt WO khẩn cấp"
    : "Phê duyệt Work Order thông thường";

  const [rows] = await getPool().query(
    "SELECT WorkflowID AS workflowId, TotalLevels AS totalLevels FROM WorkflowTemplates WHERE WorkflowName = ? AND DocumentType = ? LIMIT 1",
    [workflowName, "WORK_ORDER"],
  );

  // Fallback: lấy workflow WORK_ORDER đầu tiên
  if (!rows[0]) {
    return model.getDefaultWorkflow("WORK_ORDER");
  }
  return rows[0];
}

/** Gửi tài nguyên vào luồng phê duyệt — tạo ApprovalLog cấp 1 */
export async function submit({
  resourceType,
  resourceId,
  submitterId,
  workflowId: wfId,
  woSource,
  woPriority,
}) {
  let wf;
  if (wfId) {
    const [rows] = await getPool().query(
      "SELECT WorkflowID AS workflowId, TotalLevels AS totalLevels FROM WorkflowTemplates WHERE WorkflowID = ?",
      [wfId],
    );
    wf = rows[0];
  } else if (resourceType === "WORK_ORDER") {
    const [woRows] = await getPool().query(
      "SELECT WO_Source AS woSource, Priority AS priority FROM WorkOrders WHERE WO_ID = ?",
      [resourceId],
    );
    if (!woRows[0]) throw createError("Không tìm thấy Work Order", 404);
    const src = woSource ?? woRows[0].woSource;
    const pri = woPriority ?? woRows[0].priority;
    wf = await getWorkflowForWO(src, pri);
  } else {
    wf = await model.getDefaultWorkflow(resourceType);
  }

  if (!wf)
    throw createError(`Không tìm thấy workflow cho ${resourceType}`, 404);

  if (await model.hasPendingForResource(resourceId, resourceType)) {
    throw createError(
      "Đã có yêu cầu phê duyệt đang chờ xử lý cho tài nguyên này",
      400,
    );
  }

  const logId = await model.create({
    resourceId,
    resourceType,
    workflowId: wf.workflowId,
    submittedBy: submitterId,
    currentLevel: 1,
    status: "PENDING",
  });

  await notifyApproversForStep(
    wf.workflowId,
    1,
    `Có yêu cầu phê duyệt mới (${resourceType} #${resourceId})`,
    { resourceType, resourceId },
  );
  return logId;
}

async function verifyApprover(log, approverId) {
  const step = await model.getWorkflowStep(log.workflowId, log.currentLevel);
  if (!step) throw createError("Không tìm thấy bước phê duyệt", 404);

  const emp = await employeeModel.findById(approverId);
  if (!emp) throw createError("Không tìm thấy nhân viên", 404);
  if (emp.positionId !== step.positionId)
    throw createError("Bạn không có quyền phê duyệt bước này", 403);
  return { emp, step };
}

/** Duyệt — cấp cuối: cập nhật resource; với WORK_ORDER có thể kèm assignEmployeeId (phân công L1/L2 ngay). */
export async function approve({
  logId,
  approverId,
  comment,
  assignEmployeeId,
}) {
  const log = await model.findById(logId);
  if (!log) throw createError("Không tìm thấy approval log", 404);
  if (log.status !== "PENDING") throw createError("Log này đã được xử lý", 400);

  await verifyApprover(log, approverId);

  if (log.currentLevel < log.totalLevels) {
    await model.update(logId, { approverId, status: "APPROVED", comment });
    // Tạo log cho cấp tiếp theo
    const nextLogId = await model.create({
      resourceId: log.resourceId,
      resourceType: log.resourceType,
      workflowId: log.workflowId,
      submittedBy: log.submittedBy,
      currentLevel: log.currentLevel + 1,
      status: "PENDING",
    });
    await notifyApproversForStep(
      log.workflowId,
      log.currentLevel + 1,
      `Yêu cầu phê duyệt cấp ${log.currentLevel + 1} (${log.resourceType} #${log.resourceId})`,
    );
    return { nextLogId };
  }

  // Cấp cuối — kiểm tra phân công WO (nghỉ phép / PlannedDate) trước khi ghi log & WAITING
  let assigneeIdForWo = null;
  let approverLevelForAssign = 0;
  if (
    log.resourceType === "WORK_ORDER" &&
    assignEmployeeId != null &&
    assignEmployeeId !== ""
  ) {
    assigneeIdForWo = Number(assignEmployeeId);
    if (!Number.isFinite(assigneeIdForWo) || assigneeIdForWo < 1) {
      throw createError("assignEmployeeId không hợp lệ", 400);
    }
    const approverEmp = await employeeModel.findById(approverId);
    approverLevelForAssign = approverEmp?.positionLevel ?? 0;
    await validateFieldTechnicianAssignment(
      log.resourceId,
      assigneeIdForWo,
      approverLevelForAssign,
    );
  }

  await model.update(logId, { approverId, status: "APPROVED", comment });

  // Cấp cuối cùng → cập nhật resource
  await updateResourceStatus(
    log.resourceType,
    log.resourceId,
    STATUS_MAP[log.resourceType]?.approved,
  );

  // Thông báo người gửi (+ BFD 4: tài liệu số → KTV đã từng được phân công WO trên cùng tài sản)
  let submitterMessage = `Yêu cầu của bạn (${log.resourceType} #${log.resourceId}) đã được phê duyệt`;

  if (log.resourceType === "DIGITAL_ASSET") {
    const [daRows] = await getPool().query(
      `SELECT da.FileName AS fileName, da.AssetID AS assetId, a.AssetName AS assetName
       FROM DigitalAssets da
       LEFT JOIN Assets a ON a.AssetID = da.AssetID
       WHERE da.DigitalAssetID = ?`,
      [log.resourceId],
    );
    const d = daRows[0];
    if (d?.fileName) {
      submitterMessage = d.assetId
        ? `Tài liệu "${d.fileName}" đã ban hành — truy xuất qua QR / trang tài sản "${d.assetName || `ID ${d.assetId}`}".`
        : `Tài liệu "${d.fileName}" đã được phê duyệt và đưa vào kho dùng chung.`;
    }
    if (d?.assetId) {
      const [assignRows] = await getPool().query(
        `SELECT DISTINCT wa.EmployeeID AS employeeId
         FROM WO_Assignments wa
         INNER JOIN WorkOrders w ON w.WO_ID = wa.WO_ID
         WHERE w.AssetID = ?`,
        [d.assetId],
      );
      const assetLabel = d.assetName || `ID ${d.assetId}`;
      const fieldMsg = `Có tài liệu kỹ thuật mới cho tài sản "${assetLabel}" — quét QR tại máy để xem.`;
      const notifySet = new Set(
        assignRows.map((r) => r.employeeId).filter((id) => id != null),
      );
      if (log.submittedBy) notifySet.delete(log.submittedBy);
      await Promise.all(
        [...notifySet].map((eid) =>
          notifService.send(eid, fieldMsg, "SYSTEM_ALERT", { resourceType: "DIGITAL_ASSET", resourceId: log.resourceId }),
        ),
      );
    }
  }

  if (log.submittedBy) {
    await notifService.send(log.submittedBy, submitterMessage, "APPROVAL_REQUEST", { resourceType: log.resourceType, resourceId: log.resourceId });
  }

  if (assigneeIdForWo != null) {
    await assignFieldTechnicianToWorkOrder(
      log.resourceId,
      assigneeIdForWo,
      approverLevelForAssign,
      { skipValidation: true },
    );
  }

  return { approved: true };
}

/** Từ chối */
export async function reject({ logId, approverId, comment }) {
  const log = await model.findById(logId);
  if (!log) throw createError("Không tìm thấy approval log", 404);
  if (log.status !== "PENDING") throw createError("Log này đã được xử lý", 400);

  await verifyApprover(log, approverId);
  await model.update(logId, { approverId, status: "REJECTED", comment });
  await updateResourceStatus(
    log.resourceType,
    log.resourceId,
    STATUS_MAP[log.resourceType]?.rejected,
  );

  if (log.submittedBy) {
    await notifService.send(
      log.submittedBy,
      `Yêu cầu (${log.resourceType} #${log.resourceId}) đã bị từ chối. Lý do: ${comment || "Không có"}`,
      "APPROVAL_REQUEST",
      { resourceType: log.resourceType, resourceId: log.resourceId },
    );
  }
}

/** Yêu cầu chỉnh sửa — DAM/Lịch về DRAFT; WO giữ PENDING_APPROVAL (sửa phiếu + submit lại). */
export async function requestChanges({ logId, approverId, comment }) {
  const log = await model.findById(logId);
  if (!log) throw createError("Không tìm thấy approval log", 404);
  if (log.status !== "PENDING") throw createError("Log này đã được xử lý", 400);

  await verifyApprover(log, approverId);
  await model.update(logId, { approverId, status: "REQUEST_CHANGES", comment });
  await updateResourceStatus(
    log.resourceType,
    log.resourceId,
    STATUS_MAP[log.resourceType]?.revise,
  );

  if (log.submittedBy) {
    await notifService.send(
      log.submittedBy,
      `Yêu cầu chỉnh sửa (${log.resourceType} #${log.resourceId}): ${comment || ""}`,
      "APPROVAL_REQUEST",
      { resourceType: log.resourceType, resourceId: log.resourceId },
    );
  }
}

export async function getPendingForMe(positionId) {
  return model.findPendingForPosition(positionId);
}

export async function getHistory(resourceType, resourceId) {
  const logs = await model.findByResource(resourceId, resourceType);
  const wfId = logs.find((l) => l.workflowId)?.workflowId;
  const workflowSteps = wfId
    ? await model.listWorkflowStepRoles(wfId)
    : [];
  return { logs, workflowSteps };
}
