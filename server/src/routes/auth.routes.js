/**
 * auth.routes.js — /api/auth/* (cookie httpOnly sẽ set trong controller khi có logic).
 */
import { Router } from 'express';
import {
  postForgotPassword,
  postLogin,
  postLogout,
  postRefresh,
  postRegister,
  postResetPassword,
  postVerifyEmail,
} from '../controllers/auth.controller.js';

export const authRouter = Router();

authRouter.post('/register', postRegister);
authRouter.post('/login', postLogin);
authRouter.post('/verify-email', postVerifyEmail);
authRouter.post('/forgot-password', postForgotPassword);
authRouter.post('/reset-password', postResetPassword);
authRouter.post('/refresh', postRefresh);
authRouter.post('/logout', postLogout);
