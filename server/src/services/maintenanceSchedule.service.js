/**
 * maintenanceSchedule.service.js — Nghiệp vụ lập lịch bảo trì + tạo WorkOrder từ lịch.
 * Hai kiểu nghiệp vụ:
 *   - Định kỳ: DAYS/WEEKS/MONTHS/YEARS — NextDueDate, scheduler + nút tạo WO từ lịch.
 *   - Dự báo: HOURS — ngưỡng giờ chạy; WO do assetCounter.recordReading khi vượt ngưỡng (không generateWorkOrder từ lịch).
 * Luồng phê duyệt lịch (quy trình đề tài):
 *   DRAFT | REJECTED → gửi SUBMIT → PENDING_APPROVAL → Trưởng ca duyệt → PENDING (chờ TH) | REJECTED | DRAFT (yêu cầu sửa)
 * Kiểm tra checklist khi update: so khớp template với loại tài sản lấy từ Assets (payload.assetId hoặc lịch hiện tại) — không dùng schedule.assetTypeId thiếu từ DB layer.
 * Liên quan: models/maintenanceSchedule.model.js, services/notification.service.js.
 */
import { createError } from "../utils/createError.js";
import { getPagination, paginatedResult } from "../utils/paginate.js";
import * as model from "../models/maintenanceSchedule.model.js";
import * as assetModel from "../models/asset.model.js";
import * as workOrderModel from "../models/workOrder.model.js";
import * as workOrderSvc from "./workOrder.service.js";
import * as notifService from "./notification.service.js";
import * as approvalSvc from "./approval.service.js";
import * as approvalLogModel from "../models/approvalLog.model.js";
import * as scheduledChecklistSlotModel from "../models/scheduledChecklistSlot.model.js";
import * as checklistTemplateModel from "../models/checklistTemplate.model.js";
import * as scheduleTemplateModel from "../models/maintenanceScheduleChecklistTemplate.model.js";

/** Số ngày cảnh báo trước khi đến hạn */
const WARN_DAYS = 7;

/**
 * Lấy chuỗi YYYY-MM-DD hợp lệ cho SQL DATE.
 * MySQL "zero date" 0000-00-00 (hoặc cột chưa gán) có thể trả về chuỗi đó — coi như không dùng được.
 * Tránh INSERT DueDate=0000-00-00: báo cáo dùng `DueDate >= kỳ` sẽ loại bỏ các dòng này.
 */
function pickValidYmd(value) {
  if (value == null || value === "") return null;
  let s;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    s = value.toISOString().slice(0, 10);
  } else {
    s = String(value).trim().slice(0, 10);
  }
  if (s === "0000-00-00" || s === "0001-01-01") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const y = Number(s.slice(0, 4));
  if (y < 1970) return null;
  return s;
}

// ── Tiện ích tính ngày ────────────────────────────────────────────────────────

/**
 * Tính NextDueDate từ base date + frequency.
 * @param {Date|string} baseDate  — ngày bắt đầu hoặc ngày thực hiện lần cuối
 * @param {number} value          — giá trị tần suất
 * @param {string} unit           — DAYS | WEEKS | MONTHS | YEARS
 * @returns {string} YYYY-MM-DD
 */
export function calcNextDueDate(baseDate, value, unit) {
  const d = new Date(baseDate);
  switch (unit) {
    case "DAYS":
      d.setDate(d.getDate() + value);
      break;
    case "WEEKS":
      d.setDate(d.getDate() + value * 7);
      break;
    case "MONTHS":
      d.setMonth(d.getMonth() + value);
      break;
    case "YEARS":
      d.setFullYear(d.getFullYear() + value);
      break;
    default:
      break;
  }
  return d.toISOString().split("T")[0];
}

