/**
 * env.js — Đọc biến môi trường (.env); giá trị mặc định an toàn cho dev.
 */
import 'dotenv/config';

function required(name, fallback = undefined) {
  const v = process.env[name];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Thiếu biến môi trường: ${name}`);
  }
  return v;
}

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseOrigins(value, fallback) {
  const raw = value ?? fallback;
  return String(raw)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => v.replace(/\/+$/, ''));
}

function resolveSameSite(nodeEnv, explicitValue) {
  const normalized = String(explicitValue || '').trim().toLowerCase();
  if (['lax', 'strict', 'none'].includes(normalized)) return normalized;
  return nodeEnv === 'production' ? 'none' : 'lax';
}

export const env = {
  nodeEnv: String(process.env.NODE_ENV || 'development').trim().toLowerCase(),
  port: Number(process.env.PORT) || 4000,
  clientOrigins: parseOrigins(process.env.CLIENT_ORIGIN, 'http://localhost:5173'),

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: required('DB_USER', 'root'),
    password: process.env.DB_PASSWORD ?? '',
    database: required('DB_NAME', 'warehouse_maintenance'),
    sslEnabled: toBool(process.env.DB_SSL, false),
    sslRejectUnauthorized: toBool(process.env.DB_SSL_REJECT_UNAUTHORIZED, true),
    sslCa: process.env.DB_SSL_CA || '',
  },

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },

  /** Cloudinary (tuỳ chọn): đủ 3 biến → upload memory + URL trong DB; thiếu → lưu đĩa uploads/ */
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    maxRawMb: Number(process.env.CLOUDINARY_MAX_RAW_MB) || null,
  },

  appPublicUrl: process.env.APP_PUBLIC_URL || 'http://localhost:5173',
  cookie: {
    sameSite: resolveSameSite(process.env.NODE_ENV || 'development', process.env.COOKIE_SAME_SITE),
  },
};
