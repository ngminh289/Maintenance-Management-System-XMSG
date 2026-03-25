/**
 * maintenanceGroup.model.js — SQL thuần cho MaintenanceGroups + GroupMembers.
 * Dùng trong: services/maintenanceGroup.service.js.
 */
import { getPool } from '../config/database.js';

export async function findAll() {
  const [rows] = await getPool().query(
    `SELECT g.GroupID AS groupId, g.GroupName AS groupName, g.Description AS description,
            COUNT(gm.EmployeeID) AS memberCount
     FROM MaintenanceGroups g
     LEFT JOIN GroupMembers gm ON gm.GroupID = g.GroupID
     GROUP BY g.GroupID ORDER BY g.GroupName`,
  );
  return rows;
}

export async function findById(id) {
  const [rows] = await getPool().query(
    'SELECT GroupID AS groupId, GroupName AS groupName, Description AS description FROM MaintenanceGroups WHERE GroupID = ?',
    [id],
  );
  return rows[0] || null;
}

export async function create({ groupName, description }) {
  const [result] = await getPool().query(
    'INSERT INTO MaintenanceGroups (GroupName, Description) VALUES (?, ?)',
    [groupName, description || null],
  );
  return result.insertId;
}

export async function update(id, { groupName, description }) {
  const [result] = await getPool().query(
    'UPDATE MaintenanceGroups SET GroupName = ?, Description = ? WHERE GroupID = ?',
    [groupName, description || null, id],
  );
  return result.affectedRows;
}

export async function remove(id) {
  const [result] = await getPool().query('DELETE FROM MaintenanceGroups WHERE GroupID = ?', [id]);
  return result.affectedRows;
}

export async function getMembers(groupId) {
  const [rows] = await getPool().query(
    `SELECT e.EmployeeID AS employeeId, e.FullName AS fullName,
            p.PositionName AS positionName, e.Phone AS phone, gm.RoleNotes AS roleNotes
     FROM GroupMembers gm
     JOIN Employees e ON e.EmployeeID = gm.EmployeeID
     JOIN Positions p ON p.PositionID = e.PositionID
     WHERE gm.GroupID = ?`,
    [groupId],
  );
  return rows;
}

export async function addMember(groupId, employeeId, roleNotes) {
  await getPool().query(
    'INSERT IGNORE INTO GroupMembers (GroupID, EmployeeID, RoleNotes) VALUES (?, ?, ?)',
    [groupId, employeeId, roleNotes || null],
  );
}

export async function removeMember(groupId, employeeId) {
  await getPool().query(
    'DELETE FROM GroupMembers WHERE GroupID = ? AND EmployeeID = ?',
    [groupId, employeeId],
  );
}
