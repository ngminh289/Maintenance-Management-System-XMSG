/**
 * asset.service.js — Nghiệp vụ Tài sản: CRUD, cập nhật trạng thái, ảnh tài sản.
 * Dùng trong: controllers/asset.controller.js.
 * Liên quan: models/asset.model.js, models/assetPhoto.model.js, utils/paginate.js
 * Ảnh: POST /api/assets/:id/photos — chỉ ASSET:UPDATE mới gọi được.
 * FilePath lưu dạng "uploads/assets/:filename" — nhất quán với WO photos.
 * AssetStatusHistory: ghi mỗi khi Status thay đổi để tính Downtime chính xác (BFD 6.4).
 */
import { createError }                    from '../utils/createError.js';
import { getPagination, paginatedResult } from '../utils/paginate.js';
import * as model      from '../models/asset.model.js';
import * as photoModel from '../models/assetPhoto.model.js';
import * as downtimeEventModel from '../models/assetDowntimeEvent.model.js';
import { getPool }     from '../config/database.js';
import { deleteStoredFile } from '../utils/storageUrl.js';

export async function getAll(query) {
  const { page, limit, offset } = getPagination(query);
  const rawQ = query.search ?? query.q;
  const qSearch = rawQ != null && String(rawQ).trim() !== '' ? String(rawQ).trim() : undefined;
  const filters = {
    status:      query.status || undefined,
    assetTypeId:    query.assetTypeId    ? Number(query.assetTypeId) : undefined,
    locationId:     query.locationId     ? Number(query.locationId)  : undefined,
    search:         qSearch || undefined,
    productionLine: query.productionLine ? Number(query.productionLine) : undefined,
  };

  const [items, total] = await Promise.all([
    model.findAll({ ...filters, limit, offset }),
    model.count(filters),
  ]);
  return paginatedResult(items, total, page, limit);
}

export async function getById(id) {
  const asset = await model.findById(id);
  if (!asset) throw createError('Không tìm thấy tài sản', 404);
  const photos = await photoModel.listByAsset(id);
  return { ...asset, photos };
}

export async function create(data) {
  const id = await model.create(data);
  return getById(id);
}

export async function update(id, fields) {
  await _assertExists(id);
  await model.update(id, fields);
  return getById(id);
}

export async function updateStatus(id, status, changedBy = null) {
  const existing = await model.findById(id);
  if (!existing) throw createError('Không tìm thấy tài sản', 404);
  if (existing.status !== status) {
    const now = new Date();
    await model.updateStatus(id, status);
    // Ghi lịch sử để tính Downtime chính xác (migration 050)
    await getPool().query(
      `INSERT INTO AssetStatusHistory (AssetID, OldStatus, NewStatus, ChangedBy)
       VALUES (?, ?, ?, ?)`,
      [id, existing.status, status, changedBy ?? null],
    );

    // Downtime unplanned: mở khi vào BROKEN, đóng khi rời BROKEN.
    if (status === 'BROKEN') {
      const openBroken = await downtimeEventModel.findOpenByAssetAndType(
        id,
        'UNPLANNED_BREAKDOWN',
      );
      if (!openBroken) {
        await downtimeEventModel.createEvent({
          assetId: id,
          downtimeType: 'UNPLANNED_BREAKDOWN',
          source: 'ASSET_STATUS',
          reason: `Asset chuyển trạng thái ${existing.status} -> BROKEN`,
          createdBy: changedBy ?? null,
          startAt: now,
        });
      }
    } else if (existing.status === 'BROKEN') {
      const openBroken = await downtimeEventModel.findOpenByAssetAndType(
        id,
        'UNPLANNED_BREAKDOWN',
      );
      if (openBroken) {
        await downtimeEventModel.closeEvent(openBroken.eventId, now);
      }
    }
  }
  return getById(id);
}

/**
 * Soft delete — project.rule: "Xóa: Soft delete (chuyển sang archive/DECOMMISSIONED)".
 * Không xóa thật, chuyển trạng thái để giữ lịch sử.
 */
export async function remove(id) {
  await _assertExists(id);
  await model.updateStatus(id, 'DECOMMISSIONED');
}

// ── Ảnh tài sản ────────────────────────────────────────────────────────────

/**
 * Thêm nhiều ảnh vào tài sản.
 * files: mảng Multer file objects (req.files).
 * uploadedBy: employeeId người upload (từ req.user.sub).
 */
export async function addPhotos(assetId, files, { uploadedBy } = {}) {
  await _assertExists(assetId);
  const list = files || [];
  if (!list.length) throw createError('Chọn ít nhất một ảnh', 400);

  for (const f of list) {
    const rel = f.secure_url || `uploads/assets/${f.filename}`;
    await photoModel.insert(assetId, rel, null, uploadedBy ?? null);
  }
  return photoModel.listByAsset(assetId);
}

/**
 * Xóa một ảnh tài sản. Chỉ người upload hoặc có quyền ASSET:UPDATE (enforced ở route).
 */
export async function deletePhoto(assetId, photoId) {
  const row = await photoModel.findById(photoId);
  if (!row || Number(row.assetId) !== Number(assetId)) {
    throw createError('Không tìm thấy ảnh', 404);
  }
  await deleteStoredFile(row.filePath);
  await photoModel.remove(photoId);
  return photoModel.listByAsset(assetId);
}

export async function getPhotos(assetId) {
  await _assertExists(assetId);
  return photoModel.listByAsset(assetId);
}

// ── helpers ─────────────────────────────────────────────────────────────────

async function _assertExists(id) {
  const asset = await model.findById(id);
  if (!asset) throw createError('Không tìm thấy tài sản', 404);
  return asset;
}
