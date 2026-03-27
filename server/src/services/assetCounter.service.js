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
import * as workOrderSvc from './workOrder.service.js';

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
  const [asset, counter] = await Promise.all([
    assetModel.findById(assetId),
    model.findByAsset(assetId),
  ]);
  if (!asset) throw createError('Không tìm thấy tài sản', 404);

  const lastReading = counter?.lastReadingValue ?? 0;
  if (readingValue < lastReading) throw createError('Giá trị đồng hồ không thể nhỏ hơn lần trước', 400);

  const deltaHours = readingValue - lastReading;
  const totalHours = (counter?.totalAccumulatedHours ?? 0) + deltaHours;

  // Ghi log vào AssetRuntimeLogs
  await model.createRuntimeLog({ assetId, readingValue, deltaHours, checklistId, dataSource });

  // Tính tốc độ trung bình (30 ngày gần nhất)
  // Fix: sau khi INSERT, actualDays = DATEDIFF(NOW(), NOW()) = 0 nếu đây là log đầu tiên.
  // → Dùng commissionDate làm điểm tham chiếu để chia cho số ngày thực tế máy đã hoạt động.
  const { total: sumDelta, actualDays } = await model.sumDeltaHoursLastDays(assetId, 30);

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
      // luong1.rule: Tự động tạo WorkOrder PREDICTIVE khi vượt ngưỡng giờ
      estimatedNextPMDate = new Date().toISOString().split('T')[0];
      const woId = await workOrderSvc.createAutomatic({
        assetId,
        woSource:    'PREDICTIVE',
        priority:    'HIGH',
        description: `Đã vượt ngưỡng ${threshold}h chạy — cần bảo trì dự báo`,
        createdBy:   null,
      });
      await notifService.notifyManagers(
        `Máy #${assetId} đã vượt ngưỡng ${threshold}h. Đã tạo phiếu WO #${woId} chờ phê duyệt.`,
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
