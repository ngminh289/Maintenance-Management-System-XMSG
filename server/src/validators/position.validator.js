/**
 * position.validator.js — Validate Positions CRUD.
 * Dùng trong: routes/position.routes.js.
 */
export function positionSchema(body) {
  const { positionName, level } = body;
  if (!positionName?.trim()) return 'Tên chức vụ không được để trống';
  if (positionName.length > 100) return 'Tên chức vụ tối đa 100 ký tự';
  if (level !== undefined && (isNaN(Number(level)) || ![1, 2, 3].includes(Number(level)))) {
    return 'Level chỉ được là 1 (Nhân viên), 2 (Trưởng nhóm), 3 (Quản lý)';
  }
  return null;
}
