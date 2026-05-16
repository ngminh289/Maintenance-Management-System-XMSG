/**
 * approvalLog.model.js — SQL thuần cho bảng ApprovalLogs.
 * Kèm tên chức vụ bước duyệt (WorkflowSteps + Positions) cho UI TC / Trưởng phòng.
 * Dùng trong: services/approval.service.js.
 */
import { getPool } from "../config/database.js";

const COLS_BASE = `
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

/** Lịch sử / findById: kèm tên chức vụ của đúng bước CurrentLevel */
const COLS = `${COLS_BASE},
  pos_st.PositionName AS stepPositionName`;

const LOG_JOINS = `
     FROM ApprovalLogs al
     LEFT JOIN WorkflowTemplates wt ON wt.WorkflowID = al.WorkflowID
     LEFT JOIN Employees e ON e.EmployeeID = al.ApproverID
     LEFT JOIN WorkflowSteps ws_st ON ws_st.WorkflowID = al.WorkflowID AND ws_st.StepLevel = al.CurrentLevel
     LEFT JOIN Positions pos_st ON pos_st.PositionID = ws_st.PositionID`;

export async function create({
  resourceId,
  resourceType,
  workflowId,
  submittedBy,
  currentLevel,
  approverId = null,
  status = "PENDING",
  comment = null,
}) {
  const [result] = await getPool().query(
    `INSERT INTO ApprovalLogs (ResourceID, ResourceType, WorkflowID, SubmittedBy, CurrentLevel, ApproverID, Status, Comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      resourceId,
      resourceType,
      workflowId || null,
      submittedBy || null,
      currentLevel,
      approverId,
      status,
      comment,
    ],
  );
  return result.insertId;
}

export async function findById(id) {
  const [rows] = await getPool().query(
    `SELECT ${COLS}
     ${LOG_JOINS}
     WHERE al.LogID = ?`,
    [id],
  );
  return rows[0] || null;
}

export async function findByResource(resourceId, resourceType) {
  const [rows] = await getPool().query(
    `SELECT ${COLS}
     ${LOG_JOINS}
     WHERE al.ResourceID = ? AND al.ResourceType = ?
     ORDER BY al.CurrentLevel, al.ActionDate`,
    [resourceId, resourceType],
  );
  return rows;
}

/** Còn bước phê duyệt PENDING — chặn gửi trùng (lịch, tài liệu, WO). */
export async function hasPendingForResource(resourceId, resourceType) {
  const [rows] = await getPool().query(
    `SELECT 1 FROM ApprovalLogs
     WHERE ResourceID = ? AND ResourceType = ? AND Status = 'PENDING' LIMIT 1`,
    [resourceId, resourceType],
  );
  return !!rows[0];
}

