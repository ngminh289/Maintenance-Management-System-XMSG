/**
 * auth.validator.js — Kiểm tra đầu vào cho các endpoint xác thực.
 * Dùng trong: routes/auth.routes.js (qua middleware/validate.js).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function registerSchema(body) {
  const { fullName, username, email, password, positionId, departmentId } = body;
  if (!fullName?.trim()) return 'Họ tên không được để trống';
  if (!username?.trim() || username.length < 3) return 'Username phải có ít nhất 3 ký tự';
  if (!email?.trim() || !EMAIL_RE.test(email)) return 'Email không hợp lệ';
  if (!password || password.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự';
  if (!positionId || isNaN(Number(positionId))) return 'Chức vụ không hợp lệ';
  if (!departmentId || isNaN(Number(departmentId))) return 'Phòng ban không hợp lệ';
  return null;
}

export function loginSchema(body) {
  const { identifier, password } = body;
  if (!identifier?.trim()) return 'Username hoặc email không được để trống';
  if (!password) return 'Mật khẩu không được để trống';
  return null;
}

export function verifyEmailSchema(body) {
  if (!body.token?.trim()) return 'Token xác thực không được để trống';
  return null;
}

export function forgotPasswordSchema(body) {
  if (!body.email?.trim() || !EMAIL_RE.test(body.email)) return 'Email không hợp lệ';
  return null;
}

export function resetPasswordSchema(body) {
  const { token, newPassword } = body;
  if (!token?.trim()) return 'Token không được để trống';
  if (!newPassword || newPassword.length < 8) return 'Mật khẩu mới phải có ít nhất 8 ký tự';
  return null;
}
