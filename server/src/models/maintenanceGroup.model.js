/**
 * maintenanceGroup.model.js — SQL thuần cho MaintenanceGroups + GroupMembers.
 * GroupMembers: IsGroupLeader (migration 045) — trưởng nhóm cố định.
 * MaintenanceGroups: Specialty (migration 046), IsActive (migration 047 — soft-delete).
 * Dùng trong: services/maintenanceGroup.service.js.
 */
import { getPool } from '../config/database.js';

export async function findAll({ includeInactive = false } = {}) {
  const where = includeInactive ? '' : 'WHERE g.IsActive = 1';
  const [rows] = await getPool().query(
    `SELECT g.GroupID    AS groupId,
            g.GroupName  AS groupName,
            g.Specialty  AS specialty,
            g.Description AS description,
            g.IsActive   AS isActive,
            COUNT(gm.EmployeeID) AS memberCount,
            MAX(CASE WHEN gm.IsGroupLeader = 1 THEN e.FullName END) AS leaderName
     FROM MaintenanceGroups g
     LEFT JOIN GroupMembers gm ON gm.GroupID = g.GroupID
     LEFT JOIN Employees e ON e.EmployeeID = gm.EmployeeID
     ${where}
     GROUP BY g.GroupID
     ORDER BY g.GroupName`,
  );
  return rows;
}

export async function findById(id) {
  const [rows] = await getPool().query(
    `SELECT GroupID AS groupId, GroupName AS groupName, Specialty AS specialty,
            Description AS description, IsActive AS isActive
     FROM MaintenanceGroups WHERE GroupID = ?`,
    [id],
  );
  return rows[0] || null;
}

export async function create({ groupName, specialty, description }) {
  const [result] = await getPool().query(
    'INSERT INTO MaintenanceGroups (GroupName, Specialty, Description) VALUES (?, ?, ?)',
    [groupName, specialty || null, description || null],
  );
  return result.insertId;
}

export async function update(id, { groupName, specialty, description }) {
  const setClauses = [];
  const params = [];
  if (groupName   !== undefined) { setClauses.push('GroupName = ?');   params.push(groupName   ?? null); }
  if (specialty   !== undefined) { setClauses.push('Specialty = ?');   params.push(specialty   ?? null); }
  if (description !== undefined) { setClauses.push('Description = ?'); params.push(description ?? null); }
  if (setClauses.length === 0) return 0;
  params.push(id);
  const [r] = await getPool().query(
    `UPDATE MaintenanceGroups SET ${setClauses.join(', ')} WHERE GroupID = ?`, params,
  );
  return r.affectedRows;
}

/** Soft-delete: đặt IsActive = 0 thay vì xóa thật. */
export async function deactivate(id) {
  const [r] = await getPool().query(
    'UPDATE MaintenanceGroups SET IsActive = 0 WHERE GroupID = ?', [id],
  );
  return r.affectedRows;
}

/** Kiểm tra nhóm có WO đang hoạt động không (WAITING/IN_PROGRESS/PAUSED/AWAITING_CLOSURE). */
export async function hasActiveWorkOrders(groupId) {
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS cnt
     FROM WO_Assignments wa
     JOIN WorkOrders w ON w.WO_ID = wa.WO_ID
     JOIN GroupMembers gm ON gm.EmployeeID = wa.EmployeeID AND gm.GroupID = ?
     WHERE w.IsDeleted = 0
       AND w.Status NOT IN ('COMPLETED','CANCELLED')`,
    [groupId],
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}

export async function getMembers(groupId) {
  const [rows] = await getPool().query(
    `SELECT e.EmployeeID      AS employeeId,
            e.FullName        AS fullName,
            e.PhotoPath       AS photoPath,
            e.CraftLevel      AS craftLevel,
            e.Specialty       AS empSpecialty,
            p.PositionName    AS positionName,
            e.Phone           AS phone,
            gm.RoleNotes      AS roleNotes,
            gm.Notes          AS notes,
            gm.IsGroupLeader  AS isGroupLeader
     FROM GroupMembers gm
     JOIN Employees e ON e.EmployeeID = gm.EmployeeID
     JOIN Positions p ON p.PositionID = e.PositionID
     WHERE gm.GroupID = ?
     ORDER BY gm.IsGroupLeader DESC, e.FullName`,
    [groupId],
  );
  return rows;
}

export async function addMember(groupId, employeeId, { roleNotes, notes } = {}) {
  await getPool().query(
    `INSERT INTO GroupMembers (GroupID, EmployeeID, RoleNotes, Notes)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE RoleNotes = VALUES(RoleNotes), Notes = VALUES(Notes)`,
    [groupId, employeeId, roleNotes || null, notes || null],
  );
}

export async function updateMember(groupId, employeeId, { notes, roleNotes } = {}) {
  const setClauses = [];
  const params = [];
  if (notes     !== undefined) { setClauses.push('Notes = ?');     params.push(notes     ?? null); }
  if (roleNotes !== undefined) { setClauses.push('RoleNotes = ?'); params.push(roleNotes ?? null); }
  if (setClauses.length === 0) return 0;
  params.push(groupId, employeeId);
  const [r] = await getPool().query(
    `UPDATE GroupMembers SET ${setClauses.join(', ')} WHERE GroupID = ? AND EmployeeID = ?`, params,
  );
  return r.affectedRows;
}

/** Đặt trưởng nhóm cố định. Reset toàn nhóm về 0, sau đó set người mới = 1. */
export async function setGroupLeader(groupId, employeeId) {
  const pool = getPool();
  await pool.query('UPDATE GroupMembers SET IsGroupLeader = 0 WHERE GroupID = ?', [groupId]);
  const [r] = await pool.query(
    'UPDATE GroupMembers SET IsGroupLeader = 1 WHERE GroupID = ? AND EmployeeID = ?',
    [groupId, employeeId],
  );
  return r.affectedRows;
}

export async function removeMember(groupId, employeeId) {
  await getPool().query('DELETE FROM GroupMembers WHERE GroupID = ? AND EmployeeID = ?', [groupId, employeeId]);
}
