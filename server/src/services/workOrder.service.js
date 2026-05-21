/**
 * workOrder.service.js — Nghiệp vụ Phiếu công việc: tạo, phân công, chuyển trạng thái.
 * Luồng thực hiện: WAITING → IN_PROGRESS → AWAITING_CLOSURE (thợ báo xong + ảnh) → COMPLETED (TC/TP nghiệm thu đóng).
 * Đồng bộ tài sản: MAINTENANCE khi còn phiếu IN_PROGRESS hoặc phiếu EMERGENCY đang chờ nghiệm thu; PAUSED / chờ nghiệm thu phiếu thường → reconcile AVAILABLE.
 * COMPLETED: reconcile; chặn KTV bắt đầu / làm tiếp phiếu nếu còn phiếu khác IN_PROGRESS/PAUSED hoặc chờ nghiệm thu khẩn.
 * KTV hiện trường / Chuyên viên KTS: chặn IN_PROGRESS (bắt đầu / tiếp tục từ PAUSED) khi đang nghỉ phép có lịch.
 * WO từ lịch đã phê duyệt: createFromApprovedSchedule → WAITING.
 * WO hoàn thành → workOrderMaintenanceSync; checklist OK đóng WO gọi reconcileAssetStatusForOnsiteWorkOrders.
 * Liên quan: workOrderPhoto.model.js, workOrderMaintenanceSync, approval, notification.
 * saveClosureNotesDraft / resetRuntimeBaselineForCorrective: thợ được giao hoặc TC+ (không cần ASSET:UPDATE cho reset mốc giờ).
 * getById(+viewer): recentChecklists + woLinkedChecklist (bản mới nhất gắn WO) khi được xem digest checklist.
 */
import { createError } from "../utils/createError.js";
import { getPagination, paginatedResult } from "../utils/paginate.js";
import { deleteStoredFile } from "../utils/storageUrl.js";
import * as model from "../models/workOrder.model.js";
import * as photoModel from "../models/workOrderPhoto.model.js";
import * as workOrderMaintSync from "./workOrderMaintenanceSync.service.js";
import * as approvalSvc from "./approval.service.js";
import * as notifService from "./notification.service.js";
import * as assetModel from "../models/asset.model.js";
import * as assetService from "./asset.service.js";
import * as assetCounterModel from "../models/assetCounter.model.js";
import * as assetCounterForecast from "./assetCounterForecast.service.js";
import { assignFieldTechnicianToWorkOrder, assignGroupToWorkOrder } from "./workOrderFieldAssign.service.js";
import * as employeeModel from "../models/employee.model.js";
import * as checklistResultModel from "../models/checklistResult.model.js";
import * as scheduledChecklistSlotModel from "../models/scheduledChecklistSlot.model.js";
import * as scheduleTemplateModel from "../models/maintenanceScheduleChecklistTemplate.model.js";
import * as downtimeEventModel from "../models/assetDowntimeEvent.model.js";

/** Level ≥ 3: Trưởng ca / Trưởng phòng — nghiệm thu đóng phiếu */
const SUPERVISOR_MIN_LEVEL = 3;

/**
 * Định nghĩa lane theo PositionID:
 *   1 = KTV HT, 2 = CV KTS, 3 = Trưởng ca, 4 = Admin (QTV),
 *   5 = BGĐ, 6/8 = Trưởng/Phó BT, 7/9 = Trưởng/Phó PKT.
 * Trưởng ca cùng level=3 với Trưởng phòng nên phải phân biệt qua positionId.
 */
const POSITION = {
  KTV_HT: 1,
  KTS:    2,
  TRUONG_CA: 3,
  ADMIN:  4,
  BGD:    5,
  HEAD_BT: 6, DEP_BT: 8,
  HEAD_PKT: 7, DEP_PKT: 9,
};

const ADMIN_OR_TP = new Set([POSITION.ADMIN, POSITION.HEAD_BT, POSITION.DEP_BT, POSITION.HEAD_PKT, POSITION.DEP_PKT]);

function isScheduleLinkedWorkOrder(wo) {
  const source = String(wo.woSource || "").toUpperCase();
  return (
    wo.scheduleId != null &&
    (source === "SCHEDULE" ||
      source === "PREDICTIVE_SCHEDULE" ||
      (source === "PREDICTIVE" && wo.scheduleId != null))
  );
}

