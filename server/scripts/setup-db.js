/**
 * setup-db.js — Script tự động tạo DB, schema, seed, và tài khoản admin.
 * Chạy: npm run db:setup (từ thư mục server/)
 * Yêu cầu: file .env đã cấu hình DB_* và ADMIN_PASSWORD (tuỳ chọn).
 * TiDB Cloud Serverless: bắt buộc TLS — đặt DB_SSL=true (và tuỳ chọn DB_SSL_CA, giống src/config/database.js).
 *
 * Thứ tự thực hiện:
 *   1. Kết nối MySQL (không cần DB trước)
 *   2. Chạy sql/schema.sql  → tạo DB + tất cả bảng (IF NOT EXISTS)
 *   3. Chạy sql/seed.sql    → dữ liệu khởi tạo (INSERT IGNORE)
 *   4. Tạo tài khoản admin  → bcrypt hash mật khẩu
 *   5. In tóm tắt
 */
import 'dotenv/config';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import mysql  from 'mysql2/promise';
import bcrypt from 'bcrypt';

const __dir = dirname(fileURLToPath(import.meta.url));
const sqlDir = join(__dir, '../sql');

const BCRYPT_ROUNDS   = 12;
const ADMIN_USERNAME  = 'admin';
const ADMIN_EMAIL     = 'admin@warehouse.local';
const ADMIN_FULLNAME  = 'Admin Hệ thống';
const ADMIN_PASSWORD  = process.env.ADMIN_PASSWORD || 'Warehouse@Admin123';
const DB_NAME         = process.env.DB_NAME || 'warehouse_maintenance';

function log(msg)  { console.log(`  ✓ ${msg}`); }
function warn(msg) { console.warn(`  ⚠ ${msg}`); }
function err(msg)  { console.error(`  ✗ ${msg}`); }

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

/** Giống server/src/config/database.js — mysql2 cần ssl khi DB yêu cầu (vd. TiDB Cloud Serverless). */
function resolveMysqlSsl() {
  if (!toBool(process.env.DB_SSL, false)) return undefined;

  const ssl = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: toBool(process.env.DB_SSL_REJECT_UNAUTHORIZED, true),
  };

  const caRaw = process.env.DB_SSL_CA;
  if (caRaw && String(caRaw).trim()) {
    const s = String(caRaw).trim();
    if (s.includes('BEGIN CERTIFICATE')) {
      ssl.ca = s;
    } else if (existsSync(s)) {
      ssl.ca = readFileSync(s, 'utf8');
    } else {
      warn(`DB_SSL_CA không phải đường dẫn hợp lệ hoặc PEM — bỏ qua CA (có thể lỗi verify chứng chỉ).`);
    }
  }

  return ssl;
}

async function execFile(conn, filename) {
  const sql = readFileSync(join(sqlDir, filename), 'utf8');
  await conn.query(sql);
}

async function run() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Warehouse — Database Setup');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 1. Kết nối MySQL (không chỉ định database)
  const ssl = resolveMysqlSsl();
  const conn = await mysql.createConnection({
    host:               process.env.DB_HOST     || '127.0.0.1',
    port:               Number(process.env.DB_PORT) || 3306,
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || '',
    multipleStatements: true,
    charset:            'utf8mb4',
    ...(ssl ? { ssl } : {}),
  });
  log(`Kết nối MySQL: ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}${ssl ? ' (TLS)' : ''}`);

  try {
    // 2. Schema (tạo DB + bảng IF NOT EXISTS)
    await execFile(conn, 'schema.sql');
    log('schema.sql: DB và tất cả bảng đã sẵn sàng');

    // 2b. Chạy migrations tự động (theo thứ tự tên file)
    await conn.query(
      `CREATE TABLE IF NOT EXISTS ${DB_NAME}._migrations (
         id       VARCHAR(100) PRIMARY KEY,
         ran_at   DATETIME DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB;`,
    );
    const migDir = join(sqlDir, 'migrations');
    const migFiles = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of migFiles) {
      const [[already]] = await conn.query(
        `SELECT id FROM ${DB_NAME}._migrations WHERE id = ?`, [file],
      );
      if (already) { log(`Migration ${file}: đã chạy — bỏ qua`); continue; }
      try {
        const sql = readFileSync(join(migDir, file), 'utf8');
        await conn.query(sql);
        await conn.query(`INSERT INTO ${DB_NAME}._migrations (id) VALUES (?)`, [file]);
        log(`Migration ${file}: OK`);
      } catch (e) {
        warn(`Migration ${file}: ${e.message}`);
      }
    }

    // 3. Seed data
    try {
      await execFile(conn, 'seed.sql');
      log('seed.sql: Dữ liệu khởi tạo đã nhập');
    } catch (e) {
      warn(`seed.sql có cảnh báo (không nghiêm trọng): ${e.message}`);
    }

    // 4. Kiểm tra / tạo admin
    const [existing] = await conn.query(
      `SELECT EmployeeID FROM ${DB_NAME}.Employees WHERE Username = ? LIMIT 1`,
      [ADMIN_USERNAME],
    );

    if (existing.length > 0) {
      warn(`Tài khoản '${ADMIN_USERNAME}' đã tồn tại — bỏ qua.`);
    } else {
      // Lấy PositionID Quản trị viên (Level 4) và DepartmentID đầu tiên
      const [[posRow]] = await conn.query(
        `SELECT PositionID FROM ${DB_NAME}.Positions WHERE Level = 4 LIMIT 1`,
      );
      /** Admin thuộc Phòng kỹ thuật - công nghệ (DepartmentID = 2 — orgUnits / migration 040). */
      const ADMIN_DEPARTMENT_ID = 2;

      if (!posRow) {
        warn('Không tìm thấy Position Admin (Level 4) — seed chưa chạy?');
      } else {
        const hash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
        await conn.query(
          `INSERT INTO ${DB_NAME}.Employees
           (FullName, Username, PasswordHash, Email, EmailVerified, IsActive, PositionID, DepartmentID)
           VALUES (?, ?, ?, ?, TRUE, TRUE, ?, ?)`,
          [ADMIN_FULLNAME, ADMIN_USERNAME, hash, ADMIN_EMAIL, posRow.PositionID, ADMIN_DEPARTMENT_ID],
        );
        log(`Admin tạo thành công: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
      }
    }

    // 5. Thống kê bảng
    const [tables] = await conn.query(
      `SELECT TABLE_NAME, TABLE_ROWS
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
      [DB_NAME],
    );
    console.log(`\n  Bảng trong DB (${DB_NAME}):`);
    tables.forEach(({ TABLE_NAME, TABLE_ROWS }) => {
      console.log(`    ${TABLE_NAME.padEnd(30)} ${TABLE_ROWS ?? 0} rows`);
    });

  } finally {
    await conn.end();
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Setup hoàn tất!');
  console.log(`  API: npm run dev  →  http://localhost:${process.env.PORT || 4000}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

run().catch((e) => {
  err(e.message);
  console.error(e);
  process.exit(1);
});
