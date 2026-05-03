/**
 * upload.js — Cấu hình multer:
 *   - Khi có CLOUDINARY_* đầy đủ: memory + upload Cloudinary (middleware riêng).
 *   - Ngược lại: disk như cũ (dev/local).
 * Thư mục disk: uploads/documents|photos|work-orders|assets|employees
 * Chuẩn DB: Cloudinary lưu secure_url; local lưu uploads/... hoặc basename (tài liệu).
 * QUAN TRỌNG: dotenv phải chạy trước khi đọc isCloudinaryEnabled() (tránh load module sớm → mãi dùng disk).
 */
import 'dotenv/config';
import multer from 'multer';
import { join, extname } from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { isCloudinaryEnabled } from './cloudinary.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const SERVER_UPLOAD_ROOT = join(__dirname, '..', '..');

export const UPLOAD_DIR = join(SERVER_UPLOAD_ROOT, 'uploads', 'documents');
export const UPLOAD_PHOTO_DIR = join(SERVER_UPLOAD_ROOT, 'uploads', 'photos');
export const UPLOAD_WO_DIR = join(SERVER_UPLOAD_ROOT, 'uploads', 'work-orders');
export const UPLOAD_ASSET_DIR = join(SERVER_UPLOAD_ROOT, 'uploads', 'assets');
export const UPLOAD_EMPLOYEE_DIR = join(SERVER_UPLOAD_ROOT, 'uploads', 'employees');

if (!isCloudinaryEnabled()) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
  mkdirSync(UPLOAD_PHOTO_DIR, { recursive: true });
  mkdirSync(UPLOAD_WO_DIR, { recursive: true });
  mkdirSync(UPLOAD_ASSET_DIR, { recursive: true });
  mkdirSync(UPLOAD_EMPLOYEE_DIR, { recursive: true });
}

/** Giới hạn tài liệu raw trên Cloudinary Free ~10MB — có thể override CLOUDINARY_MAX_RAW_MB */
function maxDocumentBytes() {
  if (!isCloudinaryEnabled()) return 50 * 1024 * 1024;
  const mb = Number(process.env.CLOUDINARY_MAX_RAW_MB);
  const cap = Number.isFinite(mb) && mb > 0 ? mb : 10;
  return Math.min(cap, 50) * 1024 * 1024;
}

/**
 * Chuẩn hoá giá trị FilePath tài liệu để tra cứu / basename.
 * Hỗ trợ URL Cloudinary (lấy segment cuối).
 */
export function documentStoredBasename(stored) {
  if (stored == null || stored === '') return '';
  const norm = String(stored).replace(/\\/g, '/');
  if (/^https?:\/\//i.test(norm)) {
    try {
      const u = new URL(norm);
      const seg = u.pathname.split('/').filter(Boolean);
      const last = seg.length ? seg[seg.length - 1] : '';
      return last.split('?')[0] || '';
    } catch {
      return '';
    }
  }
  const parts = norm.split('/').filter((p) => p.length > 0);
  return parts[parts.length - 1] ?? '';
}

/** Đường dẫn tuyệt đối file local uploads/... */
export function resolveLocalUploadAbsolutePath(stored) {
  const s = String(stored || '').replace(/\\/g, '/').trim();
  if (!s || /^https?:\/\//i.test(s)) return null;
  const parts = s.split('/').filter(Boolean);
  if (parts[0] !== 'uploads') return null;
  return join(SERVER_UPLOAD_ROOT, ...parts);
}

/** Chỉ dùng cho tài liệu DAM trên đĩa */
export function resolveDocumentAbsolutePath(stored) {
  const name = documentStoredBasename(stored);
  if (!name) return null;
  if (/^https?:\/\//i.test(String(stored))) return null;
  return join(UPLOAD_DIR, name);
}

const uniqueName = (file) => {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${uid}${extname(file.originalname).toLowerCase()}`;
};

const DOC_EXT = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.ppt', '.pptx',
  '.png', '.jpg', '.jpeg', '.mp4', '.dwg', '.zip',
]);
const PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const diskDocStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, uniqueName(file)),
});

const diskPhotoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_PHOTO_DIR),
  filename: (_req, file, cb) => cb(null, uniqueName(file)),
});

const diskWoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_WO_DIR),
  filename: (_req, file, cb) => cb(null, uniqueName(file)),
});

const diskAssetStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_ASSET_DIR),
  filename: (_req, file, cb) => cb(null, uniqueName(file)),
});

const diskEmpStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_EMPLOYEE_DIR),
  filename: (_req, file, cb) => cb(null, uniqueName(file)),
});

const mem = multer.memoryStorage();

export const uploadDocument = multer({
  storage: isCloudinaryEnabled() ? mem : diskDocStorage,
  limits: { fileSize: maxDocumentBytes() },
  fileFilter: (_req, file, cb) => {
    DOC_EXT.has(extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(Object.assign(new Error('Định dạng file không được phép'), { status: 400 }));
  },
});

export const uploadPhoto = multer({
  storage: isCloudinaryEnabled() ? mem : diskPhotoStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    PHOTO_EXT.has(extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(Object.assign(new Error('Chỉ hỗ trợ ảnh JPG/PNG/WEBP'), { status: 400 }));
  },
});

export const uploadChecklistSubmit = multer({
  storage: isCloudinaryEnabled() ? mem : diskPhotoStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 32 },
  fileFilter: (_req, file, cb) => {
    PHOTO_EXT.has(extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(Object.assign(new Error('Chỉ hỗ trợ ảnh JPG/PNG/WEBP'), { status: 400 }));
  },
}).any();

export const uploadWoPhotos = multer({
  storage: isCloudinaryEnabled() ? mem : diskWoStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    PHOTO_EXT.has(extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(Object.assign(new Error('Chỉ hỗ trợ ảnh JPG/PNG/WEBP'), { status: 400 }));
  },
});

export const uploadAssetPhotos = multer({
  storage: isCloudinaryEnabled() ? mem : diskAssetStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    PHOTO_EXT.has(extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(Object.assign(new Error('Chỉ hỗ trợ ảnh JPG/PNG/WEBP'), { status: 400 }));
  },
});

export const uploadEmployeePhoto = multer({
  storage: isCloudinaryEnabled() ? mem : diskEmpStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    PHOTO_EXT.has(extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(Object.assign(new Error('Chỉ hỗ trợ ảnh JPG/PNG/WEBP'), { status: 400 }));
  },
});
