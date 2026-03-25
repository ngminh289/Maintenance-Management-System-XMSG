/**
 * department.validator.js — Validate Departments CRUD.
 * Dùng trong: routes/department.routes.js.
 */
export function departmentSchema(body) {
  if (!body.departmentName?.trim()) return 'Tên phòng ban không được để trống';
  if (body.departmentName.length > 100) return 'Tên phòng ban tối đa 100 ký tự';
  return null;
}
