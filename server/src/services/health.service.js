/**
 * health.service.js — Logic kiểm tra DB (không viết SQL trong controller).
 */
import { getPool } from '../config/database.js';

export async function healthCheck() {
  const pool = getPool();
  const [rows] = await pool.query('SELECT 1 AS ok');
  return {
    status: 'ok',
    database: rows?.[0]?.ok === 1 ? 'connected' : 'unknown',
    time: new Date().toISOString(),
  };
}
