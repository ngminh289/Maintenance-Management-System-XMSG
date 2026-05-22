/**
 * documentFeedback.service.js — Nghiệp vụ phản hồi tài liệu: tạo, danh sách, Chuyên viên KTS cập nhật trạng thái.
 * Thông báo: DOCUMENT_FEEDBACK_NEW → mọi Chuyên viên KTS; DOCUMENT_FEEDBACK_STATUS → người góp ý (migration 039).
 * Gắn tài liệu: assertCanReadDigitalAsset — không xem phản hồi / gửi góp ý trên DRAFT/REJECTED của người khác.
 * Liên quan: models/documentFeedback.model.js, digitalAsset.model.js, digitalAsset.service.js, notification.service.js.
 */
import * as model from '../models/documentFeedback.model.js';
import * as digitalAssetModel from '../models/digitalAsset.model.js';
import { assertCanReadDigitalAsset } from './digitalAsset.service.js';
import * as employeeModel from '../models/employee.model.js';
import * as notifService from './notification.service.js';
import { createError } from '../utils/createError.js';
import { hasPermission } from '../middleware/requirePermission.js';

/** PositionID Chuyên viên kỹ thuật số (2) — seed / migration 012+040. */
const POSITION_NV_KY_THUAT = 2;

const STATUSES = new Set(['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED']);
const MAX_BODY = 4000;
const MAX_NOTE = 1000;

const STATUS_LABEL_VI = {
  OPEN: 'Chờ xử lý',
  IN_REVIEW: 'Đang xem xét',
  RESOLVED: 'Đã xử lý',
  DISMISSED: 'Không xử lý',
};

function assertStatus(s) {
  if (!STATUSES.has(s)) {
    throw createError(`Trạng thái không hợp lệ: ${s}`, 400);
  }
}

export async function createForAsset(digitalAssetId, { employeeId, positionId, positionLevel, body }) {
  const okCreate = await hasPermission(positionId, 'DOCUMENT_FEEDBACK', 'CREATE');
  if (!okCreate) {
    throw createError('Chức vụ của bạn không được gửi phản hồi tài liệu (Chuyên viên KTS xử lý hàng đợi).', 403);
  }
  const text = String(body ?? '').trim();
  if (!text) throw createError('Nội dung phản hồi không được để trống', 400);
  if (text.length > MAX_BODY) throw createError(`Nội dung tối đa ${MAX_BODY} ký tự`, 400);

  const da = await digitalAssetModel.findById(digitalAssetId);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  await assertCanReadDigitalAsset(da, {
    sub: employeeId,
    positionLevel: positionLevel ?? 0,
    positionId: positionId ?? 0,
  });

  const id = await model.insert({
    digitalAssetId: Number(digitalAssetId),
    createdBy: Number(employeeId),
    body: text,
  });
  const row = await model.findById(id);
  const ktIds = await employeeModel.findActiveEmployeeIdsByPositionId(POSITION_NV_KY_THUAT);
  const recipients = ktIds.filter((eid) => eid !== Number(employeeId));
  if (recipients.length > 0) {
    const msg =
      `[Phản hồi tài liệu — mới] ${row.authorName} góp ý về «${da.fileName}» (#${row.feedbackId}). ` +
      'Vào menu Phản hồi tài liệu (KT) hoặc kho tài liệu để xem xét.';
    await notifService.sendBulk(recipients, msg, 'DOCUMENT_FEEDBACK_NEW', { resourceType: "DIGITAL_ASSET", resourceId: da.digitalAssetId });
  }
  return row;
}

export async function listForAsset(
  digitalAssetId,
  { employeeId, positionId, positionLevel },
) {
  const canRead = await hasPermission(positionId, 'DOCUMENT_FEEDBACK', 'READ');
  if (!canRead) throw createError('Không có quyền xem phản hồi', 403);

  const da = await digitalAssetModel.findById(digitalAssetId);
  if (!da) throw createError('Không tìm thấy tài liệu', 404);
  await assertCanReadDigitalAsset(da, {
    sub: employeeId,
    positionLevel: positionLevel ?? 0,
    positionId: positionId ?? 0,
  });

  const reviewerViewAll = await hasPermission(positionId, 'DOCUMENT_FEEDBACK', 'UPDATE');
  return model.listByAsset(Number(digitalAssetId), {
    viewerEmployeeId: Number(employeeId),
    reviewerViewAll,
  });
}

export async function listInbox({ positionId, status, page = 1, limit = 20 }) {
  const canRead = await hasPermission(positionId, 'DOCUMENT_FEEDBACK', 'READ');
  const canUpdate = await hasPermission(positionId, 'DOCUMENT_FEEDBACK', 'UPDATE');
  if (!canRead && !canUpdate) {
    throw createError('Không có quyền xem hàng đợi phản hồi tài liệu', 403);
  }
  if (status) assertStatus(status);
  const lim = Math.min(100, Math.max(1, Number(limit) || 20));
  const p = Math.max(1, Number(page) || 1);
  const offset = (p - 1) * lim;
  const [items, total] = await Promise.all([
    model.listInbox({ status: status || null, limit: lim, offset }),
    model.countInbox({ status: status || null }),
  ]);
  return { items, total, page: p, limit: lim };
}

export async function reviewUpdate(feedbackId, { employeeId, positionId, status, reviewNote }) {
  const can = await hasPermission(positionId, 'DOCUMENT_FEEDBACK', 'UPDATE');
  if (!can) throw createError('Chỉ Chuyên viên kỹ thuật số được cập nhật phản hồi', 403);
  assertStatus(status);
  const note = reviewNote != null ? String(reviewNote).trim() : '';
  if (note.length > MAX_NOTE) throw createError(`Ghi chú xử lý tối đa ${MAX_NOTE} ký tự`, 400);

  const row = await model.findById(Number(feedbackId));
  if (!row) throw createError('Không tìm thấy phản hồi', 404);

  await model.updateReview(Number(feedbackId), {
    status,
    reviewNote: note || null,
    reviewedBy: Number(employeeId),
  });
  const updated = await model.findById(Number(feedbackId));

  const authorId = Number(row.createdBy);
  if (authorId > 0 && authorId !== Number(employeeId)) {
    const da = await digitalAssetModel.findById(row.digitalAssetId);
    const fileName = da?.fileName ?? `Tài liệu #${row.digitalAssetId}`;
    const reviewer = await employeeModel.findById(Number(employeeId));
    const reviewerName = reviewer?.fullName ?? 'Chuyên viên KTS';
    const stLabel = STATUS_LABEL_VI[status] ?? status;
    let msg =
      `[Phản hồi tài liệu — đã xử lý] ${reviewerName} cập nhật trạng thái «${stLabel}» cho góp ý của bạn về «${fileName}» (#${row.feedbackId}).`;
    if (note) {
      msg += ` Ghi chú: ${note.length > 200 ? `${note.slice(0, 200)}…` : note}`;
    }
    await notifService.send(authorId, msg, 'DOCUMENT_FEEDBACK_STATUS', { resourceType: "DIGITAL_ASSET", resourceId: row.digitalAssetId });
  }

  return updated;
}
