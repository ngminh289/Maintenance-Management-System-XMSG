/**
 * workOrder.model.js — SQL thuần cho bảng WorkOrders + WO_Assignments.
 * Đo thời gian làm: WorkStartedAt + PausedAccumulatedSec + PauseStartedAt → tính ActualHours khi COMPLETED (migration 021).
 * CounterBaselineResetAt/By: reset mốc giờ PM từ phiếu CORRECTIVE (migration 032).
 * Soft-delete (mig 070): IsDeleted=0 mặc định ẩn ở mọi query; archived=true để liệt kê tab "Đã lưu trữ".
 * Dùng trong: services/workOrder.service.js, checklist.service.js.
 * findAll: thêm approvalHasPending, needsApprovalResubmit (JOIN logic ApprovalLogs).
 * countAssetMaintenanceHoldOrders: IN_PROGRESS hoặc AWAITING khẩn (EMERGENCY hoặc CORRECTIVE+HIGH) — giữ MAINTENANCE.
 * countEmployeeBlockingWorkOrders: chặn KTV mở thêm phiếu khi còn IN_PROGRESS/PAUSED hoặc AWAITING khẩn trên phiếu khác.
 * findOpenAssignmentsForEmployee: phiếu mở theo WO_Assignments — tóm tắt trạng thái hiện trường (/auth/me).
 */
import { getPool } from "../config/database.js";

const COLS = `
  wo.WO_ID          AS woId,
  wo.ScheduleID     AS scheduleId,
  wo.AssetID        AS assetId,
  a.AssetName       AS assetName,
  at.TypeName       AS assetTypeName,
  l.LocationName    AS locationName,
  wo.Description    AS description,
  wo.ClosureFieldNotes AS closureFieldNotes,
  wo.ClosurePartsNotes AS closurePartsNotes,
  wo.PlannedDate    AS plannedDate,
  wo.ActualDate     AS actualDate,
  wo.EstimatedHours AS estimatedHours,
  wo.RequiresShutdown AS requiresShutdown,
  wo.ActualHours    AS actualHours,
  wo.WorkStartedAt        AS workStartedAt,
  wo.PausedAccumulatedSec AS pausedAccumulatedSec,
  wo.PauseStartedAt       AS pauseStartedAt,
  wo.WorkReportedAt       AS workReportedAt,
  wo.CounterBaselineResetAt AS counterBaselineResetAt,
  wo.CounterBaselineResetBy AS counterBaselineResetBy,
  eReset.FullName     AS counterBaselineResetByName,
  wo.Status         AS status,
  wo.WO_Source      AS woSource,
  wo.Priority       AS priority,
  wo.CreatedBy      AS createdBy,
  wo.CreatedAt      AS createdAt,
  wo.IsDeleted      AS isDeleted,
  wo.DeletedAt      AS deletedAt,
  wo.DeletedBy      AS deletedBy,
  eDel.FullName     AS deletedByName,
  (SELECT COUNT(*) FROM WO_Assignments wa_cnt WHERE wa_cnt.WO_ID = wo.WO_ID) AS assignmentCount`;

const BASE_JOIN = `
  FROM WorkOrders wo
  JOIN Assets a      ON a.AssetID       = wo.AssetID
  JOIN AssetTypes at ON at.AssetTypeID  = a.AssetTypeID
  JOIN Locations l   ON l.LocationID    = a.LocationID
  LEFT JOIN Employees eReset ON eReset.EmployeeID = wo.CounterBaselineResetBy
  LEFT JOIN Employees eDel   ON eDel.EmployeeID   = wo.DeletedBy`;

/**
 * Soft-delete clause: thêm vào WHERE để lọc phiếu hiện hữu / đã lưu trữ.
 *   archived === true   → chỉ phiếu đã lưu trữ (tab Admin).
 *   archived === false / undefined → loại bỏ phiếu đã xoá (mặc định ở mọi nơi).
 */
function softDeleteClause(archived) {
  return archived === true ? "wo.IsDeleted = 1" : "wo.IsDeleted = 0";
}

