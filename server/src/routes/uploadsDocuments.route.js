/**
 * uploadsDocuments.route.js — GET /uploads/documents/:filename
 * Gửi file qua sendFile + headers inline (PDF/ảnh) — khắc phục Chrome tải xuống khi dùng static.
 */
import { join, basename } from 'path';
import { existsSync } from 'fs';
import { UPLOAD_DIR } from '../config/upload.js';
import { previewHeadersForPath } from '../config/uploadsStaticHeaders.js';

export function registerUploadsDocumentsGet(app) {
  app.get('/uploads/documents/:filename', (req, res, next) => {
    const raw = req.params.filename;
    const name = basename(raw);
    if (!name || name !== raw) {
      return next();
    }
    const abs = join(UPLOAD_DIR, name);
    if (!existsSync(abs)) {
      return next();
    }
    const headers = previewHeadersForPath(abs);
    res.sendFile(abs, { headers }, (err) => {
      if (err) next(err);
    });
  });
}
