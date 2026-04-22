/**
 * employee.validator.js — Validate Employees CRUD.
 * Trường mở rộng: craftLevel (1–7), specialty, experienceNotes (migration 043).
 * Dùng trong: routes/employee.routes.js.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateCraftLevel = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 7) return 'Bậc thợ phải từ 1 đến 7';
  return null;
};

export function createEmployeeSchema(body) {
  const { fullName, username, email, password, positionId, departmentId, craftLevel } = body;
  if (!fullName?.trim()) return 'Họ tên không được để trống';
  if (!username?.trim() || username.length < 3) return 'Username phải có ít nhất 3 ký tự';
  if (!email?.trim() || !EMAIL_RE.test(email)) return 'Email không hợp lệ';
  if (!password || password.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự';
  if (!positionId || isNaN(Number(positionId))) return 'Chức vụ không hợp lệ';
  if (departmentId != null && departmentId !== '' && isNaN(Number(departmentId))) {
    return 'Phòng ban không hợp lệ';
  }
  const craftErr = validateCraftLevel(craftLevel);
  if (craftErr) return craftErr;
  return null;
}

export function updateEmployeeSchema(body) {
  const { fullName, email, positionId, departmentId, craftLevel } = body;
  if (fullName !== undefined && !fullName?.trim()) return 'Họ tên không được để trống';
  if (email    !== undefined && (!email?.trim() || !EMAIL_RE.test(email))) return 'Email không hợp lệ';
  if (positionId !== undefined && isNaN(Number(positionId))) return 'Chức vụ không hợp lệ';
  if (departmentId !== undefined && isNaN(Number(departmentId))) return 'Phòng ban không hợp lệ';
  const craftErr = validateCraftLevel(craftLevel);
  if (craftErr) return craftErr;
  return null;
}

export function changePasswordSchema(body) {
  const { currentPassword, newPassword } = body;
  if (!currentPassword) return 'Mật khẩu hiện tại không được để trống';
  if (!newPassword || newPassword.length < 8) return 'Mật khẩu mới phải có ít nhất 8 ký tự';
  return null;
}

/** PATCH leave-schedule: clear: true hoặc cặp leaveStartAt + leaveEndAt. */
export function leaveScheduleSchema(body) {
  const clear = body.clear === true || body.clear === 'true';
  if (clear) return null;
  const start = body.leaveStartAt;
  const end   = body.leaveEndAt;
  if (start == null || end == null || String(start).trim() === '' || String(end).trim() === '') {
    return 'Gửi leaveStartAt và leaveEndAt hoặc clear: true để xóa lịch nghỉ';
  }
  return null;
}