/** Cờ phê duyệt cho danh sách WO (UI): PENDING vs chờ gửi lại sau REQUEST_CHANGES. */
const APPROVAL_LIST_FLAGS = `
  , (EXISTS (
      SELECT 1 FROM ApprovalLogs al_p
      WHERE al_p.ResourceID = wo.WO_ID AND al_p.ResourceType = 'WORK_ORDER' AND al_p.Status = 'PENDING'
    )) AS approvalHasPending
  , (wo.Status = 'PENDING_APPROVAL'
     AND NOT EXISTS (
       SELECT 1 FROM ApprovalLogs al_np
       WHERE al_np.ResourceID = wo.WO_ID AND al_np.ResourceType = 'WORK_ORDER' AND al_np.Status = 'PENDING'
     )
     AND EXISTS (
       SELECT 1 FROM ApprovalLogs al_rc
       WHERE al_rc.ResourceID = wo.WO_ID AND al_rc.ResourceType = 'WORK_ORDER' AND al_rc.Status = 'REQUEST_CHANGES'
     )
    ) AS needsApprovalResubmit`;

export async function findAll({
  status,
  assetId,
  locationId,
  priority,
  woSource,
  assignedTo,
  resourceType,
  plannedFrom,
  plannedTo,
  q,
  limit,
  offset,
  archived = false,
} = {}) {
  const params = [];
  let join = BASE_JOIN;
  let where = `WHERE ${softDeleteClause(archived)}`;
  if (status) {
    where += " AND wo.Status = ?";
    params.push(status);
  }
  if (assetId) {
    where += " AND wo.AssetID = ?";
    params.push(assetId);
  }
  if (locationId) {
    where += " AND a.LocationID = ?";
    params.push(locationId);
  }
  if (priority) {
    where += " AND wo.Priority = ?";
    params.push(priority);
  }
  if (woSource) {
    where += " AND wo.WO_Source = ?";
    params.push(woSource);
  }
  if (assignedTo) {
    join += " JOIN WO_Assignments wa ON wa.WO_ID = wo.WO_ID";
    where += " AND wa.EmployeeID = ?";
    params.push(assignedTo);
  }
  if (resourceType === "UNASSIGNED") {
    where += " AND (SELECT COUNT(*) FROM WO_Assignments wa_cnt WHERE wa_cnt.WO_ID = wo.WO_ID) = 0";
  }
  if (resourceType === "INDIVIDUAL") {
    where += " AND (SELECT COUNT(*) FROM WO_Assignments wa_cnt WHERE wa_cnt.WO_ID = wo.WO_ID) = 1";
  }
  if (resourceType === "GROUP") {
    where += " AND (SELECT COUNT(*) FROM WO_Assignments wa_cnt WHERE wa_cnt.WO_ID = wo.WO_ID) >= 2";
  }
  if (plannedFrom) {
    where += " AND wo.PlannedDate >= ?";
    params.push(plannedFrom);
  }
  if (plannedTo) {
    where += " AND wo.PlannedDate <= ?";
    params.push(plannedTo);
  }
  const qTrim = q != null ? String(q).trim() : "";
  if (qTrim) {
    const like = `%${qTrim}%`;
    where += " AND (a.AssetName LIKE ? OR l.LocationName LIKE ? OR IFNULL(wo.Description,'') LIKE ? OR CAST(wo.WO_ID AS CHAR) LIKE ?)";
    params.push(like, like, like, like);
  }
  const pagination = limit != null ? "LIMIT ? OFFSET ?" : "";
  if (limit != null) params.push(limit, offset);
  const [rows] = await getPool().query(
    `SELECT ${COLS} ${APPROVAL_LIST_FLAGS} ${join} ${where} ORDER BY wo.Priority DESC, wo.PlannedDate ${pagination}`,
    params,
  );
  return rows;
}

