/**
 * auth.routes.js — /api/auth/* (public + protected).
 * function.rule: đăng nhập, verify Gmail, quên mật khẩu, refresh, logout. Không POST /register (chỉ Admin tạo user).
 * Liên quan: controllers/auth.controller.js, validators/auth.validator.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.validator.js';
import {
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  refresh,
  logout,
  getMe,
  changePassword,
} from '../controllers/auth.controller.js';

export const authRouter = Router();

authRouter.post('/login',           validate(loginSchema),           login);
authRouter.post('/verify-email',    validate(verifyEmailSchema),     verifyEmail);
authRouter.post('/forgot-password', validate(forgotPasswordSchema),  forgotPassword);
authRouter.post('/reset-password',  validate(resetPasswordSchema),   resetPassword);
authRouter.post('/refresh',                                          refresh);
authRouter.post('/logout',                                           logout);
authRouter.get('/me',                requireAuth,                     getMe);
authRouter.patch('/change-password', requireAuth,                     changePassword);
