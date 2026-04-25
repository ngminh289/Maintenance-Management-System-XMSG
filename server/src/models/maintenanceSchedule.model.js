/**
 * maintenanceSchedule.model.js — SQL thuần cho bảng MaintenanceSchedules.
 * COLS: assetTypeId từ Assets — dùng API/UI và đồng bộ validate checklist với loại tài sản thực tế.
 * patchLastExecutedDate / findCalendarOperationalByAsset: đồng bộ với WO hoàn thành (workOrderMaintenanceSync).
 * Dùng trong: maintenanceSchedule.service.js, workOrderMaintenanceSync.service.js.
 */
import { getPool } from "../config/database.js";

const COLS = `
  ms.ScheduleID        AS scheduleId,
  ms.AssetID           AS assetId,
  a.AssetName          AS assetName,
  a.AssetTypeID      AS assetTypeId,
  a.LocationID         AS locationId,
  l.LocationName       AS locationName,
  at.TypeName          AS assetTypeName,
  ms.ScheduleName      AS scheduleName,
  ms.MaintenanceType   AS maintenanceType,
  ms.Description       AS description,
  ms.FrequencyValue    AS frequencyValue,
  ms.FrequencyUnit     AS frequencyUnit,
  ms.StartDate         AS startDate,
  ms.NextDueDate       AS nextDueDate,
  ms.LastExecutedDate  AS lastExecutedDate,
  ms.EndDate           AS endDate,
  ms.EstimatedTime     AS estimatedTime,
  ms.Priority          AS priority,
  ms.Status            AS status,
  ms.DigitalAssetID    AS digitalAssetId,
  ms.ChecklistTemplateID AS checklistTemplateId,
  ct.TemplateName      AS checklistTemplateName,
  ms.CreatedBy         AS createdBy,
  ms.CreatedAt         AS createdAt`;

const BASE_JOIN = `
  FROM MaintenanceSchedules ms
  JOIN Assets a    ON a.AssetID       = ms.AssetID
  JOIN Locations l ON l.LocationID    = a.LocationID
  JOIN AssetTypes at ON at.AssetTypeID = a.AssetTypeID
  LEFT JOIN ChecklistTemplates ct ON ct.TemplateID = ms.ChecklistTemplateID`;

export async function findAll({
  assetId,
  locationId,
  status,
  maintenanceType,
  priority,
  dueFrom,
  dueTo,
  limit,
  offset,
} = {}) {
  const params = [];
  let where = "WHERE 1=1";
  if (assetId) {
    where += " AND ms.AssetID = ?";
    params.push(assetId);
  }
  if (locationId) {
    where += " AND a.LocationID = ?";
    params.push(locationId);
  }
  if (status) {
    where += " AND ms.Status = ?";
    params.push(status);
  }
  if (maintenanceType) {
    where += " AND ms.MaintenanceType = ?";
    params.push(maintenanceType);
  }
  if (priority) {
    where += " AND ms.Priority = ?";
    params.push(priority);
  }
  if (dueFrom) {
    where += " AND ms.NextDueDate >= ?";
    params.push(dueFrom);
  }
  if (dueTo) {
    where += " AND ms.NextDueDate <= ?";
    params.push(dueTo);
  }
  const pagination = limit != null ? "LIMIT ? OFFSET ?" : "";
  if (limit != null) {
    params.push(limit, offset);
  }
  const [rows] = await getPool().query(
    `SELECT ${COLS} ${BASE_JOIN} ${where} ORDER BY ms.StartDate DESC ${pagination}`,
    params,
  );
  return rows;
}

export async function count({
  assetId,
  locationId,
  status,
  maintenanceType,
  priority,
  dueFrom,
  dueTo,
} = {}) {
  const params = [];
  let where = "WHERE 1=1";
  let join = "FROM MaintenanceSchedules ms JOIN Assets a ON a.AssetID = ms.AssetID";
  if (assetId) {
    where += " AND ms.AssetID = ?";
    params.push(assetId);
  }
  if (locationId) {
    where += " AND a.LocationID = ?";
    params.push(locationId);
  }
  if (status) {
    where += " AND ms.Status = ?";
    params.push(status);
  }
  if (maintenanceType) {
    where += " AND ms.MaintenanceType = ?";
    params.push(maintenanceType);
  }
  if (priority) {
    where += " AND ms.Priority = ?";
    params.push(priority);
  }
  if (dueFrom) {
    where += " AND ms.NextDueDate >= ?";
    params.push(dueFrom);
  }
  if (dueTo) {
    where += " AND ms.NextDueDate <= ?";
    params.push(dueTo);
  }
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS cnt ${join} ${where}`,
    params,
  );
  return Number(rows[0].cnt);
}

export async function findById(id) {
  const [rows] = await getPool().query(
    `SELECT ${COLS} ${BASE_JOIN} WHERE ms.ScheduleID = ?`,
    [id],
  );
  return rows[0] || null;
}

/** Lấy lịch bảo trì kiểu HOURS cho một tài sản (dùng để tính ngưỡng giờ) */
export async function findHourlyByAsset(assetId) {
  const [rows] = await getPool().query(
    `SELECT ScheduleID AS scheduleId, FrequencyValue AS frequencyValue
     FROM MaintenanceSchedules
     WHERE AssetID = ? AND FrequencyUnit = 'HOURS' AND Status = 'PENDING'
     ORDER BY FrequencyValue`,
    [assetId],
  );
  return rows;
}

export async function create(data) {
  const {
    assetId,
    scheduleName,
    maintenanceType,
    description,
    frequencyValue,
    frequencyUnit,
    startDate,
    nextDueDate,
    endDate,
    estimatedTime,
    priority,
    digitalAssetId,
    checklistTemplateId,
    createdBy,
    status,
  } = data;
  const [result] = await getPool().query(
    `INSERT INTO MaintenanceSchedules
     (AssetID, ScheduleName, MaintenanceType, Description, FrequencyValue, FrequencyUnit, StartDate, NextDueDate, EndDate, EstimatedTime, Priority, DigitalAssetID, ChecklistTemplateID, CreatedBy, Status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      assetId,
      scheduleName || "",
      maintenanceType,
      description,
      frequencyValue || null,
      frequencyUnit || "HOURS",
      startDate,
      nextDueDate ?? null,
      endDate || null,
      estimatedTime || null,
      priority || "MEDIUM",
      digitalAssetId || null,
      checklistTemplateId || null,
      createdBy || null,
      status || "DRAFT",
    ],
  );
  return result.insertId;
}

