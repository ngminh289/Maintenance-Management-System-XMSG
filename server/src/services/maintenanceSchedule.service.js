/**
 * maintenanceSchedule.service.js — Nghiệp vụ lập lịch bảo trì + tạo WorkOrder từ lịch.
 * Hỗ trợ 2 loại tần suất:
 *   - HOURS   : tích hợp với AssetCounters (assetCounter.service.js)
 *   - DAYS/WEEKS/MONTHS/YEARS : lịch theo ngày — tự tính NextDueDate, cảnh báo trước N ngày
 * Luồng phê duyệt lịch (Workflow sheet):
 *   CV KTS tạo lịch (DRAFT) → POST /:id/submit → Trưởng ca duyệt → PENDING → scheduler kích hoạt
 * Liên quan: models/maintenanceSchedule.model.js, services/notification.service.js.
 */
import { createError } from '../utils/createError.js';
import { getPagination, paginatedResult } from '../utils/paginate.js';
import * as model from '../models/maintenanceSchedule.model.js';
import * as assetModel from '../models/asset.model.js';
import * as workOrderSvc from './workOrder.service.js';
import * as notifService from './notification.service.js';
import * as approvalSvc from './approval.service.js';

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
    case 'DAYS':   d.setDate(d.getDate() + value);       break;
    case 'WEEKS':  d.setDate(d.getDate() + value * 7);   break;
    case 'MONTHS': d.setMonth(d.getMonth() + value);     break;
    case 'YEARS':  d.setFullYear(d.getFullYear() + value); break;
    default:       break;
  }
  return d.toISOString().split('T')[0];
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
  if (!schedule) throw createError('Không tìm thấy lịch bảo trì', 404);
  return schedule;
}

export async function create(data, createdBy) {
  const asset = await assetModel.findById(data.assetId);
  if (!asset) throw createError('Không tìm thấy tài sản', 404);
  const normalized = {
    ...data,
    scheduleName:    data.scheduleName?.trim() || '',
    maintenanceType: data.maintenanceType?.toUpperCase(),
    frequencyUnit:   data.frequencyUnit?.toUpperCase(),
    priority:        data.priority?.toUpperCase(),
    status:          'DRAFT',   // Phải được phê duyệt trước khi kích hoạt
    createdBy,
  };
  // Với lịch theo ngày: NextDueDate = StartDate + 1 chu kỳ (lần bảo trì đầu tiên đến hạn sau 1 kỳ)
  if (normalized.frequencyUnit !== 'HOURS' && normalized.startDate && normalized.frequencyValue) {
    normalized.nextDueDate = calcNextDueDate(normalized.startDate, normalized.frequencyValue, normalized.frequencyUnit);
  }
  const id = await model.create(normalized);
  return model.findById(id);
}

/**
 * Gửi lịch bảo trì vào luồng phê duyệt (Workflow sheet bước 3).
 * Chỉ cho phép khi Status = DRAFT.
 */
export async function submitForApproval(scheduleId, submitterId) {
  const schedule = await getById(scheduleId);
  if (schedule.status !== 'DRAFT') {
    throw createError('Chỉ lịch ở trạng thái DRAFT mới có thể gửi phê duyệt', 400);
  }
  await approvalSvc.submit({ resourceType: 'MAINTENANCE_PLAN', resourceId: Number(scheduleId), submitterId });
  return model.findById(scheduleId);
}

export async function update(id, data) {
  await getById(id);
  await model.update(id, data);
  return model.findById(id);
}

export async function remove(id) {
  await getById(id);
  await model.remove(id);
}

export async function updateStatus(id, status) {
  await getById(id);
  await model.updateStatus(id, status);
  return model.findById(id);
}

/**
 * Tạo Work Order từ lịch bảo trì (kích hoạt thủ công hoặc auto).
 * Sau khi tạo WO thành công: cập nhật LastExecutedDate và NextDueDate cho lịch theo ngày.
 */
export async function generateWorkOrder(scheduleId, createdBy) {
  const schedule = await getById(scheduleId);
  const woId = await workOrderSvc.createAutomatic({
    assetId:     schedule.assetId,
    woSource:    'SCHEDULE',
    priority:    schedule.priority === 'URGENT' ? 'HIGH' : (schedule.priority || 'MEDIUM'),
    description: `Phiếu từ lịch "${schedule.scheduleName || `#${scheduleId}`}": ${schedule.description}`,
    createdBy,
  });

  // Với lịch theo ngày: cập nhật LastExecutedDate = hôm nay, tính NextDueDate mới
  if (schedule.frequencyUnit !== 'HOURS' && schedule.frequencyValue) {
    const today = new Date().toISOString().split('T')[0];
    const nextDue = calcNextDueDate(today, schedule.frequencyValue, schedule.frequencyUnit);
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
        console.log(`[Scheduler] Auto WO #${workOrderId} ← lịch #${s.scheduleId} "${s.scheduleName}" (${Math.abs(days)} ngày ${days < 0 ? 'quá hạn' : 'đến hạn hôm nay'})`);
      } catch (err) {
        console.error(`[Scheduler] Lỗi tạo WO từ lịch #${s.scheduleId}:`, err.message);
      }

      await notifService.create({
        type:      'MAINTENANCE_DUE',
        message:   days < 0
          ? `[TỰ ĐỘNG] Đã tạo phiếu việc cho lịch "${s.scheduleName}" (tài sản: ${s.assetName}) — quá hạn ${Math.abs(days)} ngày.`
          : `[TỰ ĐỘNG] Đã tạo phiếu việc cho lịch "${s.scheduleName}" (tài sản: ${s.assetName}) — đến hạn hôm nay.`,
        assetId:   s.assetId,
        createdBy: null,
      });
    } else if (days <= WARN_DAYS) {
      // Sắp đến hạn → chỉ cảnh báo, chưa tạo WO
      await notifService.create({
        type:      'MAINTENANCE_DUE',
        message:   `[SẮP ĐẾN HẠN] Lịch bảo trì "${s.scheduleName}" của tài sản ${s.assetName} đến hạn sau ${days} ngày (${s.nextDueDate}).`,
        assetId:   s.assetId,
        createdBy: null,
      });
    }
  }

  return schedules.length;
}
