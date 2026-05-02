/**
 * storageUrl.js — Phân biệt file lưu URL Cloudinary vs đường dẫn local uploads/...
 * Dùng khi xóa file hoặc resolve đường dẫn vật lý.
 */
import { unlink } from 'fs/promises';
import { destroyCloudinaryByUrl } from '../config/cloudinary.js';

export function isRemoteStorageUrl(value) {
  if (value == null || value === '') return false;
  const s = String(value).trim();
  return /^https?:\/\//i.test(s);
}

/** Xóa file: Cloudinary hoặc file local (uploads/...). */
export async function deleteStoredFile(pathOrUrl) {
  if (!pathOrUrl) return;
  if (isRemoteStorageUrl(pathOrUrl)) {
    await destroyCloudinaryByUrl(pathOrUrl);
    return;
  }
  try {
    const { resolveLocalUploadAbsolutePath } = await import('../config/upload.js');
    const abs = resolveLocalUploadAbsolutePath(pathOrUrl);
    if (abs) await unlink(abs).catch(() => {});
  } catch {
    /* ignore */
  }
}
