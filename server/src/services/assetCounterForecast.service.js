/**
 * assetCounterForecast.service.js — Tính lại EstimatedNextPMDate từ bộ đếm + lịch HOURS (không import workOrder).
 * Gọi sau PM / reset LastMaintenanceTotal; tránh lệch ngày dự báo cũ trên UI.
 * Liên quan: assetCounter.service.js (recordReading), workOrder.service.js, checklist.service.js.
 */
import * as model from '../models/assetCounter.model.js';
import * as schedModel from '../models/maintenanceSchedule.model.js';
import * as assetModel from '../models/asset.model.js';

/**
 * Đồng bộ TB/ngày + ngày PM dự báo vào AssetCounters (không tạo WO, không gửi noti).
 */
export async function recalculateEstimatedNextPMDate(assetId) {
  const [asset, counter] = await Promise.all([
    assetModel.findById(assetId),
    model.findByAsset(assetId),
  ]);
  if (!asset || !counter) return;

  const { total: sumDelta, actualDays } = await model.sumDeltaHoursLastDays(assetId, 30);
  let days = actualDays > 0 ? actualDays : null;
  if (!days && asset.commissionDate) {
    const commission = new Date(asset.commissionDate);
    const today = new Date();
    days = Math.floor((today - commission) / (1000 * 60 * 60 * 24));
  }
  days = Math.max(days || 1, 1);
  let avgHoursPerDay = Number((sumDelta / days).toFixed(2));
  if (avgHoursPerDay <= 0) {
    avgHoursPerDay = Number(counter.averageHoursPerDay) || 0;
  }

  const schedules = await schedModel.findHourlyByAsset(assetId);
  let estimatedNextPMDate = null;

  if (schedules.length > 0 && avgHoursPerDay > 0) {
    const threshold = schedules[0].frequencyValue;
    const lastMaintTotal = counter.lastMaintenanceTotal ?? 0;
    const totalHours = Number(counter.totalAccumulatedHours) || 0;
    const hoursUsed = totalHours - lastMaintTotal;
    const hoursRemain = threshold - hoursUsed;

    if (hoursRemain <= 0) {
      estimatedNextPMDate = new Date().toISOString().split('T')[0];
    } else {
      const daysLeft = Math.floor(hoursRemain / avgHoursPerDay);
      const pmDate = new Date();
      pmDate.setDate(pmDate.getDate() + daysLeft);
      estimatedNextPMDate = pmDate.toISOString().split('T')[0];
    }
  }

  await model.upsert(assetId, {
    totalAccumulatedHours: counter.totalAccumulatedHours,
    lastReadingValue: counter.lastReadingValue,
    averageHoursPerDay: avgHoursPerDay,
    estimatedNextPMDate,
    lastMaintenanceTotal: counter.lastMaintenanceTotal,
  });
}
