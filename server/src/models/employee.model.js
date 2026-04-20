/**
 * employee.model.js — SQL thuần cho bảng Employees.
 * Chú ý: findByUsernameOrEmail trả về PasswordHash — chỉ dùng trong auth.service.
 * Lịch nghỉ: LeaveStartAt / LeaveEndAt; onScheduledLeave = NOW() trong [start,end] (migration 030).
 * Kỹ năng: CraftLevel, Specialty, ExperienceNotes (migration 043).
 * Ảnh đại diện: PhotoPath (migration 043) — uploads/employees/:filename.
 * Dùng trong: auth.service, employee.service, workOrderFieldAssign, documentFeedback.
 */
import { getPool } from "../config/database.js";

const PUBLIC_COLS = `
  e.EmployeeID        AS employeeId,
  e.FullName          AS fullName,
  e.Username          AS username,
  e.Email             AS email,
  e.Phone             AS phone,
  e.CraftLevel        AS craftLevel,
  e.Specialty         AS specialty,
  e.ExperienceNotes   AS experienceNotes,
  e.PhotoPath         AS photoPath,
  e.EmailVerified     AS emailVerified,
  e.IsActive          AS isActive,
  e.WasEverActivated  AS wasEverActivated,
  e.LeaveStartAt      AS leaveStartAt,
  e.LeaveEndAt        AS leaveEndAt,
  (e.LeaveStartAt IS NOT NULL AND e.LeaveEndAt IS NOT NULL
   AND NOW() >= e.LeaveStartAt AND NOW() <= e.LeaveEndAt) AS onScheduledLeave,
  e.CreatedAt         AS createdAt,
  e.PositionID        AS positionId,
  p.PositionName      AS positionName,
  p.Level             AS positionLevel,
  e.DepartmentID      AS departmentId,
  d.DepartmentName    AS departmentName`;

const BASE_JOIN = `
  FROM Employees e
  JOIN Positions   p ON p.PositionID   = e.PositionID
  JOIN Departments d ON d.DepartmentID = e.DepartmentID`;

