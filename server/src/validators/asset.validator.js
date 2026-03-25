/**
 * asset.validator.js — Validate Assets CRUD.
 * Dùng trong: routes/asset.routes.js.
 */
const VALID_STATUSES = ['AVAILABLE', 'MAINTENANCE', 'UNDER REPAIR', 'BROKEN', 'DISUSED'];

export function createAssetSchema(body) {
  const { assetName, assetTypeId, locationId, commissionDate } = body;
  if (!assetName?.trim()) return 'Tên tài sản không được để trống';
  if (assetName.length > 100) return 'Tên tài sản tối đa 100 ký tự';
  if (!assetTypeId || isNaN(Number(assetTypeId))) return 'Loại tài sản không hợp lệ';
  if (!locationId || isNaN(Number(locationId))) return 'Vị trí không hợp lệ';
  if (!commissionDate || isNaN(Date.parse(commissionDate))) return 'Ngày đưa vào sử dụng không hợp lệ';
  return null;
}

export function updateAssetSchema(body) {
  const { assetName, assetTypeId, locationId, commissionDate, status } = body;
  if (assetName !== undefined && !assetName?.trim()) return 'Tên tài sản không được để trống';
  if (assetTypeId !== undefined && isNaN(Number(assetTypeId))) return 'Loại tài sản không hợp lệ';
  if (locationId !== undefined && isNaN(Number(locationId))) return 'Vị trí không hợp lệ';
  if (commissionDate !== undefined && isNaN(Date.parse(commissionDate))) return 'Ngày đưa vào sử dụng không hợp lệ';
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return `Trạng thái không hợp lệ. Chấp nhận: ${VALID_STATUSES.join(', ')}`;
  }
  return null;
}

export function updateStatusSchema(body) {
  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return `Trạng thái không hợp lệ. Chấp nhận: ${VALID_STATUSES.join(', ')}`;
  }
  return null;
}
