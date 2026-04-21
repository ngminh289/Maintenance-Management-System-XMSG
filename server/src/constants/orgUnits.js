/**
 * orgUnits.js — Ánh xạ chức vụ (PositionID) ↔ phòng ban cố định (3 phòng).
 * Phòng bảo trì (1): KTV, Trưởng ca, Trưởng/Phó phòng bảo trì (1,3,6,8).
 * Phòng kỹ thuật - công nghệ (2): CV KTS, Admin, Trưởng/Phó PKT (2,4,7,9).
 * Ban giám đốc (3): Giám đốc.
 * Dùng trong: employee.service.js; migration 040 + 055.
 */
export const DEPARTMENT_BAO_TRI = 1;
export const DEPARTMENT_KY_THUAT_CN = 2;
export const DEPARTMENT_BAN_GD = 3;

/** PositionID → DepartmentID */
const POSITION_TO_DEPARTMENT = {
  1: DEPARTMENT_BAO_TRI,
  2: DEPARTMENT_KY_THUAT_CN,
  3: DEPARTMENT_BAO_TRI,
  4: DEPARTMENT_KY_THUAT_CN,
  5: DEPARTMENT_BAN_GD,
  6: DEPARTMENT_BAO_TRI,
  7: DEPARTMENT_KY_THUAT_CN,
  8: DEPARTMENT_BAO_TRI,
  9: DEPARTMENT_KY_THUAT_CN,
};

export function departmentIdForPosition(positionId) {
  const id = Number(positionId);
  return POSITION_TO_DEPARTMENT[id] ?? null;
}
