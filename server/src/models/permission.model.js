/**
 * permission.model.js — SQL thuần cho Roles_Permissions.
 * Dùng trong: services/permission.service.js.
 */
import { getPool } from '../config/database.js';

export async function findAll(positionId) {
  const params = [];
  let where = '';
  if (positionId) { where = 'WHERE rp.PositionID = ?'; params.push(positionId); }
  const [rows] = await getPool().query(
    `SELECT rp.PermissionID AS permissionId, rp.PositionID AS positionId,
            p.PositionName AS positionName, p.Level AS positionLevel,
            rp.PermissionName AS permissionName, rp.ResourceType AS resourceType
     FROM Roles_Permissions rp
     JOIN Positions p ON p.PositionID = rp.PositionID
     ${where} ORDER BY p.Level, rp.ResourceType, rp.PermissionName`,
    params,
  );
  return rows;
}

export async function create({ positionId, permissionName, resourceType }) {
  const [result] = await getPool().query(
    'INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES (?, ?, ?)',
    [positionId, permissionName, resourceType],
  );
  return result.insertId;
}

export async function remove(id) {
  const [result] = await getPool().query('DELETE FROM Roles_Permissions WHERE PermissionID = ?', [id]);
  return result.affectedRows;
}

/** Kiểm tra permission nhanh (dùng trong service nếu cần) */
export async function hasPermission(positionId, permissionName, resourceType) {
  const [rows] = await getPool().query(
    'SELECT 1 FROM Roles_Permissions WHERE PositionID = ? AND PermissionName = ? AND ResourceType = ? LIMIT 1',
    [positionId, permissionName, resourceType],
  );
  return rows.length > 0;
}

/** Nhân viên đang hoạt động có quyền cụ thể (dùng gửi thông báo tiếp nhận checklist, v.v.). */
export async function findActiveEmployeeIdsByPermission(permissionName, resourceType) {
  const [rows] = await getPool().query(
    `SELECT DISTINCT e.EmployeeID AS employeeId
     FROM Employees e
     INNER JOIN Roles_Permissions rp ON rp.PositionID = e.PositionID
     WHERE e.IsActive = 1
       AND rp.PermissionName = ?
       AND rp.ResourceType = ?`,
    [permissionName, resourceType],
  );
  return rows.map((r) => Number(r.employeeId)).filter((id) => id > 0);
}