/** Lấy tất cả ApprovalLogs đang PENDING mà positionId này cần xử lý, kèm context tài nguyên */
export async function findPendingForPosition(positionId) {
  const [rows] = await getPool().query(
    `SELECT ${COLS_BASE},
            ws.PositionID  AS requiredPositionId,
            pos_ws.PositionName AS stepPositionName,
            CASE al.ResourceType
              WHEN 'WORK_ORDER'       THEN wo.Description
              WHEN 'DIGITAL_ASSET'    THEN da.FileName
              WHEN 'MAINTENANCE_PLAN' THEN ms.ScheduleName
            END AS resourceDescription,
            CASE al.ResourceType
              WHEN 'WORK_ORDER'       THEN wa.AssetName
              WHEN 'DIGITAL_ASSET'    THEN daa.AssetName
              WHEN 'MAINTENANCE_PLAN' THEN msa.AssetName
            END AS resourceAssetName,
            CASE al.ResourceType
              WHEN 'WORK_ORDER'       THEN lwo.LocationName
              WHEN 'DIGITAL_ASSET'    THEN lda.LocationName
              WHEN 'MAINTENANCE_PLAN' THEN lms.LocationName
            END AS resourceAssetLocation,
            CASE al.ResourceType
              WHEN 'WORK_ORDER'       THEN wo.Status
              WHEN 'DIGITAL_ASSET'    THEN da.Status
              WHEN 'MAINTENANCE_PLAN' THEN ms.Status
            END AS resourceStatus,
            sub.FullName AS submitterName,
            wo.PlannedDate    AS woPlannedDate,
            wo.Priority       AS woPriority,
            wo.WO_Source      AS woSource,
            wo.EstimatedHours AS woEstimatedHours,
            wo.Description    AS woFullDescription,
            wo.ScheduleID     AS woScheduleId,
            ms.Description       AS scheduleDescription,
            ms.MaintenanceType   AS scheduleMaintenanceType,
            ms.FrequencyValue    AS scheduleFrequencyValue,
            ms.FrequencyUnit     AS scheduleFrequencyUnit,
            ms.StartDate         AS scheduleStartDate,
            ms.NextDueDate       AS scheduleNextDueDate,
            ms.Priority          AS schedulePriority,
            ms.EstimatedTime     AS scheduleEstimatedTime,
            da.FileType       AS digitalFileType,
            da.Description    AS digitalDescription,
            da.CurrentVersion AS digitalCurrentVersion,
            da.UploadDate     AS digitalUploadDate,
            da.FileSizeKB     AS digitalFileSizeKb
     FROM ApprovalLogs al
     JOIN WorkflowTemplates wt  ON wt.WorkflowID  = al.WorkflowID
     JOIN WorkflowSteps     ws  ON ws.WorkflowID  = al.WorkflowID AND ws.StepLevel = al.CurrentLevel
     LEFT JOIN Positions    pos_ws ON pos_ws.PositionID = ws.PositionID
     LEFT JOIN Employees    e   ON e.EmployeeID   = al.ApproverID
     LEFT JOIN Employees    sub ON sub.EmployeeID = al.SubmittedBy
     LEFT JOIN WorkOrders   wo  ON wo.WO_ID        = al.ResourceID AND al.ResourceType = 'WORK_ORDER'
     LEFT JOIN Assets       wa  ON wa.AssetID       = wo.AssetID
     LEFT JOIN Locations    lwo ON lwo.LocationID   = wa.LocationID
     LEFT JOIN DigitalAssets da  ON da.DigitalAssetID = al.ResourceID AND al.ResourceType = 'DIGITAL_ASSET'
     LEFT JOIN Assets        daa ON daa.AssetID        = da.AssetID
     LEFT JOIN Locations    lda ON lda.LocationID   = daa.LocationID
     LEFT JOIN MaintenanceSchedules ms  ON ms.ScheduleID = al.ResourceID AND al.ResourceType = 'MAINTENANCE_PLAN'
     LEFT JOIN Assets               msa ON msa.AssetID    = ms.AssetID
     LEFT JOIN Locations    lms ON lms.LocationID   = msa.LocationID
     WHERE al.Status = 'PENDING' AND ws.PositionID = ?
       AND (al.ResourceType <> 'WORK_ORDER' OR wo.IsDeleted = 0)
     ORDER BY al.ActionDate`,
    [positionId],
  );
  return rows;
}

