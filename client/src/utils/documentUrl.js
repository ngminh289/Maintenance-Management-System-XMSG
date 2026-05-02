/**
 * documentUrl.js — URL tĩnh /uploads/documents/<tên-file> từ FilePath API.
 * API có thể trả chỉ tên file hoặc full path cũ (Windows); luôn lấy basename + encode.
 */

export function documentUploadsBasename(filePath) {
  if (filePath == null || filePath === '') return '';
  const norm = String(filePath).replace(/\\/g, '/');
  const segs = norm.split('/').filter(Boolean);
  return segs[segs.length - 1] ?? '';
}

export function documentFilePublicUrl(filePath, apiBase) {
  if (filePath == null || filePath === '') return '';
  const norm = String(filePath).replace(/\\/g, '/').trim();
  if (/^https?:\/\//i.test(norm)) return norm;
  const base = (apiBase ?? '').replace(/\/api\/?$/, '') || 'http://localhost:4000';
  const name = documentUploadsBasename(filePath);
  if (!name) return '';
  return `${base}/uploads/documents/${encodeURIComponent(name)}`;
}
