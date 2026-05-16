/**
 * approval.service.js — Luồng phê duyệt đa cấp (WorkOrder, DigitalAsset, MaintenancePlan).
 * luongpheduyet.rule: PENDING_APPROVAL → cấp duyệt → APPROVED/REJECTED.
 * WO Routing (Workflow sheet 2.2):
 *   - Mặc định 1 bước — Trưởng ca (workflow thông thường).
 *   - Chỉ sự cố nghiêm trọng mới 2 bước — B1 Trưởng ca → B2 Trưởng phòng (workflow khẩn):
 *     Priority = EMERGENCY, hoặc (CORRECTIVE + HIGH).
 * Duyệt WO bước cuối: có thể kèm assignEmployeeId → phân công hiện trường ngay (tuỳ chọn).
 * Body estimatedHours: cập nhật WorkOrders.EstimatedHours khi duyệt APPROVED (mọi bước WO).
 * Trạng thái tài sản MAINTENANCE khi KTV bắt đầu thực hiện (IN_PROGRESS) — xem workOrder.service.js; không gán MAINTENANCE tại bước phê duyệt WO.
 * Phân công được validate trước khi ghi APPROVED / WAITING — tránh lỗi nghỉ phép làm “log đã xử lý”.
 * Cùng cấp phó (8↔6, 9↔7) duyệt thay; bước Trưởng ca (3) giữ 1 bước.
 * Liên quan: models/approvalLog.model.js, workOrderFieldAssign.service.js; migration 055.
 */
import { getPool } from "../config/database.js";
import { createError } from "../utils/createError.js";
import * as model from "../models/approvalLog.model.js";
import * as notifService from "./notification.service.js";
import * as employeeModel from "../models/employee.model.js";
import {
  assignFieldTechnicianToWorkOrder,
  assignGroupToWorkOrder,
  validateGroupAssignment,
  validateFieldTechnicianAssignment,
} from "./workOrderFieldAssign.service.js";
import * as workOrderModel from "../models/workOrder.model.js";

const PID_TP_BAO_TRI = 6;
const PID_TP_KT = 7;
const PID_PHO_BAO_TRI = 8;
const PID_PHO_KT = 9;

/**
 * Các PositionID được ghi nhận khi duyệt bước `stepPositionId` (trưởng + phó cùng tuyến).
 */
