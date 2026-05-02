/**
 * cloudinary.js — Cấu hình Cloudinary + upload buffer/stream.
 * Biến môi trường: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
 * Khi thiếu 3 biến → isCloudinaryEnabled() = false (fallback đĩa local trong upload.js).
 */
import { v2 as cloudinary } from 'cloudinary';

function hasCredentials() {
  const n = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const k = process.env.CLOUDINARY_API_KEY?.trim();
  const s = process.env.CLOUDINARY_API_SECRET?.trim();
  return Boolean(n && k && s);
}

export function isCloudinaryEnabled() {
  return hasCredentials();
}

if (hasCredentials()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
    api_key: process.env.CLOUDINARY_API_KEY.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
    secure: true,
  });
}

/**
 * Upload buffer lên Cloudinary.
 * @param {Buffer} buffer
 * @param {{ folder: string, resource_type?: 'image'|'raw'|'auto', originalFilename?: string }} opts
 */
export function uploadBufferToCloudinary(buffer, opts) {
  if (!hasCredentials()) {
    return Promise.reject(new Error('Cloudinary chưa được cấu hình'));
  }
  const folder = opts.folder || 'warehouse/misc';
  const resourceType = opts.resource_type || 'auto';

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        use_filename: Boolean(opts.originalFilename),
        filename_override: opts.originalFilename || undefined,
        unique_filename: true,
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      },
    );
    stream.end(buffer);
  });
}

/** Trích public_id từ secure_url để xóa asset trên Cloudinary. */
export function publicIdFromCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('res.cloudinary.com')) return null;
  try {
    const u = new URL(url);
    let path = u.pathname;
    const marker = '/upload/';
    const idx = path.indexOf(marker);
    if (idx === -1) return null;
    let tail = path.slice(idx + marker.length);
    tail = tail.replace(/^v\d+\//, '');
    const lastDot = tail.lastIndexOf('.');
    if (lastDot > 0) {
      const ext = tail.slice(lastDot + 1).toLowerCase();
      if (/^[a-z0-9]{2,10}$/.test(ext)) {
        tail = tail.slice(0, lastDot);
      }
    }
    return decodeURIComponent(tail);
  } catch {
    return null;
  }
}

/** resource_type cho API destroy: image | raw */
export function resourceTypeFromCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return 'image';
  return url.includes('/raw/upload/') ? 'raw' : 'image';
}

export async function destroyCloudinaryByUrl(url) {
  if (!hasCredentials() || !url) return;
  const publicId = publicIdFromCloudinaryUrl(url);
  if (!publicId) return;
  const rt = resourceTypeFromCloudinaryUrl(url);
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: rt });
  } catch {
    /* có thể đã xóa tay */
  }
}
