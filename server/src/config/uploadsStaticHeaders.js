/**
 * uploadsStaticHeaders.js — MIME + inline cho /uploads (PDF/ảnh xem trong tab).
 * Route GET /uploads/documents/:filename dùng sendFile + headers (serve-static hay ghi đè header).
 */
import { basename, extname } from 'path';

const MIME = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

const INLINE_EXT = new Set(Object.keys(MIME));

/** Headers cho res.sendFile(options.headers) — áp dụng sau cùng, không bị send() ghi đè. */
export function previewHeadersForPath(filePath) {
  const name = basename(filePath);
  const ext = extname(name).toLowerCase();
  const headers = {};
  const type = MIME[ext];
  if (type) headers['Content-Type'] = type;
  if (INLINE_EXT.has(ext)) {
    headers['Content-Disposition'] = `inline; filename="${name.replace(/"/g, '')}"`;
  }
  return headers;
}

export function setUploadStaticHeaders(res, filePath) {
  const headers = previewHeadersForPath(filePath);
  for (const [k, v] of Object.entries(headers)) {
    res.setHeader(k, v);
  }
}
