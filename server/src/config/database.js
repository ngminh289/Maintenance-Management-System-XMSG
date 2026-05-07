/**
 * database.js — Pool MySQL (mysql2/promise); dùng chung cho services/models.
 * QUAN TRỌNG: ép cột DATE trả về chuỗi YYYY-MM-DD để tránh lệch ngày do UTC khi JSON serialize.
 * TLS: TiDB Cloud Serverless yêu cầu DB_SSL=true (scripts/setup-db.js dùng cùng biến).
 */
import { existsSync, readFileSync } from 'fs';
import mysql from 'mysql2/promise';
import { env } from './env.js';

let pool;

function resolveSslConfig() {
  if (!env.db.sslEnabled) return undefined;

  const ssl = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: env.db.sslRejectUnauthorized,
  };

  const caRaw = env.db.sslCa;
  if (caRaw && String(caRaw).trim()) {
    const s = String(caRaw).trim();
    if (s.includes('BEGIN CERTIFICATE')) {
      ssl.ca = s;
    } else if (existsSync(s)) {
      ssl.ca = readFileSync(s, 'utf8');
    }
  }
  return ssl;
}

export function getPool() {
  if (!pool) {
    const ssl = resolveSslConfig();
    pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      ...(ssl ? { ssl } : {}),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      // DATE-only phải giữ nguyên "yyyy-mm-dd"; không convert sang JS Date (UTC shift -1 day).
      dateStrings: ['DATE'],
    });
  }
  return pool;
}
