/**
 * location.validator.js — Validate Locations CRUD.
 * Dùng trong: routes/location.routes.js.
 */
export function locationSchema(body) {
  const { locationName, parentLocationId } = body;
  if (!locationName?.trim()) return 'Tên vị trí không được để trống';
  if (locationName.length > 100) return 'Tên vị trí tối đa 100 ký tự';
  if (parentLocationId !== undefined && parentLocationId !== null && isNaN(Number(parentLocationId))) {
    return 'ParentLocationId không hợp lệ';
  }
  return null;
}
