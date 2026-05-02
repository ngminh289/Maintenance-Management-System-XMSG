/**
 * cloudinaryUpload.middleware.js — Sau multer (memory): đẩy buffer lên Cloudinary.
 * Liên quan: config/cloudinary.js, config/upload.js (multer memory).
 */
import { uploadBufferToCloudinary } from '../config/cloudinary.js';

function guessRawFilename(originalname) {
  if (!originalname) return 'file.bin';
  const base = String(originalname).split(/[/\\]/).pop();
  return base || 'file.bin';
}

/** multipart single → req.file.secure_url */
export function cloudinaryAfterSingle(folder, resourceType = 'auto') {
  return async (req, res, next) => {
    try {
      const f = req.file;
      if (!f?.buffer?.length) return next();
      const orig =
        resourceType === 'raw'
          ? guessRawFilename(f.originalname)
          : undefined;
      const result = await uploadBufferToCloudinary(f.buffer, {
        folder,
        resource_type: resourceType,
        originalFilename: orig,
      });
      f.secure_url = result.secure_url;
      f.public_id = result.public_id;
      f.size = f.buffer.length;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** multipart array (cùng folder/type) */
export function cloudinaryAfterArray(folder, resourceType = 'image') {
  return async (req, res, next) => {
    try {
      const files = req.files;
      if (!Array.isArray(files) || !files.length) return next();
      for (const f of files) {
        if (!f?.buffer?.length) continue;
        const result = await uploadBufferToCloudinary(f.buffer, {
          folder,
          resource_type: resourceType,
        });
        f.secure_url = result.secure_url;
        f.public_id = result.public_id;
        f.size = f.buffer.length;
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
