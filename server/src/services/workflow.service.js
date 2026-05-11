/**
 * workflow.service.js — Nghiệp vụ quản lý WorkflowTemplates + Steps (admin).
 *
 * An toàn lịch sử: khi mẫu đã có ApprovalLogs tham chiếu (`countUsage > 0`),
 * service KHÓA sửa documentType + thao tác trên bước (thêm/sửa/xoá/đổi vị trí)
 * để không phá vỡ ý nghĩa các đơn duyệt trước đó. Vẫn cho sửa tên + mô tả.
 * Liên quan: models/workflow.model.js, controllers/workflow.controller.js.
 */
import { createError } from '../utils/createError.js';
import * as model from '../models/workflow.model.js';

const ALLOWED_DOC_TYPES = new Set(['DIGITAL_ASSET', 'WORK_ORDER', 'MAINTENANCE_PLAN']);

function assertDocumentType(documentType) {
  if (documentType == null) return;
  if (!ALLOWED_DOC_TYPES.has(String(documentType))) {
    throw createError('Loại tài liệu không hợp lệ', 400);
  }
}

async function assertNotInUseForStructural(workflowId, action = 'thao tác này') {
  const used = await model.countUsage(workflowId);
  if (used > 0) {
    throw createError(
      `Mẫu đã có ${used} đơn duyệt sử dụng — không thể ${action}. Hãy tạo mẫu mới hoặc giữ mẫu hiện tại.`,
      409,
    );
  }
}

export async function getAll(documentType) {
  return model.findAll(documentType || undefined);
}

export async function getById(id) {
  const wf = await model.findById(id);
  if (!wf) throw createError('Không tìm thấy workflow', 404);
  const usageCount = await model.countUsage(id);
  return { ...wf, usageCount, isUsed: usageCount > 0 };
}

export async function create({ workflowName, documentType, totalLevels, description }) {
  const name = String(workflowName || '').trim();
  if (!name) throw createError('Tên workflow không được để trống', 400);
  assertDocumentType(documentType);
  const lv = Number(totalLevels);
  if (!Number.isFinite(lv) || lv < 1) {
    throw createError('Số cấp phải là số nguyên ≥ 1', 400);
  }
  const id = await model.create({
    workflowName: name,
    documentType,
    totalLevels: lv,
    description: description?.trim() || null,
  });
  return getById(id);
}

export async function update(id, data) {
  const existing = await model.findById(id);
  if (!existing) throw createError('Không tìm thấy workflow', 404);
  const payload = {};
  if (data.workflowName !== undefined) {
    const name = String(data.workflowName).trim();
    if (!name) throw createError('Tên workflow không được để trống', 400);
    payload.workflowName = name;
  }
  if (data.description !== undefined) {
    payload.description = String(data.description || '').trim();
  }
  // DocumentType thuộc nhóm "cấu trúc" — khoá khi đã có đơn duyệt sử dụng.
  if (data.documentType !== undefined && data.documentType !== existing.documentType) {
    assertDocumentType(data.documentType);
    await assertNotInUseForStructural(id, 'đổi loại tài liệu của mẫu');
    payload.documentType = data.documentType;
  }
  await model.update(id, payload);
  return getById(id);
}

export async function remove(id) {
  const wf = await model.findById(id);
  if (!wf) throw createError('Không tìm thấy workflow', 404);
  await assertNotInUseForStructural(id, 'xoá mẫu');
  await model.remove(id);
}

export async function addStep(workflowId, { stepLevel, positionId }) {
  const wf = await model.findById(workflowId);
  if (!wf) throw createError('Không tìm thấy workflow', 404);
  await assertNotInUseForStructural(workflowId, 'thêm bước duyệt');
  const lv = Number(stepLevel);
  const pid = Number(positionId);
  if (!Number.isFinite(lv) || lv < 1) {
    throw createError('StepLevel phải là số nguyên ≥ 1', 400);
  }
  if (!Number.isFinite(pid) || pid < 1) {
    throw createError('Position không hợp lệ', 400);
  }
  // Chặn trùng StepLevel (DB cũng có UNIQUE — nhưng trả message Việt hoá rõ hơn).
  const dup = (wf.steps || []).find((s) => Number(s.stepLevel) === lv);
  if (dup) throw createError(`Đã có bước cấp ${lv}. Hãy xoá bước cũ hoặc dùng cấp khác.`, 409);
  await model.addStep({ workflowId: Number(workflowId), stepLevel: lv, positionId: pid });
  await model.syncTotalLevels(workflowId);
  return getById(workflowId);
}

export async function updateStep(stepId, { stepLevel, positionId }) {
  const step = await model.findStepById(stepId);
  if (!step) throw createError('Không tìm thấy bước duyệt', 404);
  await assertNotInUseForStructural(step.workflowId, 'sửa bước duyệt');
  const updates = {};
  if (stepLevel !== undefined) {
    const lv = Number(stepLevel);
    if (!Number.isFinite(lv) || lv < 1) {
      throw createError('StepLevel phải là số nguyên ≥ 1', 400);
    }
    updates.stepLevel = lv;
  }
  if (positionId !== undefined) {
    const pid = Number(positionId);
    if (!Number.isFinite(pid) || pid < 1) {
      throw createError('Position không hợp lệ', 400);
    }
    updates.positionId = pid;
  }
  if (Object.keys(updates).length === 0) return getById(step.workflowId);
  await model.updateStep(stepId, updates);
  await model.syncTotalLevels(step.workflowId);
  return getById(step.workflowId);
}

export async function removeStep(stepId) {
  const step = await model.findStepById(stepId);
  if (!step) throw createError('Không tìm thấy bước duyệt', 404);
  await assertNotInUseForStructural(step.workflowId, 'xoá bước duyệt');
  await model.removeStep(stepId);
  await model.syncTotalLevels(step.workflowId);
  return getById(step.workflowId);
}
