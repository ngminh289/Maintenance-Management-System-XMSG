/**
 * migrate-uploads-to-cloudinary.js — Một lần: đọc file local dưới server/uploads, đẩy lên Cloudinary, UPDATE DB.
 * Cần: CLOUDINARY_* trong .env, migration 067 (cột đủ dài). Chạy: node scripts/migrate-uploads-to-cloudinary.js [--dry-run]
 * Bảng: DigitalAssets, AssetVersions, WorkOrderPhotos, AssetPhotos, Employees, ChecklistResults, ChecklistDetails (PHOTO).
 */
import 'dotenv/config';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { getPool } from '../src/config/database.js';
import {
  isCloudinaryEnabled,
  uploadBufferToCloudinary,
} from '../src/config/cloudinary.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = join(__dirname, '..');

const DRY = process.argv.includes('--dry-run');

const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

/** Lọc đường dẫn local (cột FilePath). */
const FILTER_LOCAL_FILEPATH = `
  AND FilePath IS NOT NULL AND TRIM(FilePath) <> ''
  AND FilePath NOT LIKE 'http%'
`;

function absFromStored(stored) {
  if (stored == null || stored === '') return null;
  const s = String(stored).replace(/\\/g, '/').trim();
  if (/^https?:\/\//i.test(s)) return null;
  if (s.startsWith('uploads/')) {
    return join(SERVER_ROOT, ...s.split('/').filter(Boolean));
  }
  if (!s.includes('/')) {
    return join(SERVER_ROOT, 'uploads', 'documents', s);
  }
  return null;
}

function folderForStored(stored) {
  const s = String(stored).replace(/\\/g, '/');
  const m = s.match(/uploads\/([^/]+)\//);
  const sub = m ? m[1] : 'documents';
  const map = {
    'work-orders': 'warehouse/work-orders',
    assets: 'warehouse/assets',
    employees: 'warehouse/employees',
    photos: 'warehouse/checklist-photos',
    documents: 'warehouse/documents',
  };
  return map[sub] || 'warehouse/migrate-misc';
}

function resourceTypeForAbs(abs) {
  const e = extname(abs).toLowerCase();
  return IMG_EXT.has(e) ? 'image' : 'raw';
}

async function uploadOne(abs, storedHint) {
  const buf = await readFile(abs);
  const rt = resourceTypeForAbs(abs);
  const folder = folderForStored(storedHint);
  const opts = {
    folder,
    resource_type: rt,
    originalFilename: rt === 'raw' ? basename(abs) : undefined,
  };
  const result = await uploadBufferToCloudinary(buf, opts);
  return result.secure_url;
}

async function processPathValue(pool, label, idCol, id, oldPath, updateSql) {
  const abs = absFromStored(oldPath);
  if (!abs || !existsSync(abs)) {
    console.warn(`[${label}] bỏ qua (không có file): ${idCol}=${id} path=${oldPath}`);
    return 'skip';
  }
  try {
    const url = await uploadOne(abs, oldPath);
    if (DRY) {
      console.log(`[DRY] ${label} ${idCol}=${id} → ${url}`);
      return 'ok';
    }
    await pool.query(updateSql, [url, id]);
    console.log(`[${label}] ${idCol}=${id} đã cập nhật`);
    return 'ok';
  } catch (e) {
    console.error(`[${label}] lỗi ${idCol}=${id}:`, e.message || e);
    return 'err';
  }
}

async function main() {
  if (!isCloudinaryEnabled()) {
    console.error('Thiếu CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.');
    process.exit(1);
  }

  const pool = getPool();
  let migrated = 0;
  let skipped = 0;

  const runTable = async (name, sql, handler) => {
    const [rows] = await pool.query(sql);
    console.log(`\n── ${name}: ${rows.length} dòng (local) ──`);
    for (const row of rows) {
      const r = await handler(row);
      if (r === 'ok') migrated += 1;
      else skipped += 1;
    }
  };

  await runTable(
    'DigitalAssets',
    `SELECT DigitalAssetID AS id, FilePath AS p FROM DigitalAssets WHERE 1=1 ${FILTER_LOCAL_FILEPATH}`,
    (row) =>
      processPathValue(
        pool,
        'DigitalAssets',
        'DigitalAssetID',
        row.id,
        row.p,
        'UPDATE DigitalAssets SET FilePath = ? WHERE DigitalAssetID = ?',
      ),
  );

  await runTable(
    'AssetVersions',
    `SELECT VersionID AS id, FilePath AS p FROM AssetVersions WHERE 1=1 ${FILTER_LOCAL_FILEPATH}`,
    (row) =>
      processPathValue(
        pool,
        'AssetVersions',
        'VersionID',
        row.id,
        row.p,
        'UPDATE AssetVersions SET FilePath = ? WHERE VersionID = ?',
      ),
  );

  await runTable(
    'WorkOrderPhotos',
    `SELECT PhotoID AS id, FilePath AS p FROM WorkOrderPhotos WHERE 1=1 ${FILTER_LOCAL_FILEPATH}`,
    (row) =>
      processPathValue(
        pool,
        'WorkOrderPhotos',
        'PhotoID',
        row.id,
        row.p,
        'UPDATE WorkOrderPhotos SET FilePath = ? WHERE PhotoID = ?',
      ),
  );

  await runTable(
    'AssetPhotos',
    `SELECT PhotoID AS id, FilePath AS p FROM AssetPhotos WHERE 1=1 ${FILTER_LOCAL_FILEPATH}`,
    (row) =>
      processPathValue(
        pool,
        'AssetPhotos',
        'PhotoID',
        row.id,
        row.p,
        'UPDATE AssetPhotos SET FilePath = ? WHERE PhotoID = ?',
      ),
  );

  await runTable(
    'Employees',
    `SELECT EmployeeID AS id, PhotoPath AS p FROM Employees 
     WHERE PhotoPath IS NOT NULL AND TRIM(PhotoPath) <> ''
     AND PhotoPath NOT LIKE 'http%'`,
    (row) =>
      processPathValue(
        pool,
        'Employees',
        'EmployeeID',
        row.id,
        row.p,
        'UPDATE Employees SET PhotoPath = ? WHERE EmployeeID = ?',
      ),
  );

  await runTable(
    'ChecklistResults',
    `SELECT ChecklistID AS id, EvidencePhoto AS p FROM ChecklistResults 
     WHERE EvidencePhoto IS NOT NULL AND TRIM(EvidencePhoto) <> ''
     AND EvidencePhoto NOT LIKE 'http%'`,
    (row) =>
      processPathValue(
        pool,
        'ChecklistResults',
        'ChecklistID',
        row.id,
        row.p,
        'UPDATE ChecklistResults SET EvidencePhoto = ? WHERE ChecklistID = ?',
      ),
  );

  await runTable(
    'ChecklistDetails',
    `SELECT DetailID AS id, AnswerValue AS p FROM ChecklistDetails 
     WHERE InputType = 'PHOTO'
     AND AnswerValue IS NOT NULL AND TRIM(AnswerValue) <> ''
     AND AnswerValue NOT LIKE 'http%'`,
    (row) =>
      processPathValue(
        pool,
        'ChecklistDetails',
        'DetailID',
        row.id,
        row.p,
        'UPDATE ChecklistDetails SET AnswerValue = ? WHERE DetailID = ?',
      ),
  );

  console.log(`\nXong. Đã xử lý thành công: ${migrated}, bỏ qua/lỗi: ${skipped}. ${DRY ? '(dry-run — không ghi DB)' : ''}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
