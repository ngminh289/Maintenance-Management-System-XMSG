/**
 * upload.js — Cấu hình multer cho:
 *   - uploadDocument : tài liệu kỹ thuật số (DigitalAssets) → uploads/documents/
 *   - uploadPhoto    : ảnh minh chứng checklist hiện trường → uploads/photos/
 *   - uploadWoPhotos : ảnh hiện trường WO (nhiều ảnh) → uploads/work-orders/
 * Dùng trong: routes/digitalAsset.routes.js, routes/checklist.routes.js.
 */
import multer from 'multer';
import { join, extname } from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Thư mục upload ─────────────────────────────────────────────────────────
export const UPLOAD_DIR       = join(__dirname, '..', '..', 'uploads', 'documents');
export const UPLOAD_PHOTO_DIR = join(__dirname, '..', '..', 'uploads', 'photos');
export const UPLOAD_WO_DIR    = join(__dirname, '..', '..', 'uploads', 'work-orders');
mkdirSync(UPLOAD_DIR,       { recursive: true });
mkdirSync(UPLOAD_PHOTO_DIR, { recursive: true });
mkdirSync(UPLOAD_WO_DIR,    { recursive: true });

// ── Helper tên file ────────────────────────────────────────────────────────
const uniqueName = (file) => {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${uid}${extname(file.originalname).toLowerCase()}`;
};

// ── uploadDocument (PDF, Word, Excel, ảnh, DWG, ZIP ≤50 MB) ──────────────
const DOC_EXT = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.png', '.jpg', '.jpeg', '.dwg', '.zip']);
const docStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => cb(null, uniqueName(file)),
});
export const uploadDocument = multer({
  storage:    docStorage,
  limits:     { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    DOC_EXT.has(extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(Object.assign(new Error('Định dạng file không được phép'), { status: 400 }));
  },
});

// ── uploadPhoto (ảnh minh chứng checklist: JPG/PNG/WEBP ≤10 MB) ──────────
const PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_PHOTO_DIR),
  filename:    (_req, file, cb) => cb(null, uniqueName(file)),
});
export const uploadPhoto = multer({
  storage:    photoStorage,
  limits:     { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    PHOTO_EXT.has(extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(Object.assign(new Error('Chỉ hỗ trợ ảnh JPG/PNG/WEBP'), { status: 400 }));
  },
});

const woPhotoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_WO_DIR),
  filename:    (_req, file, cb) => cb(null, uniqueName(file)),
});
/** Nhiều ảnh / lần — phiếu công việc hiện trường */
export const uploadWoPhotos = multer({
  storage:    woPhotoStorage,
  limits:     { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    PHOTO_EXT.has(extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(Object.assign(new Error('Chỉ hỗ trợ ảnh JPG/PNG/WEBP'), { status: 400 }));
  },
});