function approverPidsForStep(stepPositionId) {
  const s = Number(stepPositionId);
  if (s === PID_TP_BAO_TRI) return [PID_TP_BAO_TRI, PID_PHO_BAO_TRI];
  if (s === PID_TP_KT) return [PID_TP_KT, PID_PHO_KT];
  return [s];
}

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
  const pids = approverPidsForStep(step.positionId);
  const [rows] = await getPool().query(
    `SELECT EmployeeID AS employeeId FROM Employees
     WHERE PositionID IN (${pids.map(() => "?").join(",")}) AND IsActive = TRUE`,
    pids,
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

function parseApprovalYmd(v) {
  if (v == null || String(v).trim() === "") return null;
  const s = String(v).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function parsePriority(v) {
  if (v == null || String(v).trim() === "") return null;
  const p = String(v).trim().toUpperCase();
  return ["LOW", "MEDIUM", "HIGH", "EMERGENCY"].includes(p) ? p : null;
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
      "SELECT WO_Source AS woSource, Priority AS priority FROM WorkOrders WHERE WO_ID = ? AND IsDeleted = 0",
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

/** Quản trị (L4+): chỉ xem hàng chờ — không duyệt theo workflow (không có bước Admin trong mẫu luồng). */
async function assertNotApprovalViewOnly(approverId) {
  const emp = await employeeModel.findById(approverId);
  if (!emp) throw createError("Không tìm thấy nhân viên", 404);
  if (Number(emp.positionLevel) >= 4) {
    throw createError(
      "Tài khoản quản trị chỉ được xem hàng chờ phê duyệt, không thực hiện duyệt/từ chối.",
      403,
    );
  }
}

async function verifyApprover(log, approverId) {
  await assertNotApprovalViewOnly(approverId);
  const step = await model.getWorkflowStep(log.workflowId, log.currentLevel);
  if (!step) throw createError("Không tìm thấy bước phê duyệt", 404);

  const emp = await employeeModel.findById(approverId);
  if (!emp) throw createError("Không tìm thấy nhân viên", 404);
  const allowed = new Set(approverPidsForStep(step.positionId));
  if (!allowed.has(emp.positionId)) {
    throw createError("Bạn không có quyền phê duyệt bước này", 403);
  }
  return { emp, step };
}

/** Duyệt — cấp cuối: cập nhật resource; với WORK_ORDER có thể kèm assignEmployeeId (phân công L1/L2 ngay). */
export async function approve({
  logId,
  approverId,
  comment,
  assignEmployeeId,
  assignGroupId,
  estimatedHours,
  plannedDate,
  priority,
  description,
} = {}) {
  const log = await model.findById(logId);
  if (!log) throw createError("Không tìm thấy approval log", 404);
  if (log.status !== "PENDING") throw createError("Log này đã được xử lý", 400);

  await verifyApprover(log, approverId);

  if (log.resourceType === "WORK_ORDER") {
    const woPatch = {};
    if (
      estimatedHours !== undefined &&
      estimatedHours !== null &&
      String(estimatedHours).trim() !== ""
    ) {
      const n = Number(String(estimatedHours).replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        throw createError("Giờ ước tính không hợp lệ", 400);
      }
      woPatch.estimatedHours = n;
    }
    if (plannedDate !== undefined) {
      if (plannedDate === null || String(plannedDate).trim() === "") {
        woPatch.plannedDate = null;
      } else {
        const ymd = parseApprovalYmd(plannedDate);
        if (!ymd) throw createError("Ngày dự kiến không hợp lệ (YYYY-MM-DD)", 400);
        woPatch.plannedDate = ymd;
      }
    }
    if (priority !== undefined) {
      const parsed = parsePriority(priority);
      if (!parsed) throw createError("Ưu tiên không hợp lệ", 400);
      woPatch.priority = parsed;
    }
    if (description !== undefined) {
      woPatch.description = String(description ?? "").trim() || null;
    }
    if (Object.keys(woPatch).length) {
      await workOrderModel.update(log.resourceId, woPatch);
    }
  }

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
      { resourceType: log.resourceType, resourceId: log.resourceId },
    );
    return { nextLogId };
  }

  // Cấp cuối — kiểm tra phân công WO (nghỉ phép / PlannedDate) trước khi ghi log & WAITING
  let assigneeIdForWo = null;
  let assigneeGroupIdForWo = null;
  let approverLevelForAssign = 0;
  if (
    log.resourceType === "WORK_ORDER" &&
    assignEmployeeId != null &&
    assignEmployeeId !== "" &&
    assignGroupId != null &&
    assignGroupId !== ""
  ) {
    throw createError(
      "Chỉ chọn một kiểu phân công: cá nhân hoặc nhóm.",
      400,
    );
  }
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
  if (
    log.resourceType === "WORK_ORDER" &&
    assignGroupId != null &&
    assignGroupId !== ""
  ) {
    assigneeGroupIdForWo = Number(assignGroupId);
    if (!Number.isFinite(assigneeGroupIdForWo) || assigneeGroupIdForWo < 1) {
      throw createError("assignGroupId không hợp lệ", 400);
    }
    const approverEmp = await employeeModel.findById(approverId);
    approverLevelForAssign = approverEmp?.positionLevel ?? 0;
    await validateGroupAssignment(
      log.resourceId,
      assigneeGroupIdForWo,
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
         WHERE w.AssetID = ? AND w.IsDeleted = 0`,
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
  if (assigneeGroupIdForWo != null) {
    await assignGroupToWorkOrder(
      log.resourceId,
      assigneeGroupIdForWo,
      approverLevelForAssign,
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

/** 8↔6, 9↔7 khi bước lưu ID trưởng. */
function workflowStepPidsForViewer(positionId) {
  const p = Number(positionId);
  if (p === PID_PHO_BAO_TRI) return [PID_TP_BAO_TRI];
  if (p === PID_PHO_KT) return [PID_TP_KT];
  return [p];
}

export async function getPendingForMe(positionId, positionLevel) {
  if (Number(positionLevel) >= 4) {
    return model.findAllPending();
  }
  return model.findPendingForAnyPosition(workflowStepPidsForViewer(positionId));
}

export async function getHistory(resourceType, resourceId) {
  const logs = await model.findByResource(resourceId, resourceType);
  const wfId = logs.find((l) => l.workflowId)?.workflowId;
  const workflowSteps = wfId
    ? await model.listWorkflowStepRoles(wfId)
    : [];
  return { logs, workflowSteps };
}
