/**
 * auth.controller.js — Đăng nhập, xác thực Gmail, refresh, quên mật khẩu (skeleton).
 * Triển khai đầy đủ: Employees + verify token lưu DB + nodemailer.
 */
import { authStub } from '../services/auth.service.js';
import { fail } from '../utils/response.js';

export async function postRegister(req, res) {
  const out = await authStub('register');
  return fail(res, out.message, 501);
}

export async function postLogin(req, res) {
  const out = await authStub('login');
  return fail(res, out.message, 501);
}

export async function postVerifyEmail(req, res) {
  const out = await authStub('verifyEmail');
  return fail(res, out.message, 501);
}

export async function postForgotPassword(req, res) {
  const out = await authStub('forgotPassword');
  return fail(res, out.message, 501);
}

export async function postResetPassword(req, res) {
  const out = await authStub('resetPassword');
  return fail(res, out.message, 501);
}

export async function postRefresh(req, res) {
  const out = await authStub('refresh');
  return fail(res, out.message, 501);
}

export async function postLogout(req, res) {
  const out = await authStub('logout');
  return fail(res, out.message, 501);
}
