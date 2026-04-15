/**
 * auth.service.js — Nghiệp vụ xác thực: bcrypt, JWT, cookie httpOnly, nodemailer.
 * function.rule: đăng nhập, verify Gmail, quên mật khẩu, refresh token. Tài khoản mới: Admin tạo qua employee API (không đăng ký công khai).
 * Dùng trong: controllers/auth.controller.js.
 */
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../config/jwt.js';
import { sendMail } from '../config/mailer.js';
import { env } from '../config/env.js';
import { createError } from '../utils/createError.js';
import * as employeeModel from '../models/employee.model.js';

const BCRYPT_ROUNDS = 12;

// Secret riêng cho verify/reset — tách khỏi access secret
const VERIFY_SECRET = `${env.jwt.accessSecret}-verify`;
const RESET_SECRET = `${env.jwt.accessSecret}-reset`;

function signVerifyToken(employeeId) {
  return jwt.sign({ sub: employeeId, type: 'verify_email' }, VERIFY_SECRET, { expiresIn: '24h' });
}

function signResetToken(employeeId) {
  return jwt.sign({ sub: employeeId, type: 'reset_password' }, RESET_SECRET, { expiresIn: '1h' });
}

function buildTokenPayload(emp) {
  return {
    sub: emp.employeeId,
    username: emp.username,
    positionId: emp.positionId,
    positionLevel: emp.positionLevel,
    departmentId: emp.departmentId,
  };
}

export async function verifyEmail(token) {
  let payload;
  try { payload = jwt.verify(token, VERIFY_SECRET); } catch {
    throw createError('Token xác thực không hợp lệ hoặc đã hết hạn', 400);
  }
  if (payload.type !== 'verify_email') throw createError('Token không đúng loại', 400);
  await employeeModel.setEmailVerified(payload.sub);
}

export async function login({ identifier, password }) {
  const emp = await employeeModel.findByUsernameOrEmail(identifier, identifier);
  // Lỗi chung để tránh enumeration attack
  const genericErr = createError('Thông tin đăng nhập không chính xác', 401);
  if (!emp) throw genericErr;
  if (!emp.emailVerified) {
    throw createError('Vui lòng xác thực email trước khi đăng nhập', 403);
  }
  if (!emp.isActive) {
    if (!emp.wasEverActivated) {
      throw createError(
        'Tài khoản đang chờ quản trị viên phê duyệt. Vui lòng liên hệ phòng nhân sự sau khi đã xác thực email.',
        403,
      );
    }
    throw createError('Tài khoản đã bị vô hiệu hóa', 403);
  }

  const match = await bcrypt.compare(password, emp.passwordHash);
  if (!match) throw genericErr;

  const accessToken = signAccessToken(buildTokenPayload(emp));
  const refreshToken = signRefreshToken({ sub: emp.employeeId });

  const { passwordHash, ...user } = emp;
  return { accessToken, refreshToken, user };
}

export async function forgotPassword(email) {
  const emp = await employeeModel.findByEmail(email);
  if (!emp) return; // Silent — không lộ email tồn tại

  const token = signResetToken(emp.employeeId);
  const link = `${env.appPublicUrl}/reset-password?token=${token}`;

  await sendMail({
    to: email,
    subject: 'Đặt lại mật khẩu Warehouse',
    html: `<p>Xin chào <b>${emp.fullName}</b>,</p>
           <p>Nhấn liên kết sau để đặt lại mật khẩu (hiệu lực 1 giờ):</p>
           <p><a href="${link}">${link}</a></p>
           <p>Bỏ qua nếu bạn không yêu cầu.</p>`,
    text: `Xin chào ${emp.fullName},\n\nLink đặt lại:\n${link}\n\nHiệu lực 1 giờ.`,
  });
}

export async function resetPassword({ token, newPassword }) {
  let payload;
  try { payload = jwt.verify(token, RESET_SECRET); } catch {
    throw createError('Token đặt lại không hợp lệ hoặc đã hết hạn', 400);
  }
  if (payload.type !== 'reset_password') throw createError('Token không đúng loại', 400);
  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await employeeModel.updatePassword(payload.sub, hash);
}

export async function refreshTokens(refreshToken) {
  if (!refreshToken) throw createError('Chưa đăng nhập', 401);
  let payload;
  try { payload = verifyRefreshToken(refreshToken); } catch {
    throw createError('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại', 401);
  }

  const emp = await employeeModel.findById(payload.sub);
  if (!emp || !emp.isActive) throw createError('Tài khoản không tồn tại hoặc đã bị khóa', 401);

  return { accessToken: signAccessToken(buildTokenPayload(emp)) };
}

export async function getMe(employeeId) {
  const emp = await employeeModel.findById(employeeId);
  if (!emp) throw createError('Không tìm thấy nhân viên', 404);
  return emp;
}
