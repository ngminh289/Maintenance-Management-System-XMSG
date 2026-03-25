/**
 * upload.js — Cấu hình multer cho upload tài liệu số (DigitalAssets).
 * Lưu file tại: server/uploads/documents/<unique>.<ext>
 * Dùng trong: routes/digitalAsset.routes.js.
 */
import multer from 'multer';
import { join, extname } from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = join(__dirname, '..', '..', 'uploads', 'documents');
mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXT = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.png', '.jpg', '.jpeg', '.dwg', '.zip']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    cb(null, `${uid}${extname(file.originalname).toLowerCase()}`);
  },
});

export const uploadDocument = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_EXT.has(extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(Object.assign(new Error('Định dạng file không được phép'), { status: 400 }));
  },
});
