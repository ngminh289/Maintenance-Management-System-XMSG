/**
 * orgUnits.js — Client: PositionID → DepartmentID (khớp server orgUnits + migration 040).
 * Form nhân viên: chọn chức vụ → tự điền phòng ban.
 * Migration 055: 7,9 → PKT; 8 → bảo trì (cùng quy tắc 040).
 */
export const DEPARTMENT_BAO_TRI = 1;
export const DEPARTMENT_KY_THUAT_CN = 2;
export const DEPARTMENT_BAN_GD = 3;

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
