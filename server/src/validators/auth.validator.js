/**
 * auth.validator.js — Kiểm tra đầu vào cho các endpoint xác thực.
 * Dùng trong: routes/auth.routes.js (qua middleware/validate.js).
 * Không còn schema đăng ký công khai — chỉ Admin tạo nhân viên.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function loginSchema(body) {
  // Chấp nhận cả ba field: identifier, email, username
  const identifier = body.identifier || body.email || body.username;
  if (!identifier?.trim()) return 'Username hoặc email không được để trống';
  if (!body.password) return 'Mật khẩu không được để trống';
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
