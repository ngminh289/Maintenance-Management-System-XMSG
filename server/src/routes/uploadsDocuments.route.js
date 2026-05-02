/**
 * uploadsDocuments.route.js — GET /uploads/documents/:filename
 * Gửi file qua sendFile + headers inline (PDF/ảnh) — khắc phục Chrome tải xuống khi dùng static.
 * Có cookie accessToken (hoặc Bearer): ghi DigitalAssetViewLogs nếu tìm được DigitalAssets theo tên file.
 */
import { join, basename } from 'path';
import { existsSync } from 'fs';
import { UPLOAD_DIR, resolveDocumentAbsolutePath } from '../config/upload.js';
import { previewHeadersForPath } from '../config/uploadsStaticHeaders.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import * as digitalAssetModel from '../models/digitalAsset.model.js';
import * as viewLogModel from '../models/digitalAssetViewLog.model.js';

export function registerUploadsDocumentsGet(app) {
  app.get('/uploads/documents/:filename', optionalAuth, async (req, res, next) => {
    const raw = req.params.filename;
    const name = basename(raw);
    if (!name || name !== raw) {
      return next();
    }

    const storedPath = await digitalAssetModel.findDocumentPathByBasename(name);
    if (storedPath && /^https?:\/\//i.test(String(storedPath))) {
      const empId = req.user?.sub != null ? Number(req.user.sub) : null;
      if (Number.isFinite(empId)) {
        try {
          const daId = await digitalAssetModel.findDigitalAssetIdByDocumentBasename(name);
          if (daId != null) {
            await viewLogModel.insert({ digitalAssetId: daId, employeeId: empId });
          }
        } catch {
          /* không chặn redirect */
        }
      }
      return res.redirect(302, storedPath);
    }

    const abs =
      resolveDocumentAbsolutePath(storedPath || name) || join(UPLOAD_DIR, name);
    if (!existsSync(abs)) {
      return next();
    }
    const headers = previewHeadersForPath(abs);

    const empId = req.user?.sub != null ? Number(req.user.sub) : null;
    if (Number.isFinite(empId)) {
      try {
        const daId = await digitalAssetModel.findDigitalAssetIdByDocumentBasename(name);
        if (daId != null) {
          await viewLogModel.insert({ digitalAssetId: daId, employeeId: empId });
        }
      } catch {
        /* không chặn tải file */
      }
    }

    res.sendFile(abs, { headers }, (err) => {
      if (err) next(err);
    });
  });
}
