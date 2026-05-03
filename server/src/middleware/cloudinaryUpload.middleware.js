/**
 * cloudinaryUpload.middleware.js — Sau multer (memory hoặc disk): đẩy lên Cloudinary.
 * Disk + CLOUDINARY_*: đọc file từ path (multer disk không có buffer).
 * Liên quan: config/cloudinary.js, config/upload.js.
 */
import { readFile } from 'fs/promises';
import {
  isCloudinaryEnabled,
  uploadBufferToCloudinary,
} from '../config/cloudinary.js';

async function bufferForUpload(file) {
  if (file?.buffer?.length) return file.buffer;
  if (file?.path) {
    try {
      return await readFile(file.path);
    } catch {
      return null;
    }
  }
  return null;
}

function guessRawFilename(originalname) {
  if (!originalname) return 'file.bin';
  const base = String(originalname).split(/[/\\]/).pop();
  return base || 'file.bin';
}

/** multipart single → req.file.secure_url */
export function cloudinaryAfterSingle(folder, resourceType = 'auto') {
  return async (req, res, next) => {
    try {
      if (!isCloudinaryEnabled()) return next();
      const f = req.file;
      const buf = await bufferForUpload(f);
      if (!buf?.length) return next();
      const orig =
        resourceType === 'raw'
          ? guessRawFilename(f.originalname)
          : undefined;
      const result = await uploadBufferToCloudinary(buf, {
        folder,
        resource_type: resourceType,
        originalFilename: orig,
      });
      f.secure_url = result.secure_url;
      f.public_id = result.public_id;
      f.size = buf.length;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** multipart array (cùng folder/type); .any() cũng dùng req.files — mảng */
export function cloudinaryAfterArray(folder, resourceType = 'image') {
  return async (req, res, next) => {
    try {
      if (!isCloudinaryEnabled()) return next();
      const files = req.files;
      if (!Array.isArray(files) || !files.length) return next();
      for (const f of files) {
        const buf = await bufferForUpload(f);
        if (!buf?.length) continue;
        const result = await uploadBufferToCloudinary(buf, {
          folder,
          resource_type: resourceType,
        });
        f.secure_url = result.secure_url;
        f.public_id = result.public_id;
        f.size = buf.length;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** upload.any() — checklist: field photo + item_<id> */
export function cloudinaryAfterAny(folder, resourceType = 'image') {
  return cloudinaryAfterArray(folder, resourceType);
}