export async function count({
  status,
  assetId,
  locationId,
  priority,
  woSource,
  assignedTo,
  resourceType,
  plannedFrom,
  plannedTo,
  q,
  archived = false,
} = {}) {
  const params = [];
  let join = "FROM WorkOrders wo JOIN Assets a ON a.AssetID = wo.AssetID JOIN Locations l ON l.LocationID = a.LocationID";
  let where = `WHERE ${softDeleteClause(archived)}`;
  if (status) {
    where += " AND wo.Status = ?";
    params.push(status);
  }
  if (assetId) {
    where += " AND wo.AssetID = ?";
    params.push(assetId);
  }
  if (locationId) {
    where += " AND a.LocationID = ?";
    params.push(locationId);
  }
  if (priority) {
    where += " AND wo.Priority = ?";
    params.push(priority);
  }
  if (woSource) {
    where += " AND wo.WO_Source = ?";
    params.push(woSource);
  }
  if (assignedTo) {
    join += " JOIN WO_Assignments wa ON wa.WO_ID = wo.WO_ID";
    where += " AND wa.EmployeeID = ?";
    params.push(assignedTo);
  }
  if (resourceType === "UNASSIGNED") {
    where += " AND (SELECT COUNT(*) FROM WO_Assignments wa_cnt WHERE wa_cnt.WO_ID = wo.WO_ID) = 0";
  }
  if (resourceType === "INDIVIDUAL") {
    where += " AND (SELECT COUNT(*) FROM WO_Assignments wa_cnt WHERE wa_cnt.WO_ID = wo.WO_ID) = 1";
  }
  if (resourceType === "GROUP") {
    where += " AND (SELECT COUNT(*) FROM WO_Assignments wa_cnt WHERE wa_cnt.WO_ID = wo.WO_ID) >= 2";
  }
  if (plannedFrom) {
    where += " AND wo.PlannedDate >= ?";
    params.push(plannedFrom);
  }
  if (plannedTo) {
    where += " AND wo.PlannedDate <= ?";
    params.push(plannedTo);
  }
  const qTrim = q != null ? String(q).trim() : "";
  if (qTrim) {
    const like = `%${qTrim}%`;
    where += " AND (a.AssetName LIKE ? OR l.LocationName LIKE ? OR IFNULL(wo.Description,'') LIKE ? OR CAST(wo.WO_ID AS CHAR) LIKE ?)";
    params.push(like, like, like, like);
  }
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS cnt ${join} ${where}`,
    params,
  );
  return Number(rows[0].cnt);
}

export async function findById(id, { includeArchived = false } = {}) {
  const where = includeArchived ? "" : ` AND wo.IsDeleted = 0`;
  const [rows] = await getPool().query(
    `SELECT ${COLS} ${BASE_JOIN} WHERE wo.WO_ID = ?${where}`,
    [id],
  );
  return rows[0] || null;
}

/** Phiếu PREDICTIVE còn mở trên cùng tài sản — tránh tạo trùng khi vượt ngưỡng nhiều lần. */
export async function findOpenPredictiveIdByAsset(assetId) {
  const [rows] = await getPool().query(
    `SELECT WO_ID AS woId FROM WorkOrders
     WHERE AssetID = ? AND WO_Source IN ('PREDICTIVE','PREDICTIVE_SCHEDULE')
       AND Status NOT IN ('COMPLETED','CANCELLED')
       AND IsDeleted = 0
     ORDER BY WO_ID DESC LIMIT 1`,
    [assetId],
  );
  return rows[0]?.woId ?? null;
}

/** Khẩn chờ nghiệm thu: EMERGENCY hoặc CORRECTIVE+HIGH (khớp phê duyệt 2 bước). */
const SQL_W_AWAITING_URGENT = `(
         w.Status = 'AWAITING_CLOSURE'
         AND (w.Priority = 'EMERGENCY' OR (w.WO_Source = 'CORRECTIVE' AND w.Priority = 'HIGH'))
       )`;

/** Còn phiếu đang làm hoặc phiếu khẩn chờ nghiệm thu — tài sản MAINTENANCE (PAUSED / chờ nghiệm thu thường nhả máy). */
export async function countAssetMaintenanceHoldOrders(assetId) {
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS cnt FROM WorkOrders w
     WHERE w.AssetID = ?
       AND w.IsDeleted = 0
       AND (w.Status = 'IN_PROGRESS' OR ${SQL_W_AWAITING_URGENT})`,
    [assetId],
  );
  return Number(rows[0]?.cnt ?? 0);
}

/**
 * Số phiếu khác (≠ excludeWoId) mà nhân viên đang gánh và chưa “nhả” cho phiếu mới:
 * IN_PROGRESS / PAUSED, hoặc AWAITING khẩn (EMERGENCY hoặc CORRECTIVE+HIGH).
 */
