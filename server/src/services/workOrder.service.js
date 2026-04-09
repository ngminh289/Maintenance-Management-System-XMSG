/**
 * workOrder.service.js — Nghiệp vụ Phiếu công việc: tạo, phân công, chuyển trạng thái.
 * Luồng thực hiện: WAITING → IN_PROGRESS → AWAITING_CLOSURE (thợ báo xong + ảnh) → COMPLETED (TC/TP nghiệm thu đóng).
 * WO từ lịch đã phê duyệt: createFromApprovedSchedule → WAITING.
 * WO hoàn thành → workOrderMaintenanceSync; checklist/ hệ thống có thể gọi updateStatus COMPLETED trực tiếp.
 * Liên quan: workOrderPhoto.model.js, workOrderMaintenanceSync, approval, notification.
 * saveClosureNotesDraft / resetRuntimeBaselineForCorrective: thợ được giao hoặc TC+ (không cần ASSET:UPDATE cho reset mốc giờ).
 */
import { createError } from "../utils/createError.js";
import { getPagination, paginatedResult } from "../utils/paginate.js";
import { unlink } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import * as model from "../models/workOrder.model.js";
import * as photoModel from "../models/workOrderPhoto.model.js";
import * as workOrderMaintSync from "./workOrderMaintenanceSync.service.js";
import * as approvalSvc from "./approval.service.js";
import * as notifService from "./notification.service.js";
import * as assetModel from "../models/asset.model.js";
import * as assetCounterModel from "../models/assetCounter.model.js";
import * as assetCounterForecast from "./assetCounterForecast.service.js";
import { assignFieldTechnicianToWorkOrder } from "./workOrderFieldAssign.service.js";

/** Thư mục gốc server (…/server) — resolve đường dẫn file ảnh WO */
const SERVER_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** Level ≥ 3: Trưởng ca / Trưởng phòng — nghiệm thu đóng phiếu */
const SUPERVISOR_MIN_LEVEL = 3;

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

export async function getAll(query) {
  const { page, limit, offset } = getPagination(query);
  const filters = {
    status: query.status || undefined,
    assetId: query.assetId ? Number(query.assetId) : undefined,
    priority: query.priority || undefined,
    woSource: query.woSource || undefined,
    assignedTo: query.assignedTo ? Number(query.assignedTo) : undefined,
  };
  const [items, total] = await Promise.all([
    model.findAll({ ...filters, limit, offset }),
    model.count(filters),
  ]);
  return paginatedResult(items, total, page, limit);
}

export async function getById(id) {
  const wo = await model.findById(id);
  if (!wo) throw createError("Không tìm thấy phiếu công việc", 404);
  const [assignments, photos] = await Promise.all([
    model.getAssignments(id),
    photoModel.listByWo(id),
  ]);
  const suggestedActualHours = [
    "IN_PROGRESS",
    "PAUSED",
    "AWAITING_CLOSURE",
  ].includes(wo.status)
    ? (model.computeSuggestedActualHours(wo) ?? null)
    : null;
  return { ...wo, assignments, photos, suggestedActualHours };
}

/** Tạo WorkOrder thủ công (Level >= 2) + tự động submit approval */
export async function create(data, createdBy) {
  const asset = await assetModel.findById(data.assetId);
  if (!asset) throw createError("Không tìm thấy tài sản", 404);

  const woId = await model.create({
    ...data,
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
  woSource,
  priority,
  description,
  createdBy,
}) {
  const woId = await model.create({
    assetId,
    woSource,
    priority,
    status: "PENDING_APPROVAL",
    plannedDate: new Date().toISOString().split("T")[0],
    description: description || `Phiếu tự động (${woSource})`,
    createdBy: createdBy || null,
  });
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
 * Phiếu từ lịch bảo trì đã được duyệt (kế hoạch OK) — không gửi phê duyệt phiếu lần nữa.
 * Vào WAITING: Trưởng ca/Trưởng phòng phân công → công nhân/NVKT nhận việc trên phiếu.
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
    status: "WAITING",
    plannedDate: plannedDate || new Date().toISOString().split("T")[0],
    description: description || `Phiếu từ lịch #${scheduleId}`,
    createdBy: createdBy || null,
  });
  if (createdBy) {
    await notifService.send(
      createdBy,
      `Đã tạo WO #${woId} từ lịch bảo trì — trạng thái Chờ thực hiện. Vui lòng phân công nhân viên hiện trường.`,
      "APPROVAL_REQUEST",
    );
  }
  return woId;
}

export async function update(id, data) {
  const wo = await getById(id);
  if (["COMPLETED", "CANCELLED"].includes(wo.status))
    throw createError("Không thể sửa phiếu đã kết thúc", 400);
  await model.update(id, data);
  return getById(id);
}

async function loadAssignmentsSet(woId) {
  const rows = await model.getAssignments(woId);
  return {
    rows,
    isAssigned: (employeeId) =>
      rows.some((a) => Number(a.employeeId) === Number(employeeId)),
  };
}

