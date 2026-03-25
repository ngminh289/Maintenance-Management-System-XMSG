/**
 * assetCounter.service.js — Bộ đếm giờ chạy máy + dự báo ngày bảo trì tiếp theo.
 * luong1.rule: nhập giờ → DeltaHours → TotalHours → AvgHoursPerDay → EstimatedNextPMDate.
 * Liên quan: models/assetCounter.model.js, models/maintenanceSchedule.model.js, services/notification.service.js.
 */
import { createError }  from '../utils/createError.js';
import * as model       from '../models/assetCounter.model.js';
import * as schedModel  from '../models/maintenanceSchedule.model.js';
import * as assetModel  from '../models/asset.model.js';
import * as notifService from './notification.service.js';

const WARN_DAYS_THRESHOLD = 7; // Cảnh báo khi còn <= 7 ngày đến ngưỡng

export async function getCounter(assetId) {
  const asset = await assetModel.findById(assetId);
  if (!asset) throw createError('Không tìm thấy tài sản', 404);
  const counter = await model.findByAsset(assetId) ?? {
    assetId, totalAccumulatedHours: 0, lastReadingValue: 0,
    averageHoursPerDay: 0, estimatedNextPMDate: null, lastMaintenanceTotal: 0,
  };
  const schedules = await schedModel.findHourlyByAsset(assetId);
  return { asset, counter, hourlySchedules: schedules };
}

/**
 * Nhập giá trị giờ chạy từ đồng hồ máy.
 * Tự động cập nhật TotalHours, tính AvgHoursPerDay, EstimatedNextPMDate.
 */
export async function recordReading({ assetId, readingValue, checklistId = null, dataSource = 'MANUAL' }) {
  const counter = await model.findByAsset(assetId);
  const lastReading = counter?.lastReadingValue ?? 0;

  if (readingValue < lastReading) throw createError('Giá trị đồng hồ không thể nhỏ hơn lần trước', 400);

  const deltaHours = readingValue - lastReading;
  const totalHours = (counter?.totalAccumulatedHours ?? 0) + deltaHours;

  // Ghi log vào AssetRuntimeLogs
  await model.createRuntimeLog({ assetId, readingValue, deltaHours, checklistId, dataSource });

  // Tính tốc độ trung bình (30 ngày gần nhất)
  const { total: sumDelta, actualDays } = await model.sumDeltaHoursLastDays(assetId, 30);
  const days = Math.max(actualDays || 1, 1);
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
      // Đã vượt ngưỡng — cần bảo trì ngay
      estimatedNextPMDate = new Date().toISOString().split('T')[0];
      await notifService.notifyManagers(
        `Máy #${assetId} đã vượt ngưỡng giờ bảo trì (${threshold}h). Cần xử lý ngay!`,
        'MAINTENANCE_DUE', 2,
      );
    } else {
      const daysLeft = Math.floor(hoursRemain / avgHoursPerDay);
      const pmDate = new Date();
      pmDate.setDate(pmDate.getDate() + daysLeft);
      estimatedNextPMDate = pmDate.toISOString().split('T')[0];

      if (daysLeft <= WARN_DAYS_THRESHOLD) {
        await notifService.notifyManagers(
          `Máy #${assetId} dự kiến đến ngưỡng bảo trì sau ${daysLeft} ngày (${estimatedNextPMDate})`,
          'MAINTENANCE_DUE', 2,
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

  return { deltaHours, totalHours, avgHoursPerDay, estimatedNextPMDate };
}

/** Gọi sau khi hoàn thành bảo trì — cập nhật LastMaintenanceTotal */
export async function resetAfterMaintenance(assetId) {
  const counter = await model.findByAsset(assetId);
  if (!counter) return;
  await model.setLastMaintenanceTotal(assetId, counter.totalAccumulatedHours);
}

export async function getHistory(assetId, limit = 30) {
  const asset = await assetModel.findById(assetId);
  if (!asset) throw createError('Không tìm thấy tài sản', 404);
  return model.getHistory(assetId, limit);
}