export async function countEmployeeBlockingWorkOrders(employeeId, excludeWoId) {
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS cnt
     FROM WO_Assignments wa
     INNER JOIN WorkOrders w ON w.WO_ID = wa.WO_ID
     WHERE wa.EmployeeID = ?
       AND w.WO_ID <> ?
       AND w.IsDeleted = 0
       AND (
         w.Status IN ('IN_PROGRESS','PAUSED')
         OR ${SQL_W_AWAITING_URGENT}
       )`,
    [employeeId, excludeWoId],
  );
  return Number(rows[0]?.cnt ?? 0);
}

/** Phiếu chưa đóng mà nhân viên được phân công — Dashboard trạng thái KTV/CV KTS. */
export async function findOpenAssignmentsForEmployee(employeeId) {
  const [rows] = await getPool().query(
    `SELECT w.WO_ID AS woId, w.Status AS status, w.Priority AS priority, w.WO_Source AS woSource,
            w.PlannedDate AS plannedDate, a.AssetName AS assetName, l.LocationName AS locationName
     FROM WO_Assignments wa
     INNER JOIN WorkOrders w ON w.WO_ID = wa.WO_ID
     INNER JOIN Assets a ON a.AssetID = w.AssetID
     INNER JOIN Locations l ON l.LocationID = a.LocationID
     WHERE wa.EmployeeID = ?
       AND w.IsDeleted = 0
       AND w.Status NOT IN ('COMPLETED','CANCELLED')
     ORDER BY
       CASE w.Status
         WHEN 'IN_PROGRESS' THEN 1
         WHEN 'PAUSED' THEN 2
         WHEN 'AWAITING_CLOSURE' THEN 3
         WHEN 'WAITING' THEN 4
         ELSE 5
       END,
       w.WO_ID DESC`,
    [employeeId],
  );
  return rows;
}

/** Giờ làm việc thuần (đã trừ pause). Đến WorkReportedAt nếu đã báo hoàn thành chờ nghiệm thu. */
export function computeSuggestedActualHours(wo) {
  if (!wo?.workStartedAt) return undefined;
  if (!["IN_PROGRESS", "PAUSED", "AWAITING_CLOSURE"].includes(wo.status))
    return undefined;
  const reportedMs = wo.workReportedAt
    ? new Date(wo.workReportedAt).getTime()
    : null;
  const end =
    reportedMs != null && Number.isFinite(reportedMs) ? reportedMs : Date.now();
  const start = new Date(wo.workStartedAt).getTime();
  if (!Number.isFinite(start)) return undefined;
  let pauseMs = (Number(wo.pausedAccumulatedSec) || 0) * 1000;
  if (wo.pauseStartedAt) {
    pauseMs += end - new Date(wo.pauseStartedAt).getTime();
  }
  const ms = Math.max(0, end - start - pauseMs);
  return Math.round((ms / 3600000) * 100) / 100;
}

/**
 * Ghi nhận mốc thời gian trước khi đổi Status.
 * Dùng Date từ Node (bind mysql2) — cùng hệ quy chiếu với khi đọc DATETIME và với Date.now() trong computeSuggestedActualHours.
 * Tránh UTC_TIMESTAMP() trong SQL: giá trị đó là “giờ UTC” ghi vào DATETIME không timezone, driver lại đọc như giờ local → lệch ~7h (VN).
 */
/** Lưu ghi chú thợ khi chuyển sang AWAITING_CLOSURE (nghiệm thu đọc tại đây). */
export async function setClosureFieldReport(
  woId,
  { closureFieldNotes, closurePartsNotes } = {},
) {
  const cf =
    closureFieldNotes != null && String(closureFieldNotes).trim() !== ""
      ? String(closureFieldNotes).trim()
      : null;
  const cp =
    closurePartsNotes != null && String(closurePartsNotes).trim() !== ""
      ? String(closurePartsNotes).trim()
      : null;
  await getPool().query(
    `UPDATE WorkOrders SET ClosureFieldNotes = ?, ClosurePartsNotes = ? WHERE WO_ID = ?`,
    [cf, cp, woId],
  );
}

/** Một lần / phiếu — gọi sau khi đã cập nhật AssetCounters (reset mốc PM). */
export async function markCounterBaselineReset(woId, employeeId) {
  const now = new Date();
  await getPool().query(
    `UPDATE WorkOrders SET CounterBaselineResetAt = ?, CounterBaselineResetBy = ? WHERE WO_ID = ?`,
    [now, employeeId, woId],
  );
}

export async function applyTimingTransition(woId, fromStatus, toStatus) {
  const pool = getPool();
  const now = new Date();
  if (toStatus === "IN_PROGRESS" && fromStatus === "WAITING") {
    await pool.query(
      `UPDATE WorkOrders SET WorkStartedAt = COALESCE(WorkStartedAt, ?) WHERE WO_ID = ?`,
      [now, woId],
    );
  }
  if (toStatus === "PAUSED" && fromStatus === "IN_PROGRESS") {
    await pool.query(
      `UPDATE WorkOrders SET PauseStartedAt = ? WHERE WO_ID = ?`,
      [now, woId],
    );
  }
  if (toStatus === "IN_PROGRESS" && fromStatus === "PAUSED") {
    await pool.query(
      `UPDATE WorkOrders SET
        PausedAccumulatedSec = PausedAccumulatedSec + IFNULL(TIMESTAMPDIFF(SECOND, PauseStartedAt, ?), 0),
        PauseStartedAt = NULL
       WHERE WO_ID = ?`,
      [now, woId],
    );
  }
  if (toStatus === "AWAITING_CLOSURE" && fromStatus === "IN_PROGRESS") {
    await pool.query(
      "UPDATE WorkOrders SET WorkReportedAt = ? WHERE WO_ID = ?",
      [now, woId],
    );
  }
  if (toStatus === "IN_PROGRESS" && fromStatus === "AWAITING_CLOSURE") {
    await pool.query(
      "UPDATE WorkOrders SET WorkReportedAt = NULL WHERE WO_ID = ?",
      [woId],
    );
  }
}

export async function getAssignments(woId) {
  const [rows] = await getPool().query(
    `SELECT e.EmployeeID    AS employeeId,
            e.FullName      AS fullName,
            e.PhotoPath     AS photoPath,
            e.Specialty     AS specialty,
            e.CraftLevel    AS craftLevel,
            p.PositionName  AS positionName,
            e.Phone         AS phone,
            e.Email         AS email,
            wa.IsGroupLeader AS isGroupLeader
     FROM WO_Assignments wa
     JOIN Employees e ON e.EmployeeID = wa.EmployeeID
     JOIN Positions p ON p.PositionID = e.PositionID
     WHERE wa.WO_ID = ?
     ORDER BY wa.IsGroupLeader DESC, e.FullName`,
    [woId],
  );
  return rows;
}

/**
 * Liệt kê WO của một lịch theo nhóm trạng thái — dùng cho preview xoá lịch bảo trì.
 * Trả về mảng { woId, status, plannedDate, priority } gọn nhẹ phục vụ UI hiển thị.
 */
export async function findByScheduleAndStatuses(scheduleId, statuses) {
  if (!Array.isArray(statuses) || statuses.length === 0) return [];
  const placeholders = statuses.map(() => "?").join(",");
  const [rows] = await getPool().query(
    `SELECT WO_ID AS woId, Status AS status, PlannedDate AS plannedDate,
            Priority AS priority, WO_Source AS woSource
       FROM WorkOrders
      WHERE ScheduleID = ? AND IsDeleted = 0 AND Status IN (${placeholders})
      ORDER BY WO_ID DESC`,
    [scheduleId, ...statuses],
  );
  return rows;
}

/**
 * Cancel hàng loạt WO theo danh sách ID — dùng khi xoá lịch:
 * WO ở PENDING_APPROVAL/WAITING (chưa khởi động thực tế) chuyển sang CANCELLED
 * thay vì xoá thật để giữ audit trail (FK SET NULL khi lịch xoá xong).
 */
export async function cancelByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const placeholders = ids.map(() => "?").join(",");
  const [result] = await getPool().query(
    `UPDATE WorkOrders SET Status = 'CANCELLED' WHERE WO_ID IN (${placeholders})`,
    ids,
  );
  return result.affectedRows;
}

export async function create({
  scheduleId,
  assetId,
  description,
  plannedDate,
  estimatedHours,
  requiresShutdown,
  status,
  woSource,
  priority,
  createdBy,
}) {
  const [result] = await getPool().query(
    `INSERT INTO WorkOrders (ScheduleID, AssetID, Description, PlannedDate, EstimatedHours, RequiresShutdown, Status, WO_Source, Priority, CreatedBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      scheduleId || null,
      assetId,
      description || null,
      plannedDate,
      estimatedHours || null,
      requiresShutdown ? 1 : 0,
      status || "PENDING_APPROVAL",
      woSource || "MANUAL",
      priority || "MEDIUM",
      createdBy || null,
    ],
  );
  return result.insertId;
}

