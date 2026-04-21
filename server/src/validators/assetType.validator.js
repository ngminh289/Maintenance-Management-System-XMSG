/**
 * assetType.validator.js — Validate AssetTypes CRUD (migration 048: cây 2 cấp).
 * Dùng trong: routes/assetType.routes.js.
 */
const VALID_PM_UNITS = ['HOURS', 'DAYS', 'WEEKS', 'MONTHS', 'YEARS'];

export function assetTypeSchema(body) {
  if (!body.typeName?.trim())           return 'Tên loại tài sản không được để trống';
  if (body.typeName.length > 100)       return 'Tên loại tài sản tối đa 100 ký tự';
  if (body.defaultPMValue !== undefined && body.defaultPMValue !== null && body.defaultPMValue !== '') {
    const v = Number(body.defaultPMValue);
    if (!Number.isInteger(v) || v <= 0) return 'Giá trị chu kỳ PM phải là số nguyên dương';
  }
  if (body.defaultPMUnit && !VALID_PM_UNITS.includes(body.defaultPMUnit)) {
    return `Đơn vị PM không hợp lệ. Chấp nhận: ${VALID_PM_UNITS.join(', ')}`;
  }
  return null;
}
