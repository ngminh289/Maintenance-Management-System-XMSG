/**
 * assetCounter.service.js — Bộ đếm giờ chạy máy + dự báo ngày bảo trì tiếp theo.
 * luong1.rule / 1.1–2.1: Reading → RuntimeLogs → TB 30 ngày → so ngưỡng HOURS → cảnh báo / WO PREDICTIVE.
 * Nhật ký thuật toán: AssetPredictiveEventLog; reset LastMaintenanceTotal khi WO PREDICTIVE hoàn thành (workOrder.service).
 * Liên quan: models/assetCounter.model.js, assetPredictiveEvent.model.js, workOrder.model.js, maintenanceSchedule.model.js.
 */
import { createError } from "../utils/createError.js";
import * as model from "../models/assetCounter.model.js";
import * as predEvtModel from "../models/assetPredictiveEvent.model.js";
import * as workOrderModel from "../models/workOrder.model.js";
import * as schedModel from "../models/maintenanceSchedule.model.js";
import * as assetModel from "../models/asset.model.js";
import * as notifService from "./notification.service.js";
import * as workOrderSvc from "./workOrder.service.js";
import * as forecastSvc from "./assetCounterForecast.service.js";

const WARN_DAYS_THRESHOLD = 7; // Cảnh báo khi còn <= 7 ngày đến ngưỡng

export async function getCounter(assetId) {
  const asset = await assetModel.findById(assetId);
  if (!asset) throw createError("Không tìm thấy tài sản", 404);
  const counter = (await model.findByAsset(assetId)) ?? {
    assetId,
    totalAccumulatedHours: 0,
    lastReadingValue: 0,
    averageHoursPerDay: 0,
    estimatedNextPMDate: null,
    lastMaintenanceTotal: 0,
  };
  const schedules = await schedModel.findHourlyByAsset(assetId);
  return { asset, counter, hourlySchedules: schedules };
}

/**
 * Nhập giá trị giờ chạy từ đồng hồ máy.
 * Tự động cập nhật TotalHours, tính AvgHoursPerDay, EstimatedNextPMDate.
 */
