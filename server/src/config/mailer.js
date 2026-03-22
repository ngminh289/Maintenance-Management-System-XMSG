/**
 * mailer.js — Transporter nodemailer (Gmail SMTP) — xác thực email & reset mật khẩu.
 * Cần SMTP_USER / SMTP_PASS (App Password) trong .env.
 */
import nodemailer from 'nodemailer';
import { env } from './env.js';

let transporter;

export function getMailer() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth:
        env.smtp.user && env.smtp.pass
          ? { user: env.smtp.user, pass: env.smtp.pass }
          : undefined,
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, html, text }) {
  const mail = getMailer();
  if (!env.smtp.user) {
    throw new Error('Chưa cấu hình SMTP_USER — không gửi được email.');
  }
  await mail.sendMail({
    from: `"Warehouse" <${env.smtp.user}>`,
    to,
    subject,
    text,
    html,
  });
}