/** Số ngày từ hôm nay đến nextDueDate (âm = quá hạn) */
function daysUntil(nextDueDateStr) {
  if (!nextDueDateStr) return null;
  const diff = new Date(nextDueDateStr) - new Date(new Date().toDateString());
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

/** Chuẩn hoá checklistTemplateIds từ body (hỗ trợ checklistTemplateId đơn legacy). */
function normalizeChecklistTemplateIds(data) {
  if (Array.isArray(data.checklistTemplateIds)) {
    return [
      ...new Set(
        data.checklistTemplateIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];
  }
  if (
    data.checklistTemplateId != null &&
    data.checklistTemplateId !== "" &&
    Number.isFinite(Number(data.checklistTemplateId)) &&
    Number(data.checklistTemplateId) > 0
  ) {
    return [Number(data.checklistTemplateId)];
  }
  return [];
}

async function validateTemplatesForAsset(templateIds, asset) {
  for (const tid of templateIds) {
    const tpl = await checklistTemplateModel.findById(tid);
    if (!tpl) throw createError("Không tìm thấy checklist template", 404);
    if (Number(tpl.assetTypeId) !== Number(asset.assetTypeId)) {
      throw createError(
        "Checklist template không thuộc loại tài sản của lịch bảo trì này.",
        400,
      );
    }
  }
}

function attachTemplatesToSchedule(schedule, templateRows = []) {
  if (!schedule) return schedule;
  const ids = templateRows.map((r) => Number(r.templateId));
  const names = templateRows.map((r) => r.templateName);
  return {
    ...schedule,
    checklistTemplateIds: ids,
    checklistTemplateNames: names,
    checklistTemplates: templateRows,
    checklistTemplateId: ids[0] ?? schedule.checklistTemplateId ?? null,
    checklistTemplateName:
      names[0] ?? schedule.checklistTemplateName ?? null,
  };
}

async function enrichSchedule(schedule) {
  if (!schedule) return schedule;
  const rows = await scheduleTemplateModel.listByScheduleId(schedule.scheduleId);
  return attachTemplatesToSchedule(schedule, rows);
}

export async function getAll(query) {
  const { page, limit, offset } = getPagination(query);
  const filters = {
    assetId: query.assetId ? Number(query.assetId) : undefined,
    locationId: query.locationId ? Number(query.locationId) : undefined,
    status: query.status || undefined,
    maintenanceType: query.maintenanceType || undefined,
    priority: query.priority || undefined,
    dueFrom: query.dueFrom || undefined,
    dueTo: query.dueTo || undefined,
  };
  const [items, total] = await Promise.all([
    model.findAll({ ...filters, limit, offset }),
    model.count(filters),
  ]);
  const templateMap = await scheduleTemplateModel.listGroupedByScheduleIds(
    items.map((s) => s.scheduleId),
  );
  const enriched = items.map((s) =>
    attachTemplatesToSchedule(s, templateMap.get(Number(s.scheduleId)) || []),
  );
  return paginatedResult(enriched, total, page, limit);
}

export async function getById(id) {
  const schedule = await model.findById(id);
  if (!schedule) throw createError("Không tìm thấy lịch bảo trì", 404);
  return enrichSchedule(schedule);
}

export async function create(data, createdBy) {
  const asset = await assetModel.findById(data.assetId);
  if (!asset) throw createError("Không tìm thấy tài sản", 404);
  const templateIds = normalizeChecklistTemplateIds(data);
  await validateTemplatesForAsset(templateIds, asset);
  const checklistTemplateId = templateIds[0] ?? null;
  const normalized = {
    ...data,
    scheduleName: data.scheduleName?.trim() || "",
    maintenanceType: data.maintenanceType?.toUpperCase(),
    frequencyUnit: data.frequencyUnit?.toUpperCase(),
    priority: data.priority?.toUpperCase(),
    checklistTemplateId,
    status: "DRAFT", // Phải được phê duyệt trước khi kích hoạt
    createdBy,
  };
  // Với lịch theo ngày: NextDueDate = StartDate + 1 chu kỳ (lần bảo trì đầu tiên đến hạn sau 1 kỳ)
  if (
    normalized.frequencyUnit !== "HOURS" &&
    normalized.startDate &&
    normalized.frequencyValue
  ) {
    normalized.nextDueDate = calcNextDueDate(
      normalized.startDate,
      normalized.frequencyValue,
      normalized.frequencyUnit,
    );
  }
  const id = await model.create(normalized);
  await scheduleTemplateModel.replaceForSchedule(id, templateIds);
  return enrichSchedule(await model.findById(id));
}

const EDITABLE_STATUSES_PRE_APPROVAL = ["DRAFT", "REJECTED"];
const EDITABLE_STATUSES_POST_APPROVAL = ["PENDING", "IN_PROGRESS", "OVERDUE"];

/** WO còn hoạt động — đồng bộ slot checklist khi sửa danh sách mẫu trên lịch. */
const WO_STATUSES_ENSURE_CHECKLIST_SLOTS = [
  "PENDING_APPROVAL",
  "WAITING",
  "IN_PROGRESS",
  "PAUSED",
  "AWAITING_CLOSURE",
];

/** WO sẽ huỷ kèm khi xoá lịch (chưa khởi động → an toàn). */
const WO_CANCELLABLE_ON_SCHEDULE_DELETE = ["PENDING_APPROVAL", "WAITING"];
/** WO buộc giữ lại để bảo toàn lịch sử (đã thực hiện hoặc đã đóng). */
const WO_KEEP_ON_SCHEDULE_DELETE = [
  "IN_PROGRESS",
  "PAUSED",
  "AWAITING_CLOSURE",
  "COMPLETED",
  "CANCELLED",
];

const TRUONG_CA_POSITION_ID = 3;

/**
 * Quyền sửa lịch theo role + status.
 * Pre-approval (DRAFT/REJECTED): KTS, Admin/TP → OK; TC không sửa được.
 * Post-approval (PENDING/IN_PROGRESS/OVERDUE): Admin/TP/TC → OK; KTS không sửa được.
 */
function canEditScheduleByRole({ status, actorLevel = 0, actorPositionId = 0 }) {
  if (actorLevel >= 4) return true;
  const isTruongCa = Number(actorPositionId) === TRUONG_CA_POSITION_ID;
  const isTruongPhongOrPKT = actorLevel >= 3 && !isTruongCa;
  if (EDITABLE_STATUSES_PRE_APPROVAL.includes(status)) {
    if (isTruongCa) return false;
    return actorLevel >= 2;
  }
  if (EDITABLE_STATUSES_POST_APPROVAL.includes(status)) {
    return isTruongPhongOrPKT || isTruongCa;
  }
  return false;
}

/**
 * Gửi lịch vào luồng phê duyệt: trạng thái lịch → PENDING_APPROVAL (chờ Trưởng ca).
 */
export async function submitForApproval(scheduleId, submitterId) {
  const schedule = await getById(scheduleId);
  if (!["DRAFT", "REJECTED"].includes(schedule.status)) {
    throw createError(
      "Chỉ gửi phê duyệt khi lịch ở Bản nháp hoặc Từ chối",
      400,
    );
  }
  if (
    await approvalLogModel.hasPendingForResource(
      Number(scheduleId),
      "MAINTENANCE_PLAN",
    )
  ) {
    throw createError("Lịch này đang có yêu cầu phê duyệt chờ xử lý", 400);
  }
  await approvalSvc.submit({
    resourceType: "MAINTENANCE_PLAN",
    resourceId: Number(scheduleId),
    submitterId,
  });
  await model.updateStatus(scheduleId, "PENDING_APPROVAL");
  return model.findById(scheduleId);
}

export async function update(id, data, opts = {}) {
  const schedule = await getById(id);
  const allowed = canEditScheduleByRole({
    status: schedule.status,
    actorLevel: opts.actorLevel,
    actorPositionId: opts.actorPositionId,
  });
  if (!allowed) {
    throw createError(
      "Bạn không có quyền sửa lịch ở trạng thái hiện tại",
      403,
    );
  }
  const payload = { ...data };
  delete payload.status;
  delete payload.checklistTemplateIds;

  const effectiveAssetId =
    payload.assetId != null && payload.assetId !== ""
      ? Number(payload.assetId)
      : Number(schedule.assetId);
  const assetForCheck = await assetModel.findById(effectiveAssetId);
  if (!assetForCheck) throw createError("Không tìm thấy tài sản", 404);

  let templateIdsToSave = null;
  if (data.checklistTemplateIds !== undefined) {
    templateIdsToSave = normalizeChecklistTemplateIds(data);
    await validateTemplatesForAsset(templateIdsToSave, assetForCheck);
    payload.checklistTemplateId = templateIdsToSave[0] ?? null;
  } else if (payload.checklistTemplateId !== undefined) {
    if (payload.checklistTemplateId === "" || payload.checklistTemplateId == null) {
      payload.checklistTemplateId = null;
      templateIdsToSave = [];
    } else {
      const tid = Number(payload.checklistTemplateId);
      if (!Number.isFinite(tid) || tid <= 0) {
        throw createError("ChecklistTemplateID không hợp lệ", 400);
      }
      templateIdsToSave = [tid];
      await validateTemplatesForAsset(templateIdsToSave, assetForCheck);
      payload.checklistTemplateId = tid;
    }
  }

  await model.update(id, payload);
  if (templateIdsToSave !== null) {
    await scheduleTemplateModel.replaceForSchedule(id, templateIdsToSave);
    const openWos = await workOrderModel.findByScheduleAndStatuses(
      id,
      WO_STATUSES_ENSURE_CHECKLIST_SLOTS,
    );
    for (const w of openWos) {
      const slots = await scheduledChecklistSlotModel.findAllByWorkOrderId(
        w.woId,
      );
      let dueDate = w.plannedDate
        ? String(w.plannedDate).trim().slice(0, 10)
        : null;
      if (dueDate === "0000-00-00" || !dueDate) {
        dueDate = slots[0]?.dueDate
          ? String(slots[0].dueDate).slice(0, 10)
          : new Date().toISOString().split("T")[0];
      }
      await scheduledChecklistSlotModel.ensureSlotsForWorkOrder({
        scheduleId: Number(id),
        assetId: effectiveAssetId,
        workOrderId: Number(w.woId),
        dueDate,
        templateIds: templateIdsToSave,
      });
    }
  }
  return enrichSchedule(await model.findById(id));
}

/**
 * Preview xoá lịch — phân loại WO liên quan để UI hỏi xác nhận đúng tình huống.
 *   - willCancel: WO ở PENDING_APPROVAL/WAITING (chưa khởi động) — sẽ chuyển CANCELLED.
 *   - willKeep:   WO IN_PROGRESS/PAUSED/AWAITING_CLOSURE/COMPLETED/CANCELLED — giữ nguyên,
 *                 FK ScheduleID sẽ tự về NULL khi xoá lịch (schema 020).
 */
export async function getDeletePreview(id) {
  const schedule = await getById(id);
  const [willCancel, willKeep] = await Promise.all([
    workOrderModel.findByScheduleAndStatuses(
      id,
      WO_CANCELLABLE_ON_SCHEDULE_DELETE,
    ),
    workOrderModel.findByScheduleAndStatuses(id, WO_KEEP_ON_SCHEDULE_DELETE),
  ]);
  return {
    schedule: {
      scheduleId: schedule.scheduleId,
      scheduleName: schedule.scheduleName,
      status: schedule.status,
      assetName: schedule.assetName,
      preApproval: ["DRAFT", "PENDING_APPROVAL", "REJECTED"].includes(
        schedule.status,
      ),
    },
    woGroups: {
      willCancel,
      willKeep,
    },
  };
}

/**
 * Xoá lịch bảo trì — hỗ trợ cả pre-approval và post-approval.
 * Tự động huỷ các WO chưa khởi động (PENDING_APPROVAL/WAITING) để tránh phiếu mồ côi.
 * Các WO đã/đang thực hiện được giữ lại; FK ScheduleID tự SET NULL theo schema.
 */
export async function remove(id, opts = {}) {
  const schedule = await getById(id);
  const actorLevel = Number(opts.actorLevel) || 0;
  const actorPositionId = Number(opts.actorPositionId) || 0;
  const isAdminOrTP =
    actorLevel >= 4 ||
    (actorLevel >= 3 && actorPositionId !== TRUONG_CA_POSITION_ID);
  if (!isAdminOrTP) {
    throw createError("Bạn không có quyền xoá lịch bảo trì", 403);
  }
  const cancellable = await workOrderModel.findByScheduleAndStatuses(
    id,
    WO_CANCELLABLE_ON_SCHEDULE_DELETE,
  );
  if (cancellable.length > 0) {
    await workOrderModel.cancelByIds(cancellable.map((w) => w.woId));
  }
  await model.remove(id);
  return {
    deletedScheduleId: Number(id),
    cancelledWorkOrderIds: cancellable.map((w) => w.woId),
  };
}

export async function updateStatus(id, status, opts = {}) {
  if ((opts.actorLevel ?? 0) < 4) {
    throw createError(
      "Chỉ quản trị viên được đổi trạng thái lịch thủ công",
      403,
    );
  }
  await getById(id);
  await model.updateStatus(id, status);
  return model.findById(id);
}

/**
 * Tạo WO từ lịch đã duyệt: workOrder.createFromApprovedSchedule → WAITING (không phê duyệt phiếu lặp).
 * Sau đó: cập nhật LastExecutedDate / NextDueDate cho lịch theo ngày.
 */
export async function generateWorkOrder(scheduleId, createdBy) {
  const schedule = await getById(scheduleId);
  if (schedule.frequencyUnit === "HOURS") {
    throw createError(
      "Lịch dự báo theo giờ không tạo phiếu từ lịch — phiếu PM tự sinh khi vượt ngưỡng giờ chạy (bộ đếm tài sản).",
      400,
    );
  }
  if (!["PENDING", "IN_PROGRESS", "OVERDUE"].includes(schedule.status)) {
    throw createError(
      "Chỉ tạo WO từ lịch đã phê duyệt (đang chờ thực hiện / đang TH / quá hạn)",
      400,
    );
  }
  const todayPlanned = new Date().toISOString().split("T")[0];
  /**
   * DueDate slot: ưu tiên NextDueDate/StartDate hợp lệ của lịch; nếu DB còn zero date (0000-00-00) thì
   * trùng với ngày kế hoạch phiếu (hôm nay khi tạo) để mọi lượt đều có mốc trong kỳ báo cáo.
   */
  const dueDateForSlot =
    pickValidYmd(schedule.nextDueDate) ||
    pickValidYmd(schedule.startDate) ||
    todayPlanned;

  const woId = await workOrderSvc.createFromApprovedSchedule({
    scheduleId,
    assetId: schedule.assetId,
    priority:
      schedule.priority === "URGENT" ? "HIGH" : schedule.priority || "MEDIUM",
    description: `Phiếu từ lịch "${schedule.scheduleName || `#${scheduleId}`}": ${schedule.description}`,
    plannedDate: todayPlanned,
    createdBy,
  });

  await scheduledChecklistSlotModel.ensureSlotsForWorkOrder({
    scheduleId,
    assetId: schedule.assetId,
    dueDate: dueDateForSlot,
    workOrderId: woId,
  });

  // Với lịch theo ngày: cập nhật LastExecutedDate = hôm nay, tính NextDueDate mới
  if (schedule.frequencyUnit !== "HOURS" && schedule.frequencyValue) {
    const today = new Date().toISOString().split("T")[0];
    const nextDue = calcNextDueDate(
      today,
      schedule.frequencyValue,
      schedule.frequencyUnit,
    );
    await model.setExecuted(scheduleId, today, nextDue);
  }

  return { workOrderId: woId, scheduleId };
}

/**
 * Kiểm tra toàn bộ lịch theo ngày (DAYS/WEEKS/MONTHS/YEARS):
 * - Quá hạn (NextDueDate <= hôm nay): tự động tạo WO + đánh Status = OVERDUE + thông báo
 *   (sau khi tạo WO, NextDueDate được cộng thêm 1 chu kỳ → không tạo trùng lần sau)
 * - Sắp đến hạn trong WARN_DAYS ngày: gửi thông báo cảnh báo
 * Được gọi khi server khởi động và mỗi ngày.
 */
export async function checkCalendarSchedules() {
  const schedules = await model.findActiveCalendarSchedules();

  for (const s of schedules) {
    if (!s.nextDueDate) continue;
    const days = daysUntil(s.nextDueDate);

    if (days <= 0) {
      // Đến hạn hoặc quá hạn → tự động tạo WO
      // Sau khi generateWorkOrder chạy: LastExecutedDate = hôm nay, NextDueDate tiến lên
      // → lần check tiếp theo days > 0 → không tạo trùng
      let autoWorkOrderId = null;
      try {
        const { workOrderId } = await generateWorkOrder(s.scheduleId, null);
        autoWorkOrderId = workOrderId;
        console.log(
          `[Scheduler] Auto WO #${workOrderId} ← lịch #${s.scheduleId} "${s.scheduleName}" (${Math.abs(days)} ngày ${days < 0 ? "quá hạn" : "đến hạn hôm nay"})`,
        );
      } catch (err) {
        console.error(
          `[Scheduler] Lỗi tạo WO từ lịch #${s.scheduleId}:`,
          err.message,
        );
      }

      if (autoWorkOrderId != null) {
        await notifService.notifyManagers(
          days < 0
            ? `[TỰ ĐỘNG] Đã tạo phiếu việc cho lịch "${s.scheduleName}" (tài sản: ${s.assetName}) — quá hạn ${Math.abs(days)} ngày.`
            : `[TỰ ĐỘNG] Đã tạo phiếu việc cho lịch "${s.scheduleName}" (tài sản: ${s.assetName}) — đến hạn hôm nay.`,
          "MAINTENANCE_DUE",
          2,
          { resourceType: "WORK_ORDER", resourceId: autoWorkOrderId },
        );
      }
    } else if (days <= WARN_DAYS) {
      // Sắp đến hạn → chỉ cảnh báo, chưa tạo WO
      await notifService.notifyManagers(
        `[SẮP ĐẾN HẠN] Lịch bảo trì "${s.scheduleName}" của tài sản ${s.assetName} đến hạn sau ${days} ngày (${s.nextDueDate}).`,
        "MAINTENANCE_DUE",
        2,
        { resourceType: "MAINTENANCE_PLAN", resourceId: s.scheduleId },
      );
    }
  }

  return schedules.length;
}
