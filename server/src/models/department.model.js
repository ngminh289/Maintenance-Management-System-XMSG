/**
 * department.model.js — SQL thuần cho bảng Departments.
 * Không chứa business logic — chỉ truy vấn DB.
 * Dùng trong: services/department.service.js.
 */
import { getPool } from '../config/database.js';

const COLS = `DepartmentID AS departmentId, DepartmentName AS departmentName, Description AS description`;

export async function findAll() {
  const [rows] = await getPool().query(
    `SELECT ${COLS} FROM Departments ORDER BY DepartmentName`,
  );
  return rows;
}

export async function findById(id) {
  const [rows] = await getPool().query(
    `SELECT ${COLS} FROM Departments WHERE DepartmentID = ?`,
    [id],
  );
  return rows[0] || null;
}

export async function findByName(name) {
  const [rows] = await getPool().query(
    'SELECT DepartmentID AS departmentId FROM Departments WHERE DepartmentName = ?',
    [name],
  );
  return rows[0] || null;
}

export async function create({ departmentName, description }) {
  const [result] = await getPool().query(
    'INSERT INTO Departments (DepartmentName, Description) VALUES (?, ?)',
    [departmentName, description || null],
  );
  return result.insertId;
}

export async function update(id, { departmentName, description }) {
  const [result] = await getPool().query(
    'UPDATE Departments SET DepartmentName = ?, Description = ? WHERE DepartmentID = ?',
    [departmentName, description || null, id],
  );
  return result.affectedRows;
}

export async function remove(id) {
  const [result] = await getPool().query(
    'DELETE FROM Departments WHERE DepartmentID = ?',
    [id],
  );
  return result.affectedRows;
}

export async function countEmployees(departmentId) {
  const [rows] = await getPool().query(
    'SELECT COUNT(*) AS cnt FROM Employees WHERE DepartmentID = ?',
    [departmentId],
  );
  return Number(rows[0].cnt);
}
