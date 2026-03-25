/**
 * assetType.validator.js — Validate AssetTypes CRUD.
 * Dùng trong: routes/assetType.routes.js.
 */
export function assetTypeSchema(body) {
  if (!body.typeName?.trim()) return 'Tên loại tài sản không được để trống';
  if (body.typeName.length > 100) return 'Tên loại tài sản tối đa 100 ký tự';
  return null;
}
