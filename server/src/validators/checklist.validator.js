/**
 * checklist.validator.js — Validate Checklist template + submit result.
 * Dùng trong: routes/checklist.routes.js.
 */
const VALID_STATUS = ['OK', 'NG', 'WARNING'];

export function templateSchema(body) {
  if (!body.assetTypeId || isNaN(Number(body.assetTypeId))) return 'AssetTypeID không hợp lệ';
  if (!body.templateName?.trim()) return 'Tên mẫu checklist không được để trống';
  return null;
}

/** POST /templates/:id/items — nội dung câu hỏi bắt buộc */
export function templateItemSchema(body) {
  if (!body.questionText?.trim()) return 'Nội dung câu hỏi không được để trống';
  return null;
}

export function submitChecklistSchema(body) {
  if (!body.assetId || isNaN(Number(body.assetId))) return 'AssetID không hợp lệ';
  if (body.templateId !== undefined && body.templateId !== '' && body.templateId != null) {
    const t = Number(body.templateId);
    if (!Number.isFinite(t) || t <= 0) return 'TemplateID không hợp lệ';
  }
  if (body.woId !== undefined && body.woId !== '' && body.woId != null) {
    const w = Number(body.woId);
    if (!Number.isFinite(w) || w <= 0) return 'WO_ID không hợp lệ';
  }
  if (!body.overallStatus || !VALID_STATUS.includes(body.overallStatus)) {
    return `OverallStatus không hợp lệ. Chấp nhận: ${VALID_STATUS.join(', ')}`;
  }
  if (body.readingValue !== undefined && body.readingValue !== '' && isNaN(Number(body.readingValue))) {
    return 'ReadingValue phải là số';
  }
  return null;
}

const REVIEW_DECISIONS = ['APPROVE', 'REJECT'];

export function reviewChecklistSchema(body) {
  const d = String(body.decision || '').toUpperCase();
  if (!REVIEW_DECISIONS.includes(d)) return `decision phải là ${REVIEW_DECISIONS.join(' hoặc ')}`;
  return null;
}

export function readingSchema(body) {
  if (body.readingValue === undefined || isNaN(Number(body.readingValue))) return 'ReadingValue (giờ đồng hồ) phải là số';
  if (Number(body.readingValue) < 0) return 'ReadingValue không thể âm';
  return null;
}

export function approvalActionSchema(body) {
  if (!body.logId || isNaN(Number(body.logId))) return 'LogID không hợp lệ';
  return null;
}
