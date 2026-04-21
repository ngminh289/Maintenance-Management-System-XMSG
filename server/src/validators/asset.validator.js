/**
 * asset.validator.js — Validate Assets CRUD.
 * Dùng trong: routes/asset.routes.js.
 * Trường mở rộng: model, yearOfManufacture, technicalSpecs,
 *                 purchaseDate, warrantyDate, decommissionDate, productionLine (FK INT từ 048)
 */
const VALID_STATUSES = ['AVAILABLE', 'MONITORING', 'CAUTION', 'MAINTENANCE', 'BROKEN', 'DECOMMISSIONED'];

/** null / undefined / '' đều coi là "không truyền" — hợp lệ cho trường optional */
const isValidDate = (d) => d && !isNaN(Date.parse(d));
const isAbsent = (v) => v === undefined || v === null || v === '';
const isValidYear = (y) => {
  const n = Number(y);
  return Number.isInteger(n) && n >= 1900 && n <= new Date().getFullYear() + 1;
};

export function createAssetSchema(body) {
  const { assetName, assetTypeId, locationId, yearOfManufacture, purchaseDate, warrantyDate, decommissionDate } = body;

  if (!assetName?.trim())                       return 'Tên tài sản không được để trống';
  if (assetName.length > 100)                   return 'Tên tài sản tối đa 100 ký tự';
  if (!assetTypeId || isNaN(Number(assetTypeId))) return 'Loại tài sản không hợp lệ';
  if (!locationId  || isNaN(Number(locationId)))  return 'Vị trí không hợp lệ';

  if (!isAbsent(yearOfManufacture)  && !isValidYear(yearOfManufacture))  return 'Năm sản xuất không hợp lệ (1900 – năm hiện tại)';
  if (!isAbsent(purchaseDate)       && !isValidDate(purchaseDate))       return 'Ngày mua không hợp lệ';
  if (!isAbsent(warrantyDate)       && !isValidDate(warrantyDate))       return 'Hạn bảo hành không hợp lệ';
  if (!isAbsent(decommissionDate)   && !isValidDate(decommissionDate))   return 'Ngày ngưng hoạt động không hợp lệ';
  if (!isAbsent(body.productionLine) && isNaN(Number(body.productionLine))) {
    return 'Dây chuyền không hợp lệ (phải là ID số nguyên)';
  }

  return null;
}

export function updateAssetSchema(body) {
  const { assetName, assetTypeId, locationId, commissionDate, status,
          yearOfManufacture, purchaseDate, warrantyDate, decommissionDate } = body;

  if (assetName   !== undefined && !assetName?.trim())           return 'Tên tài sản không được để trống';
  if (assetName   !== undefined && assetName.length > 100)       return 'Tên tài sản tối đa 100 ký tự';
  if (assetTypeId !== undefined && isNaN(Number(assetTypeId)))   return 'Loại tài sản không hợp lệ';
  if (locationId  !== undefined && isNaN(Number(locationId)))    return 'Vị trí không hợp lệ';
  if (!isAbsent(commissionDate) && !isValidDate(commissionDate)) return 'Ngày đưa vào sử dụng không hợp lệ';
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return `Trạng thái không hợp lệ. Chấp nhận: ${VALID_STATUSES.join(', ')}`;
  }

  if (!isAbsent(yearOfManufacture)  && !isValidYear(yearOfManufacture))  return 'Năm sản xuất không hợp lệ (1900 – năm hiện tại)';
  if (!isAbsent(purchaseDate)       && !isValidDate(purchaseDate))       return 'Ngày mua không hợp lệ';
  if (!isAbsent(warrantyDate)       && !isValidDate(warrantyDate))       return 'Hạn bảo hành không hợp lệ';
  if (!isAbsent(decommissionDate)   && !isValidDate(decommissionDate))   return 'Ngày ngưng hoạt động không hợp lệ';
  if (!isAbsent(body.productionLine) && isNaN(Number(body.productionLine))) {
    return 'Dây chuyền không hợp lệ (phải là ID số nguyên)';
  }

  return null;
}

export function updateStatusSchema(body) {
  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return `Trạng thái không hợp lệ. Chấp nhận: ${VALID_STATUSES.join(', ')}`;
  }
  return null;
}
