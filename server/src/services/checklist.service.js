/**
 * checklist.service.js — Luồng kiểm tra hiện trường: submit + auto-logic (NG/WARNING/OK).
 * luongxulykiemtra.rule:
 *   OK      → Asset AVAILABLE, WO COMPLETED
 *   WARNING → Asset MAINTENANCE, tạo WO PREDICTIVE PENDING_APPROVAL
 *   NG      → Asset BROKEN,     tạo WO CORRECTIVE EMERGENCY PENDING_APPROVAL
 * Liên quan: services/workOrder.service.js, services/assetCounter.service.js,
 *            services/notification.service.js, models/checklistResult.model.js.
 */
import { createError } from '../utils/createError.js';
import * as templateModel from '../models/checklistTemplate.model.js';
import * as resultModel   from '../models/checklistResult.model.js';
import * as assetModel    from '../models/asset.model.js';
import * as workOrderModel from '../models/workOrder.model.js';
import * as workOrderSvc  from './workOrder.service.js';
import * as counterSvc    from './assetCounter.service.js';
import * as notifService  from './notification.service.js';

// ─── Template Management ─────────────────────────────────────────────────────

export async function getTemplates(assetTypeId) {
  return templateModel.findAll(assetTypeId ? Number(assetTypeId) : undefined);
}

export async function getTemplateById(id) {
  const t = await templateModel.findById(id);
  if (!t) throw createError('Không tìm thấy mẫu checklist', 404);
  return t;
}

export async function createTemplate({ assetTypeId, templateName, description }) {
  const id = await templateModel.createTemplate({ assetTypeId, templateName, description });
  return templateModel.findById(id);
}

export async function updateTemplate(id, data) {
  await getTemplateById(id);
  await templateModel.updateTemplate(id, data);
  return templateModel.findById(id);
}

export async function removeTemplate(id) {
  await getTemplateById(id);
  await templateModel.removeTemplate(id);
}

export async function addItem(templateId, data) {
  await getTemplateById(templateId);
  const itemId = await templateModel.addItem({ templateId: Number(templateId), ...data });
  return templateModel.findById(templateId);
}

export async function updateItem(itemId, data) {
  const affected = await templateModel.updateItem(itemId, data);
  if (!affected) throw createError('Không tìm thấy câu hỏi', 404);
}

export async function removeItem(itemId) {
  await templateModel.removeItem(itemId);
}

// ─── QR Scan Info (dữ liệu trả về khi công nhân quét QR) ────────────────────

export async function getQRInfo(assetId) {
  const asset = await assetModel.findById(assetId);
  if (!asset) throw createError('Không tìm thấy tài sản', 404);

  // Template phù hợp với loại tài sản
  const template = await templateModel.findByAssetTypeId(asset.assetTypeId);
  const templateDetail = template ? await templateModel.findById(template.templateId) : null;

  // Lịch sử checklist gần nhất
  const recentResults = await resultModel.findByAsset(assetId, 5);

  return { asset, checklistTemplate: templateDetail, recentResults };
}

// ─── Submit Checklist ─────────────────────────────────────────────────────────

/**
 * Nộp kết quả checklist + chạy auto-logic theo OverallStatus.
 * Body: { assetId, woId?, readingValue?, overallStatus, evidencePhoto?, notes?, details[] }
 */
export async function submitResult({ assetId, woId, readingValue, overallStatus, evidencePhoto, notes, details, checkerId }) {
  const asset = await assetModel.findById(assetId);
  if (!asset) throw createError('Không tìm thấy tài sản', 404);

  // 1. Tạo ChecklistResult
  const checklistId = await resultModel.create({ assetId, woId, checkerId, overallStatus, evidencePhoto, notes, readingValue });

  // 2. Lưu từng chi tiết câu trả lời
  if (details?.length) {
    await resultModel.createDetails(checklistId, details);
  }

  // 3. Nếu có giá trị đồng hồ → cập nhật bộ đếm giờ (luong1.rule)
  if (readingValue != null) {
    await counterSvc.recordReading({ assetId, readingValue, checklistId, dataSource: 'MANUAL' });
  }

  let newWorkOrderId = null;

  // 4. Auto-logic theo OverallStatus (luongxulykiemtra.rule)
  if (overallStatus === 'OK') {
    await assetModel.updateStatus(assetId, 'AVAILABLE');
    if (woId) await workOrderModel.updateStatus(woId, 'COMPLETED', { actualDate: new Date().toISOString().split('T')[0] });

  } else if (overallStatus === 'WARNING') {
    await assetModel.updateStatus(assetId, 'MAINTENANCE');
    newWorkOrderId = await workOrderSvc.createAutomatic({
      assetId, woSource: 'PREDICTIVE', priority: 'HIGH',
      description: `Cảnh báo từ checklist #${checklistId}: ${asset.assetName}`,
      createdBy: checkerId,
    });
    await notifService.notifyManagers(
      `⚠ Máy [${asset.assetName}] có dấu hiệu bất thường. Checklist #${checklistId}. Đã tạo WO #${newWorkOrderId}.`,
      'SYSTEM_ALERT', 2,
    );

  } else if (overallStatus === 'NG') {
    await assetModel.updateStatus(assetId, 'BROKEN');
    newWorkOrderId = await workOrderSvc.createAutomatic({
      assetId, woSource: 'PREDICTIVE', priority: 'EMERGENCY',
      description: `SỰ CỐ từ checklist #${checklistId}: ${asset.assetName} NGỪNG HOẠT ĐỘNG`,
      createdBy: checkerId,
    });
    await notifService.notifyManagers(
      `🔴 SỰ CỐ KHẨN CẤP: Máy [${asset.assetName}] ngừng hoạt động! Checklist #${checklistId}. WO #${newWorkOrderId} đã được tạo.`,
      'SYSTEM_ALERT', 2,
    );
  }

  return { checklistId, overallStatus, newWorkOrderId };
}

export async function getResultById(id) {
  const r = await resultModel.findById(id);
  if (!r) throw createError('Không tìm thấy kết quả checklist', 404);
  return r;
}

export async function getResultsByAsset(assetId, limit = 20) {
  const asset = await assetModel.findById(assetId);
  if (!asset) throw createError('Không tìm thấy tài sản', 404);
  return resultModel.findByAsset(assetId, limit);
}
