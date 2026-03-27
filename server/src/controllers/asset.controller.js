/**
 * asset.controller.js — HTTP handler: /api/assets.
 * Bao gồm: CRUD, soft-delete (DECOMMISSIONED), QR code generation.
 * project.rule: "Sinh QR động khi đăng ký tài sản (chứa AssetID, link đến checklist)".
 * Liên quan: services/asset.service.js, routes/asset.routes.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/asset.service.js';
import QRCode from 'qrcode';

export const getAll = asyncHandler(async (req, res) => {
  return ok(res, await service.getAll(req.query));
});

export const getById = asyncHandler(async (req, res) => {
  return ok(res, await service.getById(req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  return ok(res, await service.create(req.body), 201);
});

export const update = asyncHandler(async (req, res) => {
  return ok(res, await service.update(req.params.id, req.body));
});

export const updateStatus = asyncHandler(async (req, res) => {
  return ok(res, await service.updateStatus(req.params.id, req.body.status));
});

export const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  return ok(res, { message: 'Tài sản đã được lưu trữ (DECOMMISSIONED).' });
});

/**
 * GET /api/assets/:id/qr
 * Trả về ảnh PNG mã QR chứa URL checklist của tài sản (project.rule).
 * ?format=png (default) | ?format=svg | ?format=base64
 */
export const generateQR = asyncHandler(async (req, res) => {
  const asset = await service.getById(req.params.id);
  const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const qrPayload = `${baseUrl}/checklist/scan/${asset.assetId}`;
  const format = req.query.format || 'png';

  if (format === 'svg') {
    const svg = await QRCode.toString(qrPayload, { type: 'svg' });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `inline; filename="qr-${asset.assetId}.svg"`);
    return res.send(svg);
  }

  if (format === 'base64') {
    const dataUrl = await QRCode.toDataURL(qrPayload);
    return ok(res, { assetId: asset.assetId, assetName: asset.assetName, qrPayload, dataUrl });
  }

  // Mặc định: trả về ảnh PNG để hiển thị/tải về
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `inline; filename="qr-${asset.assetId}.png"`);
  await QRCode.toFileStream(res, qrPayload, { width: 300, margin: 2 });
});
