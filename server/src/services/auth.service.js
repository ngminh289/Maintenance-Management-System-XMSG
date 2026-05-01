/**
 * auth.service.js — Nghiệp vụ xác thực: bcrypt, JWT, cookie httpOnly, nodemailer.
 * function.rule: đăng nhập, verify Gmail, quên mật khẩu, refresh token. Tài khoản mới: Admin tạo qua employee API (không đăng ký công khai).
 * Dùng trong: controllers/auth.controller.js.
 * getMe (Level 1–2): thêm fieldWorkSummary — rảnh/bận/nghỉ phép + phiếu đang gánh (Dashboard hiện trường).
 */
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../config/jwt.js';
import { sendMail } from '../config/mailer.js';
import { env } from '../config/env.js';
import { createError } from '../utils/createError.js';
import * as employeeModel from '../models/employee.model.js';
import * as workOrderModel from '../models/workOrder.model.js';
import * as permissionModel from '../models/permission.model.js';

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

function isAwaitingUrgentRow(wo) {
  if (!wo || wo.status !== 'AWAITING_CLOSURE') return false;
  if (wo.priority === 'EMERGENCY') return true;
  if (String(wo.woSource) === 'CORRECTIVE' && wo.priority === 'HIGH') return true;
  return false;
}

function slimWoRow(r) {
  return {
    woId: r.woId,
    status: r.status,
    priority: r.priority,
    woSource: r.woSource,
    plannedDate: r.plannedDate,
    assetName: r.assetName,
    locationName: r.locationName,
  };
}

/** Tóm tắt cho KTV hiện trường / NV KT (dashboard) — khớp quy tắc chặn đa phiếu ở workOrder.service. */
function buildFieldWorkSummary(emp, rows) {
  const list = Array.isArray(rows) ? rows : [];
  const onLeave = Boolean(emp.onScheduledLeave);
  if (onLeave) {
    return {
      availability: 'ON_LEAVE',
      leaveStartAt: emp.leaveStartAt,
      leaveEndAt: emp.leaveEndAt,
      headline: 'Đang nghỉ phép có lịch',
      detail:
        'Không thể bắt đầu thực hiện phiếu mới trong khoảng thời gian này.',
      activeWorkOrder: null,
      openWorkOrders: list.map(slimWoRow),
    };
  }
  const inPro = list.find((r) => r.status === 'IN_PROGRESS');
  const paused = list.find((r) => r.status === 'PAUSED');
  const urgentAwait = list.filter(isAwaitingUrgentRow);
  const normalAwait = list.filter(
    (r) => r.status === 'AWAITING_CLOSURE' && !isAwaitingUrgentRow(r),
  );
  const waiting = list.filter((r) => r.status === 'WAITING');

  if (inPro) {
    return {
      availability: 'BUSY_ON_SITE',
      headline: 'Đang thực hiện tại hiện trường',
      detail:
        'Không mở thêm phiếu thực hiện khác cho đến khi hoàn tất, báo chờ nghiệm thu hoặc tạm dừng.',
      activeWorkOrder: slimWoRow(inPro),
      openWorkOrders: list.map(slimWoRow),
    };
  }
  if (paused) {
    return {
      availability: 'BUSY_PAUSED',
      headline: 'Phiếu đang tạm dừng',
      detail:
        'Tiếp tục khi sẵn sàng; không bắt đầu thêm phiếu thực hiện khác.',
      activeWorkOrder: slimWoRow(paused),
      openWorkOrders: list.map(slimWoRow),
    };
  }
  if (urgentAwait.length) {
    return {
      availability: 'BUSY_AWAITING_REVIEW',
      headline: 'Chờ nghiệm thu (phiếu khẩn / sự cố nặng)',
      detail:
        'Chưa nhận phiếu thực hiện mới cho đến khi Trưởng ca / Trưởng phòng nghiệm thu xong.',
      activeWorkOrder: slimWoRow(urgentAwait[0]),
      openWorkOrders: list.map(slimWoRow),
    };
  }
  if (normalAwait.length) {
    return {
      availability: 'AWAITING_NON_URGENT',
      headline: 'Đã báo xong — chờ nghiệm thu (phiếu thường)',
      detail:
        'Có thể nhận phiếu thực hiện khác nếu được phân công (máy có thể đã AVAILABLE).',
      primaryAwaiting: slimWoRow(normalAwait[0]),
      activeWorkOrder: null,
      openWorkOrders: list.map(slimWoRow),
    };
  }
  const nWait = waiting.length;
  if (nWait > 0) {
    return {
      availability: 'ASSIGNED_IDLE',
      headline: `Rảnh — ${nWait} phiếu chờ bắt đầu`,
      detail: 'Chưa có phiếu đang thực hiện.',
      activeWorkOrder: null,
      openWorkOrders: list.map(slimWoRow),
    };
  }
  return {
    availability: 'IDLE',
    headline: 'Đang rảnh',
    detail: 'Không có phiếu việc mở được giao cho bạn.',
    activeWorkOrder: null,
    openWorkOrders: [],
  };
}

export async function getMe(employeeId) {
  const emp = await employeeModel.findById(employeeId);
  if (!emp) throw createError('Không tìm thấy nhân viên', 404);
  const rolePermissions = await permissionModel.findAll(Number(emp.positionId));
  emp.permissions = rolePermissions.map((p) => ({
    permissionId: Number(p.permissionId),
    resourceType: String(p.resourceType || '').toUpperCase(),
    permissionName: String(p.permissionName || '').toUpperCase(),
  }));
  const lvl = Number(emp.positionLevel) || 0;
  if (lvl >= 1 && lvl <= 2) {
    const rows = await workOrderModel.findOpenAssignmentsForEmployee(employeeId);
    emp.fieldWorkSummary = buildFieldWorkSummary(emp, rows);
  }
  return emp;
}
