/**
 * checklist.service.js — Luồng kiểm tra hiện trường: submit + auto-logic (NG/WARNING/OK).
 * Workflow sheet bước 3 (Quy trình kiểm tra Checklist):
 *   OK      → Asset AVAILABLE,  WO COMPLETED (nếu có)
 *   WARNING → Asset MONITORING, tạo WO PREDICTIVE HIGH (theo dõi thêm, sắp xếp bảo trì)
 *   NG      → Asset BROKEN,     tạo WO CORRECTIVE EMERGENCY (sửa chữa khẩn cấp)
 *             → sau khi WO được duyệt: Asset MAINTENANCE
 *             → sau khi WO COMPLETED: Asset AVAILABLE
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

  // Tab 1: Checklist template cho loại tài sản này
  const template = await templateModel.findByAssetTypeId(asset.assetTypeId);
  const checklistTemplate = template ? await templateModel.findById(template.templateId) : null;

  // Tab 2: Tài liệu SOP/hướng dẫn APPROVED gắn với tài sản, kèm tags để lọc đúng tài liệu.
  // BFD 1.3/3.3: "bộ lọc logic hiển thị đúng tài liệu khi quét QR theo tags"
  const { getPool } = await import('../config/database.js');
  const [documents] = await getPool().query(
    `SELECT da.DigitalAssetID AS digitalAssetId,
            da.FileName       AS fileName,
            da.FileType       AS fileType,
            da.Description    AS description,
            da.CurrentVersion AS currentVersion,
            da.FilePath       AS filePath,
            GROUP_CONCAT(t.TagName ORDER BY t.TagName SEPARATOR '||') AS tagNames,
            GROUP_CONCAT(t.TagID   ORDER BY t.TagName SEPARATOR '||') AS tagIds
     FROM DigitalAssets da
     LEFT JOIN AssetTags at2 ON at2.DigitalAssetID = da.DigitalAssetID
     LEFT JOIN Tags t        ON t.TagID = at2.TagID
     WHERE da.AssetID = ? AND da.Status = 'APPROVED'
     GROUP BY da.DigitalAssetID
     ORDER BY da.UploadDate DESC`,
    [assetId],
  );
  // Parse tags: "An toàn||Kỹ thuật" → [{tagId, tagName}, ...]
  const documentsWithTags = documents.map(doc => ({
    ...doc,
    tags: doc.tagNames
      ? doc.tagNames.split('||').map((name, i) => ({
          tagId:   Number(doc.tagIds.split('||')[i]),
          tagName: name,
        }))
      : [],
    tagNames: undefined,
    tagIds:   undefined,
  }));

  // Lịch sử checklist gần nhất
  const recentResults = await resultModel.findByAsset(assetId, 5);

  return {
    asset,
    checklistTemplate,        // Tab Checklist
    documents: documentsWithTags, // Tab Tài liệu — mỗi doc kèm tags[]
    recentResults,
  };
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
    // Workflow sheet 3 bước 2.2: CẢNH BÁO — máy vẫn chạy nhưng bất thường → MONITORING
    await assetModel.updateStatus(assetId, 'MONITORING');
    newWorkOrderId = await workOrderSvc.createAutomatic({
      assetId, woSource: 'PREDICTIVE', priority: 'HIGH',
      description: `[CẢNH BÁO] Checklist #${checklistId}: ${asset.assetName} có dấu hiệu bất thường`,
      createdBy: checkerId,
    });
    await notifService.notifyManagers(
      `CẢNH BÁO: Máy [${asset.assetName}] có dấu hiệu bất thường. Checklist #${checklistId}. Đã tạo WO #${newWorkOrderId} chờ phê duyệt.`,
      'SYSTEM_ALERT', 2,
    );

  } else if (overallStatus === 'NG') {
    // luongxulykiemtra.rule: Máy hỏng, không chạy được → BROKEN, WO_Source = CORRECTIVE
    await assetModel.updateStatus(assetId, 'BROKEN');
    newWorkOrderId = await workOrderSvc.createAutomatic({
      assetId, woSource: 'CORRECTIVE', priority: 'EMERGENCY',
      description: `[SỰ CỐ] Checklist #${checklistId}: ${asset.assetName} NGỪNG HOẠT ĐỘNG`,
      createdBy: checkerId,
    });
    await notifService.notifyManagers(
      `SỰ CỐ KHẨN CẤP: Máy [${asset.assetName}] ngừng hoạt động! Checklist #${checklistId}. WO #${newWorkOrderId} đã được tạo.`,
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

export async function getResults({ page = 1, limit = 20, checkerId, assetId } = {}) {
  const offset = (page - 1) * limit;
  const { getPool } = await import('../config/database.js');
  const conditions = [];
  const params = [];
  if (checkerId) { conditions.push('cr.CheckerID = ?'); params.push(checkerId); }
  if (assetId)   { conditions.push('cr.AssetID = ?');   params.push(assetId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [[{ total }]] = await getPool().query(
    `SELECT COUNT(*) AS total FROM ChecklistResults cr ${where}`, params
  );
  const [rows] = await getPool().query(
    `SELECT cr.ChecklistID AS checklistId, cr.AssetID AS assetId,
            a.AssetName AS assetName, cr.OverallStatus AS overallStatus,
            cr.CheckTime AS checkTime, cr.Notes AS notes,
            e.FullName AS checkerName
     FROM ChecklistResults cr
     LEFT JOIN Assets a    ON a.AssetID   = cr.AssetID
     LEFT JOIN Employees e ON e.EmployeeID = cr.CheckerID
     ${where}
     ORDER BY cr.CheckTime DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );
  return { items: rows, total, page: Number(page), limit: Number(limit) };
}

export async function getResultsByAsset(assetId, limit = 20) {
  const asset = await assetModel.findById(assetId);
  if (!asset) throw createError('Không tìm thấy tài sản', 404);
  return resultModel.findByAsset(assetId, limit);
}
