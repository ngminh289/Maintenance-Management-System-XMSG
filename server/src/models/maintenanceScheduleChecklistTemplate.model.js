/**
 * maintenanceScheduleChecklistTemplate.model.js — junction N mẫu checklist / lịch.
 */
import { getPool } from "../config/database.js";

export async function listByScheduleId(scheduleId) {
  const [rows] = await getPool().query(
    `SELECT msct.TemplateID AS templateId,
            ct.TemplateName AS templateName,
            msct.SortOrder AS sortOrder
     FROM MaintenanceScheduleChecklistTemplates msct
     JOIN ChecklistTemplates ct ON ct.TemplateID = msct.TemplateID
     WHERE msct.ScheduleID = ?
     ORDER BY msct.SortOrder ASC, msct.TemplateID ASC`,
    [scheduleId],
  );
  return rows;
}

export async function listTemplateIdsByScheduleId(scheduleId) {
  const rows = await listByScheduleId(scheduleId);
  return rows.map((r) => Number(r.templateId));
}

/** Map scheduleId -> [{ templateId, templateName, sortOrder }] */
export async function listGroupedByScheduleIds(scheduleIds = []) {
  const ids = [...new Set(scheduleIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
  if (!ids.length) return new Map();
  const [rows] = await getPool().query(
    `SELECT msct.ScheduleID AS scheduleId,
            msct.TemplateID AS templateId,
            ct.TemplateName AS templateName,
            msct.SortOrder AS sortOrder
     FROM MaintenanceScheduleChecklistTemplates msct
     JOIN ChecklistTemplates ct ON ct.TemplateID = msct.TemplateID
     WHERE msct.ScheduleID IN (?)
     ORDER BY msct.ScheduleID, msct.SortOrder ASC, msct.TemplateID ASC`,
    [ids],
  );
  const map = new Map();
  for (const row of rows) {
    const sid = Number(row.scheduleId);
    if (!map.has(sid)) map.set(sid, []);
    map.get(sid).push(row);
  }
  return map;
}

export async function replaceForSchedule(scheduleId, templateIds = []) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      "DELETE FROM MaintenanceScheduleChecklistTemplates WHERE ScheduleID = ?",
      [scheduleId],
    );
    const ids = [...new Set(templateIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
    for (let i = 0; i < ids.length; i += 1) {
      await conn.query(
        `INSERT INTO MaintenanceScheduleChecklistTemplates (ScheduleID, TemplateID, SortOrder)
         VALUES (?, ?, ?)`,
        [scheduleId, ids[i], i],
      );
    }
    await conn.commit();
    return ids;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
