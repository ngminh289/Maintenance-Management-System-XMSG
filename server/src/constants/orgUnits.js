/**
 * orgUnits.js — Ánh xạ chức vụ (PositionID) ↔ phòng ban cố định (3 phòng).
 * Phòng bảo trì (1): KTV hiện trường, Trưởng ca, Trưởng phòng.
 * Phòng kỹ thuật - công nghệ (2): Chuyên viên kỹ thuật số, Admin.
 * Ban giám đốc (3): Giám đốc.
 * Dùng trong: employee.service.js; đồng bộ với seed.sql + migration 040.
 */
export const DEPARTMENT_BAO_TRI = 1;
export const DEPARTMENT_KY_THUAT_CN = 2;
export const DEPARTMENT_BAN_GD = 3;

/** PositionID → DepartmentID (sau migration 040 / seed mới). */
const POSITION_TO_DEPARTMENT = {
  1: DEPARTMENT_BAO_TRI,
  2: DEPARTMENT_KY_THUAT_CN,
  3: DEPARTMENT_BAO_TRI,
  4: DEPARTMENT_KY_THUAT_CN,
  5: DEPARTMENT_BAN_GD,
  6: DEPARTMENT_BAO_TRI,
};

export function departmentIdForPosition(positionId) {
  const id = Number(positionId);
  return POSITION_TO_DEPARTMENT[id] ?? null;
}
