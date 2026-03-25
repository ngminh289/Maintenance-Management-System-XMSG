/**
 * workflow.model.js — SQL thuần cho WorkflowTemplates + WorkflowSteps.
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

export async function update(id, { workflowName, description }) {
  const [result] = await getPool().query(
    'UPDATE WorkflowTemplates SET WorkflowName = ?, Description = ? WHERE WorkflowID = ?',
    [workflowName, description || null, id],
  );
  return result.affectedRows;
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

export async function updateStep(stepId, { positionId }) {
  const [result] = await getPool().query(
    'UPDATE WorkflowSteps SET PositionID = ? WHERE StepID = ?',
    [positionId, stepId],
  );
  return result.affectedRows;
}

export async function removeStep(stepId) {
  await getPool().query('DELETE FROM WorkflowSteps WHERE StepID = ?', [stepId]);
}
