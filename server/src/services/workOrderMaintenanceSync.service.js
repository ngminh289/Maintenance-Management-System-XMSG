/**
 * workOrderMaintenanceSync.service.js — Sau WO hoàn thành: ghi lịch sử bảo trì + đồng bộ giờ ↔ lịch ngày.
 * - PREDICTIVE | SCHEDULE | MANUAL: reset LastMaintenanceTotal + tính lại ngày PM dự báo; lịch ngày quá hạn → lùi NextDueDate từ ngày hoàn thành.
 * - SCHEDULE có scheduleId: cập nhật LastExecutedDate phiếu gắn lịch.
 * - CORRECTIVE: chỉ ghi lịch sử (không reset chu kỳ PM định kỳ).
 * Không import workOrder.service — tránh vòng phụ thuộc.
 */
import * as historyModel from "../models/assetMaintenanceHistory.model.js";
import * as assetCounterModel from "../models/assetCounter.model.js";
import * as assetCounterForecast from "./assetCounterForecast.service.js";
import * as schedModel from "../models/maintenanceSchedule.model.js";
import * as woModel from "../models/workOrder.model.js";
import * as photoModel from "../models/workOrderPhoto.model.js";

function calcNextDueDate(baseDateStr, value, unit) {
  const d = new Date(baseDateStr);
  const v = Number(value) || 0;
  switch (unit) {
    case "DAYS":
      d.setDate(d.getDate() + v);
      break;
    case "WEEKS":
      d.setDate(d.getDate() + v * 7);
      break;
    case "MONTHS":
      d.setMonth(d.getMonth() + v);
      break;
    case "YEARS":
      d.setFullYear(d.getFullYear() + v);
      break;
    default:
      break;
  }
  return d.toISOString().split("T")[0];
}

/** Lịch theo ngày đã tới/quá hạn so với ngày hoàn thành WO → coi như đã PM, lùi chu kỳ. */
export async function bumpStaleCalendarSchedules(assetId, completedDateStr) {
  const rows = await schedModel.findCalendarOperationalByAsset(assetId);
  for (const s of rows) {
    if (!s.nextDueDate) continue;
    if (s.nextDueDate <= completedDateStr) {
      const next = calcNextDueDate(
        completedDateStr,
        s.frequencyValue,
        s.frequencyUnit,
      );
      await schedModel.setExecuted(s.scheduleId, completedDateStr, next);
    }
  }
}

/**
 * @param {object} wo — bản ghi từ workOrder.model.findById (đã COMPLETED, có actualDate).
 */
export async function afterWorkOrderCompleted(wo) {
  if (!wo?.assetId || wo.status !== "COMPLETED") return;

  const counter = await assetCounterModel.findByAsset(wo.assetId);
  const totalRt =
    counter != null ? Number(counter.totalAccumulatedHours) : null;

  const assignRows = await woModel.getAssignments(wo.woId);
  const technicianSummary = assignRows.length
    ? assignRows
        .map((a) => a.fullName)
        .filter(Boolean)
        .join(", ")
        .slice(0, 500)
    : null;
  const photoCount = await photoModel.countByWorkOrder(wo.woId);

  await historyModel.create({
    assetId: wo.assetId,
    workOrderId: wo.woId,
    scheduleId: wo.scheduleId ?? null,
    woSource: wo.woSource || "MANUAL",
    completedDate: wo.actualDate || new Date().toISOString().split("T")[0],
    actualHours:
      wo.actualHours != null && wo.actualHours !== ""
        ? Number(wo.actualHours)
        : null,
    totalRuntimeHours: Number.isFinite(totalRt) ? totalRt : null,
    description: wo.description,
    fieldNotes: wo.closureFieldNotes ?? null,
    partsNotes: wo.closurePartsNotes ?? null,
    technicianSummary,
    photoCount,
  });

  if (wo.woSource === "CORRECTIVE") return;

  const doneDate = wo.actualDate || new Date().toISOString().split("T")[0];

  if (counter) {
    await assetCounterModel.setLastMaintenanceTotal(
      wo.assetId,
      counter.totalAccumulatedHours,
    );
    await assetCounterForecast.recalculateEstimatedNextPMDate(wo.assetId);
  }

  if (wo.scheduleId) {
    await schedModel.patchLastExecutedDate(wo.scheduleId, doneDate);
  }

  await bumpStaleCalendarSchedules(wo.assetId, doneDate);
}

export async function getMaintenanceHistoryForAsset(assetId, limit = 80) {
  return historyModel.findByAsset(assetId, limit);
}
