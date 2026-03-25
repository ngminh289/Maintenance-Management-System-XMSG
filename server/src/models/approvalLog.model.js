/**
 * approvalLog.model.js — SQL thuần cho bảng ApprovalLogs.
 * Dùng trong: services/approval.service.js.
 */
import { getPool } from '../config/database.js';

const COLS = `
  al.LogID        AS logId,
  al.ResourceID   AS resourceId,
  al.ResourceType AS resourceType,
  al.WorkflowID   AS workflowId,
  al.SubmittedBy  AS submittedBy,
  al.CurrentLevel AS currentLevel,
  al.ApproverID   AS approverId,
  al.Status       AS status,
  al.Comment      AS comment,
  al.ActionDate   AS actionDate,
  wt.WorkflowName AS workflowName,
  wt.TotalLevels  AS totalLevels,
  e.FullName      AS approverName`;

export async function create({ resourceId, resourceType, workflowId, submittedBy, currentLevel, approverId = null, status = 'PENDING', comment = null }) {
  const [result] = await getPool().query(
    `INSERT INTO ApprovalLogs (ResourceID, ResourceType, WorkflowID, SubmittedBy, CurrentLevel, ApproverID, Status, Comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [resourceId, resourceType, workflowId || null, submittedBy || null, currentLevel, approverId, status, comment],
  );
  return result.insertId;
}

export async function findById(id) {
  const [rows] = await getPool().query(
    `SELECT ${COLS}
     FROM ApprovalLogs al
     LEFT JOIN WorkflowTemplates wt ON wt.WorkflowID = al.WorkflowID
     LEFT JOIN Employees e ON e.EmployeeID = al.ApproverID
     WHERE al.LogID = ?`,
    [id],
  );
  return rows[0] || null;
}

export async function findByResource(resourceId, resourceType) {
  const [rows] = await getPool().query(
    `SELECT ${COLS}
     FROM ApprovalLogs al
     LEFT JOIN WorkflowTemplates wt ON wt.WorkflowID = al.WorkflowID
     LEFT JOIN Employees e ON e.EmployeeID = al.ApproverID
     WHERE al.ResourceID = ? AND al.ResourceType = ?
     ORDER BY al.CurrentLevel, al.ActionDate`,
    [resourceId, resourceType],
  );
  return rows;
}

/** Lấy tất cả ApprovalLogs đang PENDING mà positionId này cần xử lý */
export async function findPendingForPosition(positionId) {
  const [rows] = await getPool().query(
    `SELECT ${COLS},
            ws.PositionID AS requiredPositionId
     FROM ApprovalLogs al
     JOIN WorkflowTemplates wt ON wt.WorkflowID = al.WorkflowID
     JOIN WorkflowSteps ws ON ws.WorkflowID = al.WorkflowID AND ws.StepLevel = al.CurrentLevel
     LEFT JOIN Employees e ON e.EmployeeID = al.ApproverID
     WHERE al.Status = 'PENDING' AND ws.PositionID = ?
     ORDER BY al.ActionDate`,
    [positionId],
  );
  return rows;
}

export async function getWorkflowStep(workflowId, level) {
  const [rows] = await getPool().query(
    'SELECT PositionID AS positionId FROM WorkflowSteps WHERE WorkflowID = ? AND StepLevel = ?',
    [workflowId, level],
  );
  return rows[0] || null;
}

export async function getDefaultWorkflow(resourceType) {
  const [rows] = await getPool().query(
    'SELECT WorkflowID AS workflowId, TotalLevels AS totalLevels FROM WorkflowTemplates WHERE DocumentType = ? ORDER BY WorkflowID LIMIT 1',
    [resourceType],
  );
  return rows[0] || null;
}

export async function update(id, { approverId, status, comment }) {
  const [result] = await getPool().query(
    'UPDATE ApprovalLogs SET ApproverID = ?, Status = ?, Comment = ?, ActionDate = NOW() WHERE LogID = ?',
    [approverId, status, comment || null, id],
  );
  return result.affectedRows;
}