export async function update(id, data) {
  const map = {
    description: "Description",
    plannedDate: "PlannedDate",
    actualDate: "ActualDate",
    estimatedHours: "EstimatedHours",
    requiresShutdown: "RequiresShutdown",
    actualHours: "ActualHours",
    priority: "Priority",
  };
  const setClauses = [];
  const params = [];
  for (const [key, col] of Object.entries(map)) {
    if (data[key] !== undefined) {
      setClauses.push(`${col} = ?`);
      params.push(data[key] ?? null);
    }
  }
  if (!setClauses.length) return 0;
  params.push(id);
  const [result] = await getPool().query(
    `UPDATE WorkOrders SET ${setClauses.join(", ")} WHERE WO_ID = ?`,
    params,
  );
  return result.affectedRows;
}

export async function updateStatus(
  id,
  status,
  { actualDate, actualHours } = {},
) {
  const setClauses = ["Status = ?"];
  const params = [status];
  if (actualDate) {
    setClauses.push("ActualDate = ?");
    params.push(actualDate);
  }
  if (actualHours !== undefined) {
    setClauses.push("ActualHours = ?");
    params.push(actualHours);
  }
  params.push(id);
  await getPool().query(
    `UPDATE WorkOrders SET ${setClauses.join(", ")} WHERE WO_ID = ?`,
    params,
  );
}

