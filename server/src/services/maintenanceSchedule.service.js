/**
 * maintenanceSchedule.service.js — Nghiệp vụ lập lịch bảo trì + tạo WorkOrder từ lịch.
 * Hai kiểu nghiệp vụ:
 *   - Định kỳ: DAYS/WEEKS/MONTHS/YEARS — NextDueDate, scheduler + nút tạo WO từ lịch.
 *   - Dự báo: HOURS — ngưỡng giờ chạy; WO do assetCounter.recordReading khi vượt ngưỡng (không generateWorkOrder từ lịch).
 * Luồng phê duyệt lịch (quy trình đề tài):
 *   DRAFT | REJECTED → gửi SUBMIT → PENDING_APPROVAL → Trưởng ca duyệt → PENDING (chờ TH) | REJECTED | DRAFT (yêu cầu sửa)
 * Liên quan: models/maintenanceSchedule.model.js, services/notification.service.js.
 */
import { createError } from "../utils/createError.js";
import { getPagination, paginatedResult } from "../utils/paginate.js";
import * as model from "../models/maintenanceSchedule.model.js";
import * as assetModel from "../models/asset.model.js";
import * as workOrderSvc from "./workOrder.service.js";
import * as notifService from "./notification.service.js";
import * as approvalSvc from "./approval.service.js";
import * as approvalLogModel from "../models/approvalLog.model.js";

/** Số ngày cảnh báo trước khi đến hạn */
const WARN_DAYS = 7;

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

export async function getAll(query) {
  const { page, limit, offset } = getPagination(query);
  const filters = {
    assetId: query.assetId ? Number(query.assetId) : undefined,
    status: query.status || undefined,
    maintenanceType: query.maintenanceType || undefined,
    priority: query.priority || undefined,
  };
  const [items, total] = await Promise.all([
    model.findAll({ ...filters, limit, offset }),
    model.count(filters),
  ]);
  return paginatedResult(items, total, page, limit);
}

export async function getById(id) {
  const schedule = await model.findById(id);
  if (!schedule) throw createError("Không tìm thấy lịch bảo trì", 404);
  return schedule;
}

export async function create(data, createdBy) {
  const asset = await assetModel.findById(data.assetId);
  if (!asset) throw createError("Không tìm thấy tài sản", 404);
  const normalized = {
    ...data,
    scheduleName: data.scheduleName?.trim() || "",
    maintenanceType: data.maintenanceType?.toUpperCase(),
    frequencyUnit: data.frequencyUnit?.toUpperCase(),
    priority: data.priority?.toUpperCase(),
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
  return model.findById(id);
}

const EDITABLE_STATUSES = ["DRAFT", "REJECTED"];
const DELETABLE_STATUSES = ["DRAFT", "REJECTED"];

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
  const bypass = (opts.actorLevel ?? 0) >= 4;
  if (!bypass && !EDITABLE_STATUSES.includes(schedule.status)) {
    throw createError(
      "Chỉ sửa được lịch ở trạng thái Bản nháp hoặc Từ chối",
      400,
    );
  }
  const payload = { ...data };
  delete payload.status;
  await model.update(id, payload);
  return model.findById(id);
}

export async function remove(id, opts = {}) {
  const schedule = await getById(id);
  const bypass = (opts.actorLevel ?? 0) >= 4;
  if (!bypass && !DELETABLE_STATUSES.includes(schedule.status)) {
    throw createError("Chỉ xóa được lịch Bản nháp hoặc Từ chối", 400);
  }
  await model.remove(id);
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
  const woId = await workOrderSvc.createFromApprovedSchedule({
    scheduleId,
    assetId: schedule.assetId,
    priority:
      schedule.priority === "URGENT" ? "HIGH" : schedule.priority || "MEDIUM",
    description: `Phiếu từ lịch "${schedule.scheduleName || `#${scheduleId}`}": ${schedule.description}`,
    plannedDate: new Date().toISOString().split("T")[0],
    createdBy,
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
      try {
        const { workOrderId } = await generateWorkOrder(s.scheduleId, null);
        console.log(
          `[Scheduler] Auto WO #${workOrderId} ← lịch #${s.scheduleId} "${s.scheduleName}" (${Math.abs(days)} ngày ${days < 0 ? "quá hạn" : "đến hạn hôm nay"})`,
        );
      } catch (err) {
        console.error(
          `[Scheduler] Lỗi tạo WO từ lịch #${s.scheduleId}:`,
          err.message,
        );
      }

      await notifService.notifyManagers(
        days < 0
          ? `[TỰ ĐỘNG] Đã tạo phiếu việc cho lịch "${s.scheduleName}" (tài sản: ${s.assetName}) — quá hạn ${Math.abs(days)} ngày.`
          : `[TỰ ĐỘNG] Đã tạo phiếu việc cho lịch "${s.scheduleName}" (tài sản: ${s.assetName}) — đến hạn hôm nay.`,
        "MAINTENANCE_DUE",
        2,
      );
    } else if (days <= WARN_DAYS) {
      // Sắp đến hạn → chỉ cảnh báo, chưa tạo WO
      await notifService.notifyManagers(
        `[SẮP ĐẾN HẠN] Lịch bảo trì "${s.scheduleName}" của tài sản ${s.assetName} đến hạn sau ${days} ngày (${s.nextDueDate}).`,
        "MAINTENANCE_DUE",
        2,
      );
    }
  }

  return schedules.length;
}
