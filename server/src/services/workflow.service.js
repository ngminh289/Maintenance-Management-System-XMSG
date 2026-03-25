/**
 * workflow.service.js — Nghiệp vụ quản lý WorkflowTemplates + Steps (admin).
 * Liên quan: models/workflow.model.js.
 */
import { createError } from '../utils/createError.js';
import * as model from '../models/workflow.model.js';

export async function getAll(documentType) {
  return model.findAll(documentType || undefined);
}

export async function getById(id) {
  const wf = await model.findById(id);
  if (!wf) throw createError('Không tìm thấy workflow', 404);
  return wf;
}

export async function create({ workflowName, documentType, totalLevels, description }) {
  const id = await model.create({ workflowName, documentType, totalLevels: Number(totalLevels), description });
  return model.findById(id);
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

export async function addStep(workflowId, { stepLevel, positionId }) {
  await getById(workflowId);
  const stepId = await model.addStep({ workflowId: Number(workflowId), stepLevel: Number(stepLevel), positionId: Number(positionId) });
  return model.findById(workflowId);
}

export async function updateStep(stepId, { positionId }) {
  await model.updateStep(stepId, { positionId: Number(positionId) });
}

export async function removeStep(stepId) {
  await model.removeStep(stepId);
}
