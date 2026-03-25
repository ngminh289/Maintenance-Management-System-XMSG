/**
 * employee.validator.js — Validate Employees CRUD.
 * Dùng trong: routes/employee.routes.js.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createEmployeeSchema(body) {
  const { fullName, username, email, password, positionId, departmentId } = body;
  if (!fullName?.trim()) return 'Họ tên không được để trống';
  if (!username?.trim() || username.length < 3) return 'Username phải có ít nhất 3 ký tự';
  if (!email?.trim() || !EMAIL_RE.test(email)) return 'Email không hợp lệ';
  if (!password || password.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự';
  if (!positionId || isNaN(Number(positionId))) return 'Chức vụ không hợp lệ';
  if (!departmentId || isNaN(Number(departmentId))) return 'Phòng ban không hợp lệ';
  return null;
}

export function updateEmployeeSchema(body) {
  const { fullName, email, positionId, departmentId } = body;
  if (fullName !== undefined && !fullName?.trim()) return 'Họ tên không được để trống';
  if (email !== undefined && (!email?.trim() || !EMAIL_RE.test(email))) return 'Email không hợp lệ';
  if (positionId !== undefined && isNaN(Number(positionId))) return 'Chức vụ không hợp lệ';
  if (departmentId !== undefined && isNaN(Number(departmentId))) return 'Phòng ban không hợp lệ';
  return null;
}

export function changePasswordSchema(body) {
  const { currentPassword, newPassword } = body;
  if (!currentPassword) return 'Mật khẩu hiện tại không được để trống';
  if (!newPassword || newPassword.length < 8) return 'Mật khẩu mới phải có ít nhất 8 ký tự';
  return null;
}