/**
 * Thợ / TC lưu ghi chú + vật tư trong lúc WAITING / IN_PROGRESS / PAUSE (không đổi trạng thái).
 */
export async function saveClosureNotesDraft(
  id,
  { employeeId, actorLevel, closureFieldNotes, closurePartsNotes },
) {
  const wo = await model.findById(id);
  if (!wo) throw createError("Không tìm thấy phiếu công việc", 404);
  const { isAssigned } = await loadAssignmentsSet(id);
  const allowed =
    isAssigned(employeeId) || (actorLevel ?? 0) >= SUPERVISOR_MIN_LEVEL;
  if (!allowed) {
    throw createError(
      "Chỉ người được phân công hoặc Trưởng ca/Trưởng phòng mới sửa được ghi chú.",
      403,
    );
  }
  if (!["WAITING", "IN_PROGRESS", "PAUSED"].includes(wo.status)) {
    throw createError(
      "Chỉ lưu nháp khi phiếu đang chờ thực hiện hoặc đang làm việc.",
      400,
    );
  }
  await model.setClosureFieldReport(id, {
    closureFieldNotes,
    closurePartsNotes,
  });
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
    throw createError(
      "Chỉ phiếu sự cố (CORRECTIVE) mới reset mốc giờ chạy cho dự báo.",
      400,
    );
  }
  const { isAssigned } = await loadAssignmentsSet(id);
  const allowed =
    isAssigned(employeeId) || (actorLevel ?? 0) >= SUPERVISOR_MIN_LEVEL;
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
  } = {},
) {
  const wo = await model.findById(id);
  if (!wo) throw createError("Không tìm thấy phiếu công việc", 404);

  const { rows: assignmentRows, isAssigned } = await loadAssignmentsSet(id);
  const assigned = isAssigned(employeeId);
  const isSupervisor = (actorLevel ?? 0) >= SUPERVISOR_MIN_LEVEL;

  const allowed = TRANSITIONS[wo.status] || [];
  if (!allowed.includes(newStatus)) {
    throw createError(`Không thể chuyển từ ${wo.status} → ${newStatus}`, 400);
  }

  if (newStatus === "CANCELLED" && (actorLevel ?? 0) < 2) {
    throw createError("Không đủ quyền hủy phiếu", 403);
  }

  if (newStatus === "AWAITING_CLOSURE") {
    if (!assigned) {
      throw createError(
        "Chỉ người được phân công mới báo hoàn thành chờ nghiệm thu",
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
        );
      }
    }
    await notifService.notifyManagers(
      `WO #${id} chờ nghiệm thu đóng phiếu (${wo.assetName ?? "tài sản"}).`,
      "SYSTEM_ALERT",
      3,
    );
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
      await assetModel.updateStatus(wo.assetId, "AVAILABLE");
      const completedRow = await model.findById(id);
      await workOrderMaintSync.afterWorkOrderCompleted(completedRow);
    }
    if (wo.createdBy) {
      await notifService.send(
        wo.createdBy,
        `Phiếu WO #${id} đã hoàn thành. Tài sản đã trở lại AVAILABLE.`,
        "WORK_ORDER_COMPLETED",
      );
    }
  } else {
    await model.updateStatus(id, newStatus, {});
  }

  if (newStatus === "IN_PROGRESS" && wo.status === "WAITING") {
    for (const a of assignmentRows) {
      await notifService.send(
        a.employeeId,
        `Phiếu WO #${id} đã bắt đầu. Vui lòng theo dõi.`,
        "WORK_ORDER_ASSIGNED",
      );
    }
  }

  return getById(id);
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
    const rel = `uploads/work-orders/${f.filename}`;
    await photoModel.insertRow(woId, rel, employeeId);
  }
  return photoModel.listByWo(woId);
}

function absUploadPath(filePath) {
  const parts = String(filePath).split("/").filter(Boolean);
  return join(SERVER_ROOT, ...parts);
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
  await unlink(absUploadPath(row.filePath)).catch(() => {});
  await photoModel.remove(photoId);
  return photoModel.listByWo(woId);
}

export async function assign(woId, employeeId, { actorLevel } = {}) {
  return assignFieldTechnicianToWorkOrder(woId, employeeId, actorLevel);
}

export async function unassign(woId, employeeId, { actorLevel } = {}) {
  if ((actorLevel ?? 0) < 3) {
    throw createError("Chỉ Trưởng ca / Trưởng phòng được gỡ phân công.", 403);
  }
  await model.unassign(woId, employeeId);
  return model.getAssignments(woId);
}

export async function remove(id) {
  const wo = await model.findById(id);
  if (!wo) throw createError("Không tìm thấy phiếu công việc", 404);
  if (!["CANCELLED", "PENDING_APPROVAL"].includes(wo.status)) {
    throw createError(
      "Chỉ được xóa phiếu ở trạng thái CANCELLED hoặc PENDING_APPROVAL",
      400,
    );
  }
  await model.remove(id);
}