/** Cập nhật sau khi bảo trì: lưu LastExecutedDate và NextDueDate mới */
export async function setExecuted(id, lastExecutedDate, nextDueDate) {
  await getPool().query(
    "UPDATE MaintenanceSchedules SET LastExecutedDate = ?, NextDueDate = ?, Status = ? WHERE ScheduleID = ?",
    [lastExecutedDate, nextDueDate, "PENDING", id],
  );
}

/** Chỉ cập nhật ngày hoàn thành thực tế (WO từ lịch đóng — NextDueDate đã lùi lúc tạo phiếu). */
export async function patchLastExecutedDate(scheduleId, lastExecutedDate) {
  await getPool().query(
    "UPDATE MaintenanceSchedules SET LastExecutedDate = ? WHERE ScheduleID = ?",
    [lastExecutedDate, scheduleId],
  );
}

/** Lịch theo lịch âm còn hiệu lực — để lùi mốc khi PM theo giờ xong trùng kỳ. */
export async function findCalendarOperationalByAsset(assetId) {
  const [rows] = await getPool().query(
    `SELECT ScheduleID AS scheduleId, FrequencyValue AS frequencyValue,
            FrequencyUnit AS frequencyUnit, NextDueDate AS nextDueDate
     FROM MaintenanceSchedules
     WHERE AssetID = ?
       AND FrequencyUnit IN ('DAYS','WEEKS','MONTHS','YEARS')
       AND Status IN ('PENDING','IN_PROGRESS','OVERDUE')
       AND (EndDate IS NULL OR EndDate >= CURDATE())`,
    [assetId],
  );
  return rows;
}

/** Lấy tất cả lịch theo DAYS/WEEKS/MONTHS còn hoạt động (để check cảnh báo) */
export async function findActiveCalendarSchedules() {
  const [rows] = await getPool().query(
    `SELECT ms.ScheduleID AS scheduleId, ms.AssetID AS assetId, a.AssetName AS assetName,
            ms.ScheduleName AS scheduleName, ms.FrequencyValue AS frequencyValue,
            ms.FrequencyUnit AS frequencyUnit, ms.NextDueDate AS nextDueDate,
            ms.Priority AS priority, ms.Status AS status
     FROM MaintenanceSchedules ms
     JOIN Assets a ON a.AssetID = ms.AssetID
     WHERE ms.FrequencyUnit IN ('DAYS','WEEKS','MONTHS','YEARS')
       AND (ms.EndDate IS NULL OR ms.EndDate >= CURDATE())
       AND ms.Status NOT IN ('COMPLETED', 'DRAFT', 'CANCELLED', 'PENDING_APPROVAL', 'REJECTED')
     ORDER BY ms.NextDueDate ASC`,
  );
  return rows;
}

export async function update(id, data) {
  const map = {
    scheduleName: "ScheduleName",
    description: "Description",
    frequencyValue: "FrequencyValue",
    frequencyUnit: "FrequencyUnit",
    startDate: "StartDate",
    nextDueDate: "NextDueDate",
    lastExecutedDate: "LastExecutedDate",
    endDate: "EndDate",
    estimatedTime: "EstimatedTime",
    priority: "Priority",
    checklistTemplateId: "ChecklistTemplateID",
    status: "Status",
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
    `UPDATE MaintenanceSchedules SET ${setClauses.join(", ")} WHERE ScheduleID = ?`,
    params,
  );
  return result.affectedRows;
}

export async function updateStatus(id, status) {
  await getPool().query(
    "UPDATE MaintenanceSchedules SET Status = ? WHERE ScheduleID = ?",
    [status, id],
  );
}

export async function remove(id) {
  const [result] = await getPool().query(
    "DELETE FROM MaintenanceSchedules WHERE ScheduleID = ?",
    [id],
  );
  return result.affectedRows;
}