/** Tất cả đơn PENDING — Admin (L4+) xem toàn bộ hàng đợi phê duyệt. */
export async function findAllPending() {
  const [rows] = await getPool().query(
    `SELECT ${COLS_BASE},
            ws.PositionID  AS requiredPositionId,
            pos_ws.PositionName AS stepPositionName,
            CASE al.ResourceType
              WHEN 'WORK_ORDER'       THEN wo.Description
              WHEN 'DIGITAL_ASSET'    THEN da.FileName
              WHEN 'MAINTENANCE_PLAN' THEN ms.ScheduleName
            END AS resourceDescription,
            CASE al.ResourceType
              WHEN 'WORK_ORDER'       THEN wa.AssetName
              WHEN 'DIGITAL_ASSET'    THEN daa.AssetName
              WHEN 'MAINTENANCE_PLAN' THEN msa.AssetName
            END AS resourceAssetName,
            CASE al.ResourceType
              WHEN 'WORK_ORDER'       THEN lwo.LocationName
              WHEN 'DIGITAL_ASSET'    THEN lda.LocationName
              WHEN 'MAINTENANCE_PLAN' THEN lms.LocationName
            END AS resourceAssetLocation,
            CASE al.ResourceType
              WHEN 'WORK_ORDER'       THEN wo.Status
              WHEN 'DIGITAL_ASSET'    THEN da.Status
              WHEN 'MAINTENANCE_PLAN' THEN ms.Status
            END AS resourceStatus,
            sub.FullName AS submitterName,
            wo.PlannedDate    AS woPlannedDate,
            wo.Priority       AS woPriority,
            wo.WO_Source      AS woSource,
            wo.EstimatedHours AS woEstimatedHours,
            wo.Description    AS woFullDescription,
            wo.ScheduleID     AS woScheduleId,
            ms.Description       AS scheduleDescription,
            ms.MaintenanceType   AS scheduleMaintenanceType,
            ms.FrequencyValue    AS scheduleFrequencyValue,
            ms.FrequencyUnit     AS scheduleFrequencyUnit,
            ms.StartDate         AS scheduleStartDate,
            ms.NextDueDate       AS scheduleNextDueDate,
            ms.Priority          AS schedulePriority,
            ms.EstimatedTime     AS scheduleEstimatedTime,
            da.FileType       AS digitalFileType,
            da.Description    AS digitalDescription,
            da.CurrentVersion AS digitalCurrentVersion,
            da.UploadDate     AS digitalUploadDate,
            da.FileSizeKB     AS digitalFileSizeKb
     FROM ApprovalLogs al
     JOIN WorkflowTemplates wt  ON wt.WorkflowID  = al.WorkflowID
     JOIN WorkflowSteps     ws  ON ws.WorkflowID  = al.WorkflowID AND ws.StepLevel = al.CurrentLevel
     LEFT JOIN Positions    pos_ws ON pos_ws.PositionID = ws.PositionID
     LEFT JOIN Employees    e   ON e.EmployeeID   = al.ApproverID
     LEFT JOIN Employees    sub ON sub.EmployeeID = al.SubmittedBy
     LEFT JOIN WorkOrders   wo  ON wo.WO_ID        = al.ResourceID AND al.ResourceType = 'WORK_ORDER'
     LEFT JOIN Assets       wa  ON wa.AssetID       = wo.AssetID
     LEFT JOIN Locations    lwo ON lwo.LocationID   = wa.LocationID
     LEFT JOIN DigitalAssets da  ON da.DigitalAssetID = al.ResourceID AND al.ResourceType = 'DIGITAL_ASSET'
     LEFT JOIN Assets        daa ON daa.AssetID        = da.AssetID
     LEFT JOIN Locations    lda ON lda.LocationID   = daa.LocationID
     LEFT JOIN MaintenanceSchedules ms  ON ms.ScheduleID = al.ResourceID AND al.ResourceType = 'MAINTENANCE_PLAN'
     LEFT JOIN Assets               msa ON msa.AssetID    = ms.AssetID
     LEFT JOIN Locations    lms ON lms.LocationID   = msa.LocationID
     WHERE al.Status = 'PENDING'
       AND (al.ResourceType <> 'WORK_ORDER' OR wo.IsDeleted = 0)
     ORDER BY al.ActionDate`,
  );
  return rows;
}