function pickDueDateForChecklistSlots(wo, existingSlots = []) {
  const fromSlot = existingSlots[0]?.dueDate;
  if (fromSlot != null && fromSlot !== "") {
    const s = String(fromSlot).trim().slice(0, 10);
    if (s !== "0000-00-00" && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  const planned = wo.plannedDate;
  if (planned != null && planned !== "") {
    const p = String(planned).trim().slice(0, 10);
    if (p !== "0000-00-00" && /^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
  }
  return new Date().toISOString().split("T")[0];
}

/** Phiếu chỉ được sửa khi đang ở trạng thái "tiền nghiệm thu" (theo yêu cầu user). */
const EDITABLE_STATUSES = new Set(["PENDING_APPROVAL", "WAITING"]);
/** Phiếu được phép xoá (chuyển sang lưu trữ) — không xoá khi đang chạy / chờ nghiệm thu. */
const DELETABLE_STATUSES = new Set(["PENDING_APPROVAL", "WAITING", "COMPLETED", "CANCELLED"]);

/**
 * Quyền sửa phiếu theo role + trạng thái:
 *   - Admin / Trưởng phòng (BT,PKT): luôn sửa được khi status ∈ EDITABLE.
 *   - CV KTS: chỉ sửa khi PENDING_APPROVAL (trước phê duyệt).
 *   - Trưởng ca: chỉ sửa khi WAITING (sau phê duyệt, chưa khởi động).
 *   - KTV HT / BGĐ: chỉ xem.
 */
function canEditWoByRole({ status, actorLevel, actorPositionId }) {
  if (!EDITABLE_STATUSES.has(status)) return false;
  const pid = Number(actorPositionId) || 0;
  if (ADMIN_OR_TP.has(pid)) return true;
  if (pid === POSITION.KTS) return status === "PENDING_APPROVAL";
  if (pid === POSITION.TRUONG_CA) return status === "WAITING";
  // Fallback theo level (cho trường hợp positionId không khớp lane mới)
  const lvl = Number(actorLevel) || 0;
  if (lvl >= 3) return true;
  return false;
}

/**
 * Quyền xoá phiếu (soft delete) — TC + KTS không có quyền xoá phiếu việc.
 * Chỉ Admin / Trưởng phòng được phép, và status phải nằm trong DELETABLE.
 */
function canDeleteWoByRole({ status, actorPositionId }) {
  if (!DELETABLE_STATUSES.has(status)) return false;
  const pid = Number(actorPositionId) || 0;
  return ADMIN_OR_TP.has(pid);
}

/** Khôi phục phiếu lưu trữ — chỉ Admin theo yêu cầu user. */
function canRestoreByRole({ actorPositionId }) {
  return Number(actorPositionId) === POSITION.ADMIN;
}

/**
 * MAINTENANCE nếu còn phiếu IN_PROGRESS hoặc AWAITING_CLOSURE khẩn (EMERGENCY) trên tài sản; ngược lại AVAILABLE.
 * Không ghi đè DECOMMISSIONED.
 */
export async function reconcileAssetStatusForOnsiteWorkOrders(assetId) {
  if (!assetId) return;
  const asset = await assetModel.findById(assetId);
  if (!asset || asset.status === "DECOMMISSIONED") return;
  const n = await model.countAssetMaintenanceHoldOrders(assetId);
  await assetService.updateStatus(assetId, n > 0 ? "MAINTENANCE" : "AVAILABLE");
}

// Trạng thái cho phép chuyển tiếp (guard)
const TRANSITIONS = {
  PENDING_APPROVAL: [],
  WAITING: ["IN_PROGRESS"],
  IN_PROGRESS: ["PAUSED", "AWAITING_CLOSURE"],
  PAUSED: ["IN_PROGRESS", "CANCELLED"],
  AWAITING_CLOSURE: ["IN_PROGRESS", "COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** Tham khảo checklist trên WO: Chuyên viên KTS+ hoặc thợ được phân công (KTV HT không giao việc → không lộ ghi chú). */
function userMaySeeAssetChecklistDigest(assignments, employeeId, positionLevel) {
  const lvl = Number(positionLevel) || 0;
  if (lvl >= 2) return true;
  return (assignments ?? []).some(
    (a) => Number(a.employeeId) === Number(employeeId),
  );
}

export async function getAll(query) {
  const { page, limit, offset } = getPagination(query);
  const filters = {
    status: query.status || undefined,
    assetId: query.assetId ? Number(query.assetId) : undefined,
    locationId: query.locationId ? Number(query.locationId) : undefined,
    priority: query.priority || undefined,
    woSource: query.woSource || undefined,
    assignedTo: query.assignedTo ? Number(query.assignedTo) : undefined,
    resourceType: query.resourceType || undefined,
    plannedFrom: query.plannedFrom || undefined,
    plannedTo: query.plannedTo || undefined,
    q: query.q || undefined,
  };
  const [items, total] = await Promise.all([
    model.findAll({ ...filters, limit, offset }),
    model.count(filters),
  ]);
  return paginatedResult(items, total, page, limit);
}

/**
 * Tab "Đã lưu trữ" — chỉ Admin truy cập (route đã chặn). Service trả phiếu IsDeleted=1.
 */
export async function getArchived(query) {
  const { page, limit, offset } = getPagination(query);
  const filters = {
    status: query.status || undefined,
    assetId: query.assetId ? Number(query.assetId) : undefined,
    locationId: query.locationId ? Number(query.locationId) : undefined,
    priority: query.priority || undefined,
    woSource: query.woSource || undefined,
    plannedFrom: query.plannedFrom || undefined,
    plannedTo: query.plannedTo || undefined,
    q: query.q || undefined,
    archived: true,
  };
  const [items, total] = await Promise.all([
    model.findAll({ ...filters, limit, offset }),
    model.count(filters),
  ]);
  return paginatedResult(items, total, page, limit);
}

export async function getById(id, viewer = null) {
  const isAdmin = Number(viewer?.positionId) === POSITION.ADMIN;
  const wo = await model.findById(id, { includeArchived: isAdmin });
  if (!wo) throw createError("Không tìm thấy phiếu công việc", 404);
  const [assignments, photos, openPlannedDowntime] = await Promise.all([
    model.getAssignments(id),
    photoModel.listByWo(id),
    downtimeEventModel.findOpenByWorkOrder(id),
  ]);
  const suggestedActualHours = [
    "IN_PROGRESS",
    "PAUSED",
    "AWAITING_CLOSURE",
  ].includes(wo.status)
    ? (model.computeSuggestedActualHours(wo) ?? null)
    : null;
  const machinePowerState = openPlannedDowntime ? "SHUTDOWN" : "STARTUP";
  const base = {
    ...wo,
    assignments,
    photos,
    suggestedActualHours,
    machinePowerState,
  };

  if (
    isScheduleLinkedWorkOrder(wo) &&
    !["COMPLETED", "CANCELLED"].includes(String(wo.status).toUpperCase())
  ) {
    const dueDateBase = pickDueDateForChecklistSlots(
      wo,
      await scheduledChecklistSlotModel.findAllByWorkOrderId(id),
    );
    const ensureArgs = {
      scheduleId: Number(wo.scheduleId),
      assetId: Number(wo.assetId),
      workOrderId: id,
      dueDate: dueDateBase,
    };
    await scheduledChecklistSlotModel.ensureSlotsForWorkOrder(ensureArgs);
    const templateRows = await scheduleTemplateModel.listByScheduleId(
      Number(wo.scheduleId),
    );
    const slotsAfter = await scheduledChecklistSlotModel.findAllByWorkOrderId(id);
    const slotTplCount = slotsAfter.filter((s) => s.templateId != null).length;
    if (templateRows.length > slotTplCount) {
      await scheduledChecklistSlotModel.ensureSlotsForWorkOrder(ensureArgs);
    }
  }

  const checklistSlots = await scheduledChecklistSlotModel.findAllByWorkOrderId(id);
  const checklistSlot = checklistSlots[0] || null;

  let checklistRequirements = checklistSlots.filter((s) => s.templateId != null);
  if (isScheduleLinkedWorkOrder(wo)) {
    const templateRows = await scheduleTemplateModel.listByScheduleId(
      Number(wo.scheduleId),
    );
    if (templateRows.length) {
      const dueDate = pickDueDateForChecklistSlots(wo, checklistSlots);
      checklistRequirements = templateRows.map((t) => {
        const slot = checklistSlots.find(
          (s) => Number(s.templateId) === Number(t.templateId),
        );
        if (slot) return slot;
        return {
          scheduleId: Number(wo.scheduleId),
          assetId: Number(wo.assetId),
          workOrderId: id,
          templateId: t.templateId,
          templateName: t.templateName,
          status: "OPEN",
          dueDate,
          slotMissing: true,
        };
      });
    }
  }

  const checklistRequirementsMet =
    checklistRequirements.length === 0 ||
    checklistRequirements.every((s) =>
      ["FULFILLED", "WAIVED"].includes(String(s.status).toUpperCase()),
    );

  let checklistSlotSyncWarning = null;
  if (
    isScheduleLinkedWorkOrder(wo) &&
    checklistRequirements.some((r) => r.slotMissing)
  ) {
    const multiOk =
      await scheduledChecklistSlotModel.supportsMultipleSlotsPerWorkOrder();
    checklistSlotSyncWarning = multiOk
      ? "Không tạo được đủ slot checklist trong DB — thử chạy migration 075 hoặc liên hệ quản trị."
      : "Database chưa hỗ trợ nhiều checklist trên một phiếu. Chạy migration 074_multi_schedule_checklist_templates.sql rồi 075_backfill_missing_checklist_slots.sql, khởi động lại server.";
  }
  let recentChecklists = [];
  let recentChecklistsEligible = false;
  let woLinkedChecklist = null;
  let woLinkedChecklists = [];
  if (viewer?.employeeId != null) {
    recentChecklistsEligible = userMaySeeAssetChecklistDigest(
      assignments,
      viewer.employeeId,
      viewer.positionLevel,
    );
    if (recentChecklistsEligible) {
      recentChecklists = await checklistResultModel.findRecentApprovedByAsset(
        wo.assetId,
        3,
      );
      woLinkedChecklists = await checklistResultModel.findAllByWorkOrderId(id);
      woLinkedChecklist = woLinkedChecklists[0] || null;
    }
  }
  return {
    ...base,
    checklistSlot,
    checklistSlots,
    checklistRequirements,
    checklistRequirementsMet,
    checklistSlotSyncWarning,
    recentChecklists,
    recentChecklistsEligible,
    woLinkedChecklist,
    woLinkedChecklists,
  };
}

/** Tạo WorkOrder thủ công (Level >= 2) + tự động submit approval */
export async function create(data, createdBy) {
  const asset = await assetModel.findById(data.assetId);
  if (!asset) throw createError("Không tìm thấy tài sản", 404);

  const woId = await model.create({
    ...data,
    requiresShutdown: data.requiresShutdown === true || data.requiresShutdown === 1,
    status: "PENDING_APPROVAL",
    createdBy,
  });

  // Smart routing: truyền source/priority để approval chọn đúng workflow
  await approvalSvc.submit({
    resourceType: "WORK_ORDER",
    resourceId: woId,
    submitterId: createdBy,
    woSource: data.woSource,
    woPriority: data.priority,
  });

  return model.findById(woId);
}

/** Tạo WorkOrder tự động (từ checklist NG/WARNING, dự báo, khẩn — vẫn qua phê duyệt + routing TC/TP) */
export async function createAutomatic({
  assetId,
  scheduleId,
  woSource,
  priority,
  description,
  createdBy,
  checklistDueDate,
}) {
  const woId = await model.create({
    scheduleId: scheduleId || null,
    assetId,
    woSource,
    priority,
    requiresShutdown: false,
    status: "PENDING_APPROVAL",
    plannedDate: new Date().toISOString().split("T")[0],
    description: description || `Phiếu tự động (${woSource})`,
    createdBy: createdBy || null,
  });
  if (scheduleId) {
    const dueDate =
      String(checklistDueDate || "").trim() ||
      new Date().toISOString().split("T")[0];
    await scheduledChecklistSlotModel.ensureSlotsForWorkOrder({
      scheduleId: Number(scheduleId),
      assetId,
      dueDate,
      workOrderId: woId,
    });
  }
  await approvalSvc.submit({
    resourceType: "WORK_ORDER",
    resourceId: woId,
    submitterId: createdBy,
    woSource,
    woPriority: priority,
  });
  return woId;
}

/**
 * Phiếu từ lịch bảo trì đã được duyệt (kế hoạch OK) — vẫn phải qua phê duyệt WO.
 * Tạo WO ở PENDING_APPROVAL và submit workflow; chỉ sang WAITING sau khi duyệt cấp cuối.
 */
export async function createFromApprovedSchedule({
  scheduleId,
  assetId,
  priority,
  description,
  plannedDate,
  createdBy,
}) {
  const woId = await model.create({
    scheduleId,
    assetId,
    woSource: "SCHEDULE",
    priority: priority || "MEDIUM",
    requiresShutdown: false,
    status: "PENDING_APPROVAL",
    plannedDate: plannedDate || new Date().toISOString().split("T")[0],
    description: description || `Phiếu từ lịch #${scheduleId}`,
    createdBy: createdBy || null,
  });
  await approvalSvc.submit({
    resourceType: "WORK_ORDER",
    resourceId: woId,
    submitterId: createdBy,
    woSource: "SCHEDULE",
    woPriority: priority || "MEDIUM",
  });
  if (createdBy) {
    await notifService.send(
      createdBy,
      `Đã tạo WO #${woId} từ lịch bảo trì — đang chờ phê duyệt trước khi phân công nhân viên hiện trường.`,
      "APPROVAL_REQUEST",
      { resourceType: "WORK_ORDER", resourceId: woId },
    );
  }
  return woId;
}

/**
 * Sửa phiếu — kiểm tra role + status:
 *  - Phiếu lưu trữ: chặn tuyệt đối (chỉ tab Admin xem read-only).
 *  - PENDING_APPROVAL / WAITING: cho phép theo role (canEditWoByRole).
 *  - IN_PROGRESS, PAUSED, AWAITING_CLOSURE, COMPLETED, CANCELLED: không sửa.
 */
export async function update(id, data, opts = {}) {
  const { actorLevel, actorPositionId } = opts;
  const wo = await model.findById(id, { includeArchived: true });
  if (!wo) throw createError("Không tìm thấy phiếu công việc", 404);
  if (Number(wo.isDeleted) === 1) {
    throw createError("Phiếu đã được lưu trữ — không thể chỉnh sửa.", 400);
  }
  if (!EDITABLE_STATUSES.has(wo.status)) {
    throw createError(
      "Phiếu đang/đã kết thúc nên không được chỉnh sửa. Chỉ sửa khi đang chờ duyệt hoặc chờ thực hiện.",
      400,
    );
  }
  if (!canEditWoByRole({ status: wo.status, actorLevel, actorPositionId })) {
    throw createError(
      "Bạn không có quyền sửa phiếu này ở trạng thái hiện tại.",
      403,
    );
  }
  await model.update(id, data);
  return getById(id);
}

function toOptionalReason(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, 500) : null;
}

async function loadAssignmentsSet(woId) {
  const rows = await model.getAssignments(woId);
  return {
    rows,
    isAssigned:     (employeeId) => rows.some((a) => Number(a.employeeId) === Number(employeeId)),
    isGroupLeader:  (employeeId) => rows.some((a) => Number(a.employeeId) === Number(employeeId) && Number(a.isGroupLeader) === 1),
  };
}

/**
 * Trưởng nhóm / TC lưu ghi chú + vật tư (không đổi trạng thái).
 * Chỉ người là IsGroupLeader hoặc Trưởng ca/Trưởng phòng (Level ≥ 3) mới được ghi.
 */
export async function saveClosureNotesDraft(
  id,
  { employeeId, actorLevel, closureFieldNotes, closurePartsNotes },
) {
  const wo = await model.findById(id);
  if (!wo) throw createError("Không tìm thấy phiếu công việc", 404);
  const { isGroupLeader } = await loadAssignmentsSet(id);
  const allowed = isGroupLeader(employeeId) || (actorLevel ?? 0) >= SUPERVISOR_MIN_LEVEL;
  if (!allowed) {
    throw createError(
      "Chỉ trưởng nhóm hoặc Trưởng ca/Trưởng phòng mới ghi chú vật tư được.",
      403,
    );
  }
  if (!["WAITING", "IN_PROGRESS", "PAUSED"].includes(wo.status)) {
    throw createError("Chỉ lưu nháp khi phiếu đang chờ thực hiện hoặc đang làm việc.", 400);
  }
  await model.setClosureFieldReport(id, { closureFieldNotes, closurePartsNotes });
  return getById(id);
}

/**
 * Phiếu CORRECTIVE: cập nhật mốc LastMaintenanceTotal = tổng giờ chạy hiện tại (giống reset sau bảo trì) để lịch PM theo giờ tính lại.
 * Tránh import assetCounter.service (vòng với workOrder.service).
 */
export async function resetRuntimeBaselineForCorrective(id, {
  employeeId,
  actorLevel,
}) {
  const wo = await model.findById(id);
  if (!wo) throw createError("Không tìm thấy phiếu công việc", 404);
  if (wo.woSource !== "CORRECTIVE") {
    throw createError("Chỉ phiếu sự cố (CORRECTIVE) mới reset mốc giờ chạy cho dự báo.", 400);
  }
  const { isGroupLeader } = await loadAssignmentsSet(id);
  const allowed = isGroupLeader(employeeId) || (actorLevel ?? 0) >= SUPERVISOR_MIN_LEVEL;
  if (!allowed) {
    throw createError("Không đủ quyền thực hiện trên phiếu này.", 403);
  }
  if (!["IN_PROGRESS", "PAUSED", "AWAITING_CLOSURE"].includes(wo.status)) {
    throw createError(
      "Reset mốc giờ chỉ khi đang thực hiện hoặc chờ nghiệm thu.",
      400,
    );
  }
  if (wo.counterBaselineResetAt) {
    const t = new Date(wo.counterBaselineResetAt).toLocaleString("vi-VN");
    throw createError(
      `Phiếu này đã reset mốc giờ chạy lúc ${t}. Mỗi phiếu chỉ reset một lần.`,
      400,
    );
  }
  const counter = await assetCounterModel.findByAsset(wo.assetId);
  if (!counter) throw createError("Tài sản chưa có bộ đếm giờ chạy.", 400);
  await assetCounterModel.setLastMaintenanceTotal(
    wo.assetId,
    counter.totalAccumulatedHours,
  );
  await assetCounterForecast.recalculateEstimatedNextPMDate(wo.assetId);
  await model.markCounterBaselineReset(Number(id), Number(employeeId));
  return getById(id);
}

/** Chuyển trạng thái phiếu với validation (bước 6: chỉ giám sát đóng từ AWAITING_CLOSURE). */
export async function changeStatus(
  id,
  newStatus,
  {
    actorLevel,
    actualHours,
    employeeId,
    closureFieldNotes,
    closurePartsNotes,
    requiresShutdown,
    shutdownReason,
  } = {},
) {
  const wo = await model.findById(id);
  if (!wo) throw createError("Không tìm thấy phiếu công việc", 404);

  const { rows: assignmentRows, isAssigned, isGroupLeader } = await loadAssignmentsSet(id);
  const assigned = isAssigned(employeeId);
  const isLeader = isGroupLeader(employeeId);
  const isSupervisor = (actorLevel ?? 0) >= SUPERVISOR_MIN_LEVEL;

  const allowed = TRANSITIONS[wo.status] || [];
  if (!allowed.includes(newStatus)) {
    throw createError(`Không thể chuyển từ ${wo.status} → ${newStatus}`, 400);
  }

  if (newStatus === "CANCELLED" && (actorLevel ?? 0) < 2) {
    throw createError("Không đủ quyền hủy phiếu", 403);
  }

  if (newStatus === "AWAITING_CLOSURE") {
    if (!isLeader && !isSupervisor) {
      throw createError(
        "Chỉ trưởng nhóm hoặc Trưởng ca/Trưởng phòng mới báo hoàn thành chờ nghiệm thu.",
        403,
      );
    }
  }

  if (newStatus === "COMPLETED") {
    if (wo.status !== "AWAITING_CLOSURE") {
      throw createError("Chỉ đóng phiếu khi đang chờ nghiệm thu", 400);
    }
    if (!isSupervisor) {
      throw createError(
        "Chỉ Trưởng ca / Trưởng phòng mới nghiệm thu và đóng phiếu",
        403,
      );
    }
  }

  if (
    newStatus === "IN_PROGRESS" &&
    wo.status === "AWAITING_CLOSURE" &&
    !isSupervisor
  ) {
    throw createError(
      "Chỉ giám sát mới cho phép làm tiếp sau chờ nghiệm thu",
      403,
    );
  }

  if (newStatus === "IN_PROGRESS") {
    // Từ WAITING / PAUSED: chỉ trưởng nhóm (leader) hoặc giám sát mới bắt đầu
    if ((wo.status === "WAITING" || wo.status === "PAUSED") && !isSupervisor) {
      if (!isLeader) {
        throw createError(
          "Chỉ trưởng nhóm mới được bắt đầu / tiếp tục thực hiện phiếu. Hãy nhờ trưởng nhóm xác nhận.",
          403,
        );
      }
      const starter = await employeeModel.findById(employeeId);
      if (starter?.onScheduledLeave) {
        throw createError(
          "Bạn đang trong thời gian nghỉ phép có lịch — không thể bắt đầu hoặc tiếp tục thực hiện phiếu.",
          400,
        );
      }
    }
    const busyIds = [];
    if ((isLeader || isSupervisor) && (wo.status === "WAITING" || wo.status === "PAUSED")) {
      // Khi bắt đầu WO nhóm, kiểm tra conflict cho TẤT CẢ thành viên nhóm
      for (const r of assignmentRows) {
        const eid = Number(r.employeeId);
        if (Number.isFinite(eid) && eid > 0) busyIds.push(eid);
      }
    } else if (isSupervisor && wo.status === "AWAITING_CLOSURE") {
      for (const r of assignmentRows) {
        const eid = Number(r.employeeId);
        if (Number.isFinite(eid) && eid > 0) busyIds.push(eid);
      }
    }
    const uniqueBusy = [...new Set(busyIds)];
    for (const eid of uniqueBusy) {
      const blocking = await model.countEmployeeBlockingWorkOrders(eid, id);
      if (blocking > 0) {
        // Tìm tên nhân viên đang bị conflict để thông báo rõ
        const conflictEmp = assignmentRows.find(r => Number(r.employeeId) === eid);
        const who = conflictEmp?.fullName ? `${conflictEmp.fullName} đang` : "Một thành viên đang";
        throw createError(
          `${who} bận phiếu việc khác (đang thực hiện / tạm dừng hoặc chờ nghiệm thu phiếu khẩn). Vui lòng hoàn tất hoặc tạm dừng phiếu đó trước.`,
          409,
        );
      }
    }
  }

  let precomputedAwaitingHours;
  if (newStatus === "AWAITING_CLOSURE") {
    if (
      actualHours !== undefined &&
      actualHours !== null &&
      String(actualHours).trim() !== ""
    ) {
      const n = Number(String(actualHours).replace(",", "."));
      precomputedAwaitingHours = Number.isFinite(n)
        ? n
        : model.computeSuggestedActualHours(wo);
    } else {
      precomputedAwaitingHours = model.computeSuggestedActualHours(wo);
    }
  }

  await model.applyTimingTransition(id, wo.status, newStatus);

  let targetRequiresShutdown = wo.requiresShutdown;
  if (
    newStatus === "IN_PROGRESS" &&
    wo.status === "WAITING" &&
    requiresShutdown !== undefined
  ) {
    targetRequiresShutdown =
      requiresShutdown === true ||
      String(requiresShutdown).toLowerCase() === "true" ||
      Number(requiresShutdown) === 1;
    await model.update(id, { requiresShutdown: targetRequiresShutdown ? 1 : 0 });
  }

  if (newStatus === "AWAITING_CLOSURE") {
    await model.setClosureFieldReport(id, {
      closureFieldNotes,
      closurePartsNotes,
    });
    await model.updateStatus(id, newStatus, {
      actualHours: precomputedAwaitingHours ?? null,
    });
    for (const a of assignmentRows) {
      if (Number(a.employeeId) !== Number(employeeId)) {
        await notifService.send(
          a.employeeId,
          `WO #${id} đã báo hoàn thành — chờ Trưởng ca/Trưởng phòng nghiệm thu.`,
          "WORK_ORDER_ASSIGNED",
          { resourceType: "WORK_ORDER", resourceId: id },
        );
      }
    }
    await notifService.notifyManagers(
      `WO #${id} chờ nghiệm thu đóng phiếu (${wo.assetName ?? "tài sản"}).`,
      "SYSTEM_ALERT",
      3,
      { resourceType: "WORK_ORDER", resourceId: id },
    );
    if (wo.assetId) {
      await reconcileAssetStatusForOnsiteWorkOrders(wo.assetId);
    }
  } else if (newStatus === "COMPLETED") {
    const actualDate = new Date().toISOString().split("T")[0];
    const fresh = await model.findById(id);
    let resolvedHours = actualHours;
    if (
      resolvedHours === undefined ||
      resolvedHours === null ||
      String(resolvedHours).trim() === ""
    ) {
      resolvedHours =
        fresh.actualHours ?? model.computeSuggestedActualHours(fresh);
    } else {
      const n = Number(String(resolvedHours).replace(",", "."));
      resolvedHours = Number.isFinite(n)
        ? n
        : (fresh.actualHours ?? model.computeSuggestedActualHours(fresh));
    }
    await model.updateStatus(id, newStatus, {
      actualDate,
      actualHours: resolvedHours,
    });

    if (wo.assetId) {
      await reconcileAssetStatusForOnsiteWorkOrders(wo.assetId);
      const completedRow = await model.findById(id);
      await workOrderMaintSync.afterWorkOrderCompleted(completedRow);
    }
    if (wo.createdBy) {
      const af = wo.assetId ? await assetModel.findById(wo.assetId) : null;
      const tail =
        af?.status === "MAINTENANCE"
          ? "Tài sản vẫn MAINTENANCE (còn phiếu đang thực hiện hoặc phiếu khẩn chờ nghiệm thu trên cùng thiết bị)."
          : "Tài sản đã trở lại AVAILABLE.";
      await notifService.send(
        wo.createdBy,
        `Phiếu WO #${id} đã hoàn thành. ${tail}`,
        "WORK_ORDER_COMPLETED",
        { resourceType: "WORK_ORDER", resourceId: id },
      );
    }
  } else {
    await model.updateStatus(id, newStatus, {});
  }

  if (newStatus === "PAUSED" && wo.assetId) {
    await reconcileAssetStatusForOnsiteWorkOrders(wo.assetId);
  }

  if (["COMPLETED", "CANCELLED"].includes(newStatus)) {
    const openByWo = await downtimeEventModel.findOpenByWorkOrder(id);
    if (openByWo) {
      await downtimeEventModel.closeEvent(openByWo.eventId);
    }
  }

  if (newStatus === "IN_PROGRESS" && wo.assetId) {
    await reconcileAssetStatusForOnsiteWorkOrders(wo.assetId);
    if (wo.status === "WAITING" && targetRequiresShutdown) {
      const openByWo = await downtimeEventModel.findOpenByWorkOrder(id);
      if (!openByWo) {
        await downtimeEventModel.createEvent({
          assetId: wo.assetId,
          downtimeType: "PLANNED_MAINTENANCE",
          workOrderId: id,
          source: "WORK_ORDER",
          reason:
            toOptionalReason(shutdownReason) ||
            `WO #${id} yêu cầu dừng máy khi bắt đầu thực hiện`,
          createdBy: employeeId ?? null,
        });
      }
    }
  }

  if (newStatus === "IN_PROGRESS" && wo.status === "WAITING") {
    for (const a of assignmentRows) {
      await notifService.send(
        a.employeeId,
        `Phiếu WO #${id} đã bắt đầu. Vui lòng theo dõi.`,
        "WORK_ORDER_ASSIGNED",
        { resourceType: "WORK_ORDER", resourceId: id },
      );
    }
  }

  return getById(id);
}

/**
 * Tắt/bật máy trong lúc WO đang thực hiện để điều khiển downtime planned.
 * action=SHUTDOWN => mở AssetDowntimeEvents (nếu chưa mở).
 * action=STARTUP  => đóng event open của WO.
 */
export async function setWorkOrderPowerState(
  id,
  action,
  { employeeId, actorLevel, reason } = {},
) {
  const wo = await model.findById(id);
  if (!wo) throw createError("Không tìm thấy phiếu công việc", 404);
  if (!["IN_PROGRESS", "PAUSED", "AWAITING_CLOSURE"].includes(wo.status)) {
    throw createError("Chỉ thao tác tắt/bật máy khi phiếu đang xử lý.", 400);
  }
  const { isGroupLeader } = await loadAssignmentsSet(id);
  const isSupervisor = (actorLevel ?? 0) >= SUPERVISOR_MIN_LEVEL;
  if (!isGroupLeader(employeeId) && !isSupervisor) {
    throw createError("Chỉ trưởng nhóm hoặc Trưởng ca/Trưởng phòng được thao tác.", 403);
  }
  const upperAction = String(action || "").toUpperCase();
  if (!["SHUTDOWN", "STARTUP"].includes(upperAction)) {
    throw createError("Hành động không hợp lệ (SHUTDOWN|STARTUP).", 400);
  }
  if (!wo.assetId) throw createError("Phiếu chưa gắn tài sản.", 400);

  if (upperAction === "SHUTDOWN") {
    const openByWo = await downtimeEventModel.findOpenByWorkOrder(id);
    if (!openByWo) {
      await model.update(id, { requiresShutdown: 1 });
      await downtimeEventModel.createEvent({
        assetId: wo.assetId,
        downtimeType: "PLANNED_MAINTENANCE",
        workOrderId: id,
        source: "WORK_ORDER",
        reason: toOptionalReason(reason) || `WO #${id} tắt máy để bảo trì`,
        createdBy: employeeId ?? null,
      });
    }
    return { ...(await getById(id)), machinePower: "SHUTDOWN" };
  }

  const openByWo = await downtimeEventModel.findOpenByWorkOrder(id);
  if (openByWo) {
    await downtimeEventModel.closeEvent(openByWo.eventId);
  }
  return { ...(await getById(id)), machinePower: "STARTUP" };
}

/** Đính kèm nhiều ảnh hiện trường (IN_PROGRESS | AWAITING_CLOSURE). */
export async function addWorkOrderPhotos(
  woId,
  files,
  { employeeId, actorLevel },
) {
  const wo = await model.findById(woId);
  if (!wo) throw createError("Không tìm thấy phiếu công việc", 404);
  if (!["IN_PROGRESS", "AWAITING_CLOSURE"].includes(wo.status)) {
    throw createError(
      "Chỉ đính ảnh khi đang thực hiện hoặc chờ nghiệm thu",
      400,
    );
  }
  const { isAssigned } = await loadAssignmentsSet(woId);
  const isSupervisor = (actorLevel ?? 0) >= SUPERVISOR_MIN_LEVEL;
  if (!isAssigned(employeeId) && !isSupervisor) {
    throw createError("Không có quyền đính ảnh cho phiếu này", 403);
  }
  const list = files || [];
  if (!list.length) throw createError("Chọn ít nhất một ảnh", 400);
  for (const f of list) {
    const rel =
      f.secure_url || `uploads/work-orders/${f.filename}`;
    await photoModel.insertRow(woId, rel, employeeId);
  }
  return photoModel.listByWo(woId);
}

/** Xóa một ảnh WO (người upload hoặc giám sát). */
export async function deleteWorkOrderPhoto(
  woId,
  photoId,
  { employeeId, actorLevel },
) {
  const row = await photoModel.findById(photoId);
  if (!row || Number(row.woId) !== Number(woId)) {
    throw createError("Không tìm thấy ảnh", 404);
  }
  const isSupervisor = (actorLevel ?? 0) >= SUPERVISOR_MIN_LEVEL;
  const own =
    row.uploadedBy != null && Number(row.uploadedBy) === Number(employeeId);
  if (!own && !isSupervisor) {
    throw createError("Không có quyền xóa ảnh này", 403);
  }
  await deleteStoredFile(row.filePath);
  await photoModel.remove(photoId);
  return photoModel.listByWo(woId);
}

export async function assign(woId, employeeId, { actorLevel } = {}) {
  return assignFieldTechnicianToWorkOrder(woId, employeeId, actorLevel);
}

/** Phân công nhóm — nhập groupId + leaderId (phải là thành viên nhóm). */
export async function assignGroup(woId, groupId, { actorLevel } = {}) {
  return assignGroupToWorkOrder(woId, groupId, actorLevel);
}

export async function unassign(woId, employeeId, { actorLevel } = {}) {
  if ((actorLevel ?? 0) < 3) {
    throw createError("Chỉ Trưởng ca / Trưởng phòng được gỡ phân công.", 403);
  }
  await model.unassign(woId, employeeId);
  return model.getAssignments(woId);
}

/**
 * Xoá phiếu = soft delete (đánh dấu IsDeleted=1) — phiếu vẫn lưu DB để truy xuất ở
 * tab "Đã lưu trữ" (chỉ Admin). Giữ checklist / ảnh / phân công / log để bảo toàn lịch sử.
 *  - Chỉ Admin / Trưởng phòng (BT,PKT) được xoá (TC + KTS không có quyền).
 *  - Cho phép xoá khi status ∈ DELETABLE_STATUSES.
 */
export async function remove(id, opts = {}) {
  const { actorPositionId, actorEmployeeId } = opts;
  const wo = await model.findById(id, { includeArchived: true });
  if (!wo) throw createError("Không tìm thấy phiếu công việc", 404);
  if (Number(wo.isDeleted) === 1) {
    throw createError("Phiếu đã được lưu trữ trước đó.", 400);
  }
  if (!canDeleteWoByRole({ status: wo.status, actorPositionId })) {
    if (!DELETABLE_STATUSES.has(wo.status)) {
      throw createError(
        "Phiếu đang thực hiện hoặc chờ nghiệm thu — không được xoá.",
        400,
      );
    }
    throw createError("Bạn không có quyền xoá phiếu việc này.", 403);
  }
  await model.softRemove(id, actorEmployeeId || null);
  return { workOrderId: Number(id), archived: true };
}

/**
 * Khôi phục phiếu đã lưu trữ (chỉ Admin) — bỏ cờ IsDeleted để phiếu trở lại danh sách thường.
 * Không "rebuild" trạng thái phụ thuộc (asset MAINTENANCE/AVAILABLE) vì status WO không đổi.
 */
export async function restore(id, opts = {}) {
  const { actorPositionId } = opts;
  if (!canRestoreByRole({ actorPositionId })) {
    throw createError("Chỉ Quản trị viên mới khôi phục phiếu đã lưu trữ.", 403);
  }
  const wo = await model.findById(id, { includeArchived: true });
  if (!wo) throw createError("Không tìm thấy phiếu công việc", 404);
  if (Number(wo.isDeleted) !== 1) {
    throw createError("Phiếu này không nằm trong lưu trữ.", 400);
  }
  await model.restore(id);
  return getById(id);
}