/**
 * Thêm hoặc cập nhật phân công (upsert).
 * isGroupLeader = true → người này là trưởng nhóm phiếu việc.
 * Phân công cá nhân: isGroupLeader = true (chính họ tự khởi động).
 */
export async function assign(woId, employeeId, isGroupLeader = false) {
  await getPool().query(
    `INSERT INTO WO_Assignments (WO_ID, EmployeeID, IsGroupLeader)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE IsGroupLeader = VALUES(IsGroupLeader)`,
    [woId, employeeId, isGroupLeader ? 1 : 0],
  );
}

/** Xóa toàn bộ phân công hiện tại của WO (dùng trước khi giao nhóm mới). */
export async function clearAssignments(woId) {
  await getPool().query("DELETE FROM WO_Assignments WHERE WO_ID = ?", [woId]);
}

export async function unassign(woId, employeeId) {
  await getPool().query(
    "DELETE FROM WO_Assignments WHERE WO_ID = ? AND EmployeeID = ?",
    [woId, employeeId],
  );
}

/**
 * Hard delete — chỉ dùng cho cleanup nội bộ / admin tools (không gọi từ HTTP layer).
 * Tất cả flow xoá phiếu của user đều đi qua softRemove() để giữ archive.
 */
export async function remove(id) {
  const [result] = await getPool().query(
    "DELETE FROM WorkOrders WHERE WO_ID = ?",
    [id],
  );
  return result.affectedRows;
}

/**
 * Xoá mềm (đánh dấu IsDeleted=1) — phiếu vẫn nằm trong DB, vẫn giữ checklist /
 * ảnh đóng phiếu / phân công / log phê duyệt để truy xuất ở tab "Đã lưu trữ".
 */
export async function softRemove(id, deletedBy) {
  const [result] = await getPool().query(
    `UPDATE WorkOrders
       SET IsDeleted = 1, DeletedAt = ?, DeletedBy = ?
     WHERE WO_ID = ? AND IsDeleted = 0`,
    [new Date(), deletedBy || null, id],
  );
  return result.affectedRows;
}

/** Khôi phục phiếu đã lưu trữ — chỉ Admin được phép (service tự kiểm tra). */
export async function restore(id) {
  const [result] = await getPool().query(
    `UPDATE WorkOrders
       SET IsDeleted = 0, DeletedAt = NULL, DeletedBy = NULL
     WHERE WO_ID = ? AND IsDeleted = 1`,
    [id],
  );
  return result.affectedRows;
}