/** Cùng logic findPendingForPosition, nhưng bước yêu cầu nằm trong danh sách (phó = trưởng tương ứng). */
export async function findPendingForAnyPosition(positionIds) {
  const pids = (positionIds || []).map(Number).filter((n) => n > 0);
  if (pids.length === 0) return [];
  const ph = pids.map(() => "?").join(", ");
  const [rows] = await getPool().query(
    `SELECT ${COLS_BASE},
            ws.PositionID  AS requiredPositionId,
            pos_ws.PositionName AS stepPositionName,
            CASE al.ResourceType
              WHEN 'WORK_ORDER'       THEN wo.Description
              WHEN 'DIGITAL_ASSET'    THEN da.FileName
              WHEN 'MAINTENANCE_PLAN' THEN ms.ScheduleName
            END AS resourceDescription,
            CASE al.ResourceType
              WHEN 'WORK_ORDER'       THEN wa.AssetName
              WHEN 'DIGITAL_ASSET'    THEN daa.AssetName
              WHEN 'MAINTENANCE_PLAN' THEN msa.AssetName
            END AS resourceAssetName,
            CASE al.ResourceType
              WHEN 'WORK_ORDER'       THEN lwo.LocationName
              WHEN 'DIGITAL_ASSET'    THEN lda.LocationName
              WHEN 'MAINTENANCE_PLAN' THEN lms.LocationName
            END AS resourceAssetLocation,
            CASE al.ResourceType
              WHEN 'WORK_ORDER'       THEN wo.Status
              WHEN 'DIGITAL_ASSET'    THEN da.Status
              WHEN 'MAINTENANCE_PLAN' THEN ms.Status
            END AS resourceStatus,
            sub.FullName AS submitterName,
            wo.PlannedDate    AS woPlannedDate,
            wo.Priority       AS woPriority,
            wo.WO_Source      AS woSource,
            wo.EstimatedHours AS woEstimatedHours,
            wo.Description    AS woFullDescription,
            wo.ScheduleID     AS woScheduleId,
            ms.Description       AS scheduleDescription,
            ms.MaintenanceType   AS scheduleMaintenanceType,
            ms.FrequencyValue    AS scheduleFrequencyValue,
            ms.FrequencyUnit     AS scheduleFrequencyUnit,
            ms.StartDate         AS scheduleStartDate,
            ms.NextDueDate       AS scheduleNextDueDate,
            ms.Priority          AS schedulePriority,
            ms.EstimatedTime     AS scheduleEstimatedTime,
            da.FileType       AS digitalFileType,
            da.Description    AS digitalDescription,
            da.CurrentVersion AS digitalCurrentVersion,
            da.UploadDate     AS digitalUploadDate,
            da.FileSizeKB     AS digitalFileSizeKb
     FROM ApprovalLogs al
     JOIN WorkflowTemplates wt  ON wt.WorkflowID  = al.WorkflowID
     JOIN WorkflowSteps     ws  ON ws.WorkflowID  = al.WorkflowID AND ws.StepLevel = al.CurrentLevel
     LEFT JOIN Positions    pos_ws ON pos_ws.PositionID = ws.PositionID
     LEFT JOIN Employees    e   ON e.EmployeeID   = al.ApproverID
     LEFT JOIN Employees    sub ON sub.EmployeeID = al.SubmittedBy
     LEFT JOIN WorkOrders   wo  ON wo.WO_ID        = al.ResourceID AND al.ResourceType = 'WORK_ORDER'
     LEFT JOIN Assets       wa  ON wa.AssetID       = wo.AssetID
     LEFT JOIN Locations    lwo ON lwo.LocationID   = wa.LocationID
     LEFT JOIN DigitalAssets da  ON da.DigitalAssetID = al.ResourceID AND al.ResourceType = 'DIGITAL_ASSET'
     LEFT JOIN Assets        daa ON daa.AssetID        = da.AssetID
     LEFT JOIN Locations    lda ON lda.LocationID   = daa.LocationID
     LEFT JOIN MaintenanceSchedules ms  ON ms.ScheduleID = al.ResourceID AND al.ResourceType = 'MAINTENANCE_PLAN'
     LEFT JOIN Assets               msa ON msa.AssetID    = ms.AssetID
     LEFT JOIN Locations    lms ON lms.LocationID   = msa.LocationID
     WHERE al.Status = 'PENDING' AND ws.PositionID IN (${ph})
       AND (al.ResourceType <> 'WORK_ORDER' OR wo.IsDeleted = 0)
     ORDER BY al.ActionDate`,
    pids,
  );
  return rows;
}

export async function getWorkflowStep(workflowId, level) {
  const [rows] = await getPool().query(
    "SELECT PositionID AS positionId FROM WorkflowSteps WHERE WorkflowID = ? AND StepLevel = ?",
    [workflowId, level],
  );
  return rows[0] || null;
}

/** Các bước trong mẫu luồng (để UI vẽ TC → Trưởng phòng) */
export async function listWorkflowStepRoles(workflowId) {
  const [rows] = await getPool().query(
    `SELECT ws.StepLevel AS stepLevel, ws.PositionID AS positionId, p.PositionName AS positionName
     FROM WorkflowSteps ws
     INNER JOIN Positions p ON p.PositionID = ws.PositionID
     WHERE ws.WorkflowID = ?
     ORDER BY ws.StepLevel ASC`,
    [workflowId],
  );
  return rows;
}

export async function getDefaultWorkflow(resourceType) {
  const [rows] = await getPool().query(
    "SELECT WorkflowID AS workflowId, TotalLevels AS totalLevels FROM WorkflowTemplates WHERE DocumentType = ? ORDER BY WorkflowID LIMIT 1",
    [resourceType],
  );
  return rows[0] || null;
}

export async function update(id, { approverId, status, comment }) {
  const [result] = await getPool().query(
    "UPDATE ApprovalLogs SET ApproverID = ?, Status = ?, Comment = ?, ActionDate = NOW() WHERE LogID = ?",
    [approverId, status, comment || null, id],
  );
  return result.affectedRows;
}