export async function findAll({
  limit, offset,
  departmentId, positionId, isActive, search, specialty, craftLevel, maxLevel,
} = {}) {
  const params = [];
  let where = "WHERE 1=1";

  if (departmentId !== undefined) { where += " AND e.DepartmentID = ?"; params.push(departmentId); }
  if (positionId   !== undefined) { where += " AND e.PositionID = ?";   params.push(positionId); }
  if (isActive     !== undefined) { where += " AND e.IsActive = ?";     params.push(isActive); }
  if (maxLevel     !== undefined) {
    where += " AND p.Level <= ?";
    params.push(maxLevel);
  }
  if (craftLevel) { where += " AND e.CraftLevel = ?"; params.push(Number(craftLevel)); }
  if (specialty) {
    where += " AND e.Specialty LIKE ?";
    params.push(`%${specialty}%`);
  }
  if (search) {
    where += " AND (e.FullName LIKE ? OR e.Username LIKE ? OR e.Email LIKE ? OR e.Specialty LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const orderBy = "ORDER BY e.FullName";
  const pagination = limit !== undefined ? "LIMIT ? OFFSET ?" : "";
  if (limit !== undefined) params.push(limit, offset);

  const [rows] = await getPool().query(
    `SELECT ${PUBLIC_COLS} ${BASE_JOIN} ${where} ${orderBy} ${pagination}`,
    params,
  );
  return rows;
}

export async function count({ departmentId, positionId, isActive, search, specialty, craftLevel, maxLevel } = {}) {
  const params = [];
  let join  = "FROM Employees e JOIN Positions p ON p.PositionID = e.PositionID";
  let where = "WHERE 1=1";
  if (departmentId !== undefined) { where += " AND e.DepartmentID = ?"; params.push(departmentId); }
  if (positionId   !== undefined) { where += " AND e.PositionID = ?";   params.push(positionId); }
  if (isActive     !== undefined) { where += " AND e.IsActive = ?";     params.push(isActive); }
  if (maxLevel     !== undefined) { where += " AND p.Level <= ?";       params.push(maxLevel); }
  if (craftLevel)  { where += " AND e.CraftLevel = ?"; params.push(Number(craftLevel)); }
  if (specialty)   { where += " AND e.Specialty LIKE ?"; params.push(`%${specialty}%`); }
  if (search) {
    where += " AND (e.FullName LIKE ? OR e.Username LIKE ? OR e.Email LIKE ? OR e.Specialty LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  const [rows] = await getPool().query(`SELECT COUNT(*) AS cnt ${join} ${where}`, params);
  return Number(rows[0].cnt);
}

export async function findById(id) {
  const [rows] = await getPool().query(
    `SELECT ${PUBLIC_COLS} ${BASE_JOIN} WHERE e.EmployeeID = ?`,
    [id],
  );
  return rows[0] || null;
}

/** Dùng riêng cho auth — có PasswordHash */
export async function findByUsernameOrEmail(username, email) {
  const [rows] = await getPool().query(
    `SELECT e.EmployeeID AS employeeId, e.FullName AS fullName, e.Username AS username,
            e.PasswordHash AS passwordHash, e.Email AS email, e.Phone AS phone,
            e.EmailVerified AS emailVerified, e.IsActive AS isActive,
            e.WasEverActivated AS wasEverActivated,
            e.PositionID AS positionId, e.DepartmentID AS departmentId,
            p.Level AS positionLevel
     FROM Employees e
     JOIN Positions p ON p.PositionID = e.PositionID
     WHERE e.Username = ? OR e.Email = ?
     LIMIT 1`,
    [username, email],
  );
  return rows[0] || null;
}

export async function findByEmail(email) {
  const [rows] = await getPool().query(
    "SELECT EmployeeID AS employeeId, FullName AS fullName, Email AS email FROM Employees WHERE Email = ?",
    [email],
  );
  return rows[0] || null;
}

export async function create({
  fullName, username, passwordHash, email, phone,
  positionId, departmentId,
  craftLevel, specialty, experienceNotes,
  emailVerified = false, isActive = true, wasEverActivated,
}) {
  const ever = wasEverActivated !== undefined ? wasEverActivated : isActive;
  const [result] = await getPool().query(
    `INSERT INTO Employees
       (FullName, Username, PasswordHash, Email, Phone,
        CraftLevel, Specialty, ExperienceNotes,
        PositionID, DepartmentID, EmailVerified, IsActive, WasEverActivated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fullName, username, passwordHash, email, phone || null,
      craftLevel || null, specialty || null, experienceNotes || null,
      positionId, departmentId, emailVerified, isActive, ever,
    ],
  );
  return result.insertId;
}

export async function update(id, fields) {
  const map = {
    fullName:         "FullName",
    email:            "Email",
    phone:            "Phone",
    positionId:       "PositionID",
    departmentId:     "DepartmentID",
    craftLevel:       "CraftLevel",
    specialty:        "Specialty",
    experienceNotes:  "ExperienceNotes",
  };
  const setClauses = [];
  const params = [];
  for (const [key, col] of Object.entries(map)) {
    if (fields[key] !== undefined) {
      setClauses.push(`${col} = ?`);
      params.push(fields[key] ?? null);
    }
  }
  if (setClauses.length === 0) return 0;
  params.push(id);
  const [result] = await getPool().query(
    `UPDATE Employees SET ${setClauses.join(", ")} WHERE EmployeeID = ?`,
    params,
  );
  return result.affectedRows;
}

export async function updatePhoto(id, photoPath) {
  const [result] = await getPool().query(
    "UPDATE Employees SET PhotoPath = ? WHERE EmployeeID = ?",
    [photoPath, id],
  );
  return result.affectedRows;
}

export async function setEmailVerified(id) {
  await getPool().query(
    "UPDATE Employees SET EmailVerified = TRUE WHERE EmployeeID = ?",
    [id],
  );
}

export async function updatePassword(id, passwordHash) {
  await getPool().query(
    "UPDATE Employees SET PasswordHash = ? WHERE EmployeeID = ?",
    [passwordHash, id],
  );
}

export async function findActiveEmployeeIdsByPositionId(positionId) {
  const [rows] = await getPool().query(
    `SELECT EmployeeID AS employeeId FROM Employees
     WHERE PositionID = ? AND IsActive = TRUE`,
    [positionId],
  );
  return rows.map((r) => Number(r.employeeId));
}

export async function findAllByLevel(minLevel) {
  const [rows] = await getPool().query(
    `SELECT e.EmployeeID AS employeeId, e.FullName AS fullName
     FROM Employees e
     JOIN Positions p ON p.PositionID = e.PositionID
     WHERE p.Level >= ? AND e.IsActive = TRUE`,
    [minLevel],
  );
  return rows;
}

export async function updateLeaveSchedule(employeeId, leaveStartAt, leaveEndAt) {
  await getPool().query(
    `UPDATE Employees SET LeaveStartAt = ?, LeaveEndAt = ? WHERE EmployeeID = ?`,
    [leaveStartAt, leaveEndAt, employeeId],
  );
}

export async function setActive(id, isActive) {
  if (isActive) {
    const [result] = await getPool().query(
      "UPDATE Employees SET IsActive = TRUE, WasEverActivated = TRUE WHERE EmployeeID = ?",
      [id],
    );
    return result.affectedRows;
  }
  const [result] = await getPool().query(
    "UPDATE Employees SET IsActive = FALSE WHERE EmployeeID = ?",
    [id],
  );
  return result.affectedRows;
}