export async function recordReading({
  assetId,
  readingValue,
  checklistId = null,
  dataSource = "MANUAL",
}) {
  const [asset, counter] = await Promise.all([
    assetModel.findById(assetId),
    model.findByAsset(assetId),
  ]);
  if (!asset) throw createError("Không tìm thấy tài sản", 404);

  const lastReading = counter?.lastReadingValue ?? 0;
  if (readingValue < lastReading)
    throw createError("Giá trị đồng hồ không thể nhỏ hơn lần trước", 400);

  const deltaHours = readingValue - lastReading;
  const totalHours = (counter?.totalAccumulatedHours ?? 0) + deltaHours;

  // Ghi log vào AssetRuntimeLogs
  await model.createRuntimeLog({
    assetId,
    readingValue,
    deltaHours,
    checklistId,
    dataSource,
  });

  // Tính tốc độ trung bình (30 ngày gần nhất)
  // Fix: sau khi INSERT, actualDays = DATEDIFF(NOW(), NOW()) = 0 nếu đây là log đầu tiên.
  // → Dùng commissionDate làm điểm tham chiếu để chia cho số ngày thực tế máy đã hoạt động.
  const { total: sumDelta, actualDays } = await model.sumDeltaHoursLastDays(
    assetId,
    30,
  );

  let days = actualDays > 0 ? actualDays : null;
  if (!days && asset.commissionDate) {
    // Tính số ngày từ ngày đưa vào sản xuất đến hôm nay
    const commission = new Date(asset.commissionDate);
    const today = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    days = Math.floor((today - commission) / msPerDay);
  }
  days = Math.max(days || 1, 1); // Tối thiểu 1 ngày

  const avgHoursPerDay = Number((sumDelta / days).toFixed(2));

  // Tính ngày bảo trì dự báo (dựa lịch HOURS)
  const schedules = await schedModel.findHourlyByAsset(assetId);
  let estimatedNextPMDate = null;

  if (schedules.length > 0 && avgHoursPerDay > 0) {
    const threshold = schedules[0].frequencyValue;
    const lastMaintTotal = counter?.lastMaintenanceTotal ?? 0;
    const hoursUsed = totalHours - lastMaintTotal;
    const hoursRemain = threshold - hoursUsed;

    if (hoursRemain <= 0) {
      estimatedNextPMDate = new Date().toISOString().split("T")[0];
      await predEvtModel.create({
        assetId,
        eventType: "THRESHOLD_EXCEEDED",
        detail: `Vượt ngưỡng ${threshold}h (tích lũy sau PM: ${hoursUsed.toFixed(2)}h)`,
      });
      const openPredWoId =
        await workOrderModel.findOpenPredictiveIdByAsset(assetId);
      if (openPredWoId) {
        await predEvtModel.create({
          assetId,
          eventType: "AUTO_WO_SKIPPED_DUPLICATE",
          detail: `Đã có phiếu PREDICTIVE #${openPredWoId} chưa đóng — không tạo trùng`,
          relatedWOId: openPredWoId,
        });
        await notifService.notifyManagers(
          `Máy #${assetId} vẫn vượt ngưỡng ${threshold}h; phiếu WO PREDICTIVE #${openPredWoId} đang mở — không tạo thêm.`,
          "MAINTENANCE_DUE",
          2,
          { resourceType: "WORK_ORDER", resourceId: openPredWoId },
        );
      } else {
        const woId = await workOrderSvc.createAutomatic({
          assetId,
          scheduleId: schedules[0]?.scheduleId ?? null,
          woSource: "PREDICTIVE",
          priority: "HIGH",
          description: `Đã vượt ngưỡng ${threshold}h chạy — cần bảo trì dự báo`,
          createdBy: null,
          checklistDueDate: new Date().toISOString().split("T")[0],
        });
        await predEvtModel.create({
          assetId,
          eventType: "AUTO_WO_CREATED",
          detail: `Tự động tạo WO chờ phê duyệt (ngưỡng ${threshold}h)`,
          relatedWOId: woId,
        });
        await notifService.notifyManagers(
          `Máy #${assetId} đã vượt ngưỡng ${threshold}h. Đã tạo phiếu WO #${woId} chờ phê duyệt.`,
          "MAINTENANCE_DUE",
          2,
          { resourceType: "WORK_ORDER", resourceId: woId },
        );
      }
    } else {
      const daysLeft = Math.floor(hoursRemain / avgHoursPerDay);
      const pmDate = new Date();
      pmDate.setDate(pmDate.getDate() + daysLeft);
      estimatedNextPMDate = pmDate.toISOString().split("T")[0];

      if (daysLeft <= WARN_DAYS_THRESHOLD) {
        await predEvtModel.create({
          assetId,
          eventType: "WARN_DUE_SOON",
          detail: `Còn ~${daysLeft} ngày đến ngưỡng PM (${estimatedNextPMDate}), HoursRemain≈${hoursRemain.toFixed(1)}h`,
        });
        await notifService.notifyManagers(
          `Máy #${assetId} dự kiến đến ngưỡng bảo trì sau ${daysLeft} ngày (${estimatedNextPMDate})`,
          "MAINTENANCE_DUE",
          2,
          { resourceType: "ASSET", resourceId: assetId },
        );
      }
    }
  }

  // Cập nhật AssetCounters
  await model.upsert(assetId, {
    totalAccumulatedHours: totalHours,
    lastReadingValue: readingValue,
    averageHoursPerDay: avgHoursPerDay,
    estimatedNextPMDate,
    lastMaintenanceTotal: null, // giữ nguyên giá trị cũ
  });

  return {
    deltaHours,
    totalHours,
    avgHoursPerDay,
    estimatedNextPMDate,
    hoursRemain:
      schedules.length > 0 && avgHoursPerDay > 0
        ? Number(
            (
              schedules[0].frequencyValue -
              (totalHours - (counter?.lastMaintenanceTotal ?? 0))
            ).toFixed(2),
          )
        : null,
    thresholdHours: schedules[0]?.frequencyValue ?? null,
  };
}

/** Gọi sau khi hoàn thành bảo trì — cập nhật LastMaintenanceTotal + tính lại ngày PM dự báo */
export async function resetAfterMaintenance(assetId) {
  const counter = await model.findByAsset(assetId);
  if (!counter) return;
  await model.setLastMaintenanceTotal(assetId, counter.totalAccumulatedHours);
  await forecastSvc.recalculateEstimatedNextPMDate(assetId);
}

export async function getHistory(assetId, limit = 30) {
  const asset = await assetModel.findById(assetId);
  if (!asset) throw createError("Không tìm thấy tài sản", 404);
  return model.getHistory(assetId, limit);
}

export async function getPredictiveEvents(assetId, limit = 50) {
  const asset = await assetModel.findById(assetId);
  if (!asset) throw createError("Không tìm thấy tài sản", 404);
  return predEvtModel.findByAsset(assetId, limit);
}
