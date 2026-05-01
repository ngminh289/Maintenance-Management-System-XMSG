/**
 * database.js — Pool MySQL (mysql2/promise); dùng chung cho services/models.
 * QUAN TRỌNG: ép cột DATE trả về chuỗi YYYY-MM-DD để tránh lệch ngày do UTC khi JSON serialize.
 */
import mysql from 'mysql2/promise';
import { env } from './env.js';

let pool;

function resolveSslConfig() {
  if (!env.db.sslEnabled) return undefined;

  const ssl = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: env.db.sslRejectUnauthorized,
  };

  if (env.db.sslCa) ssl.ca = env.db.sslCa;
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
