/**
 * workflow.model.js — SQL thuần cho WorkflowTemplates + WorkflowSteps.
 * `countUsage` đếm ApprovalLogs đang tham chiếu workflow → service dùng để
 * khoá sửa bước / loại tài liệu khi mẫu đã được dùng (an toàn dữ liệu).
 * Dùng trong: services/workflow.service.js.
 */
import { getPool } from '../config/database.js';

export async function findAll(documentType) {
  const params = [];
  let where = '';
  if (documentType) { where = 'WHERE DocumentType = ?'; params.push(documentType); }
  const [rows] = await getPool().query(
    `SELECT WorkflowID AS workflowId, WorkflowName AS workflowName,
            DocumentType AS documentType, TotalLevels AS totalLevels, Description AS description
     FROM WorkflowTemplates ${where} ORDER BY DocumentType, WorkflowID`,
    params,
  );
  return rows;
}

export async function findById(id) {
  const [[template], steps] = await Promise.all([
    getPool().query(
      'SELECT WorkflowID AS workflowId, WorkflowName AS workflowName, DocumentType AS documentType, TotalLevels AS totalLevels, Description AS description FROM WorkflowTemplates WHERE WorkflowID = ?',
      [id],
    ).then(([r]) => r),
    getPool().query(
      `SELECT ws.StepID AS stepId, ws.StepLevel AS stepLevel,
              ws.PositionID AS positionId, p.PositionName AS positionName, p.Level AS positionLevel
       FROM WorkflowSteps ws
       JOIN Positions p ON p.PositionID = ws.PositionID
       WHERE ws.WorkflowID = ? ORDER BY ws.StepLevel`,
      [id],
    ).then(([r]) => r),
  ]);
  if (!template) return null;
  return { ...template, steps };
}

export async function create({ workflowName, documentType, totalLevels, description }) {
  const [result] = await getPool().query(
    'INSERT INTO WorkflowTemplates (WorkflowName, DocumentType, TotalLevels, Description) VALUES (?, ?, ?, ?)',
    [workflowName, documentType, totalLevels, description || null],
  );
  return result.insertId;
}

export async function update(id, { workflowName, description, documentType, totalLevels }) {
  const sets = [];
  const params = [];
  if (workflowName !== undefined) {
    sets.push('WorkflowName = ?');
    params.push(workflowName);
  }
  if (description !== undefined) {
    sets.push('Description = ?');
    params.push(description || null);
  }
  if (documentType !== undefined) {
    sets.push('DocumentType = ?');
    params.push(documentType);
  }
  if (totalLevels !== undefined) {
    sets.push('TotalLevels = ?');
    params.push(Number(totalLevels));
  }
  if (!sets.length) return 0;
  params.push(id);
  const [result] = await getPool().query(
    `UPDATE WorkflowTemplates SET ${sets.join(', ')} WHERE WorkflowID = ?`,
    params,
  );
  return result.affectedRows;
}

/**
 * Đếm số ApprovalLogs đang dùng workflow này.
 * Dùng để khoá sửa bước / loại tài liệu nếu đã có đơn duyệt áp dụng (an toàn lịch sử).
 */
export async function countUsage(workflowId) {
  const [[{ cnt }]] = await getPool().query(
    'SELECT COUNT(*) AS cnt FROM ApprovalLogs WHERE WorkflowID = ?',
    [workflowId],
  );
  return Number(cnt);
}

/** Lấy step theo StepID — để service xác thực step thuộc đúng workflow. */
export async function findStepById(stepId) {
  const [rows] = await getPool().query(
    'SELECT StepID AS stepId, WorkflowID AS workflowId, StepLevel AS stepLevel, PositionID AS positionId FROM WorkflowSteps WHERE StepID = ?',
    [stepId],
  );
  return rows[0] || null;
}

/** Đồng bộ TotalLevels = max(StepLevel) sau khi xoá / sửa bước. */
export async function syncTotalLevels(workflowId) {
  await getPool().query(
    `UPDATE WorkflowTemplates wt
       SET TotalLevels = COALESCE((SELECT MAX(StepLevel) FROM WorkflowSteps WHERE WorkflowID = wt.WorkflowID), 0)
     WHERE wt.WorkflowID = ?`,
    [workflowId],
  );
}

export async function remove(id) {
  const [result] = await getPool().query('DELETE FROM WorkflowTemplates WHERE WorkflowID = ?', [id]);
  return result.affectedRows;
}

export async function addStep({ workflowId, stepLevel, positionId }) {
  const [result] = await getPool().query(
    'INSERT INTO WorkflowSteps (WorkflowID, StepLevel, PositionID) VALUES (?, ?, ?)',
    [workflowId, stepLevel, positionId],
  );
  // Cập nhật TotalLevels nếu cần
  await getPool().query(
    'UPDATE WorkflowTemplates SET TotalLevels = GREATEST(TotalLevels, ?) WHERE WorkflowID = ?',
    [stepLevel, workflowId],
  );
  return result.insertId;
}

export async function updateStep(stepId, { positionId, stepLevel }) {
  const sets = [];
  const params = [];
  if (positionId !== undefined) {
    sets.push('PositionID = ?');
    params.push(positionId);
  }
  if (stepLevel !== undefined) {
    sets.push('StepLevel = ?');
    params.push(stepLevel);
  }
  if (!sets.length) return 0;
  params.push(stepId);
  const [result] = await getPool().query(
    `UPDATE WorkflowSteps SET ${sets.join(', ')} WHERE StepID = ?`,
    params,
  );
  return result.affectedRows;
}

export async function removeStep(stepId) {
  await getPool().query('DELETE FROM WorkflowSteps WHERE StepID = ?', [stepId]);
}
