/**
 * maintenanceSchedule.validator.js — Validate MaintenanceSchedule CRUD.
 * Dùng trong: routes/maintenanceSchedule.routes.js.
 */
const VALID_TYPES    = ['CORRECTIVE', 'PREVENTIVE', 'PREDICTIVE'];
const VALID_PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const VALID_UNIT     = ['HOURS', 'DAYS', 'WEEKS', 'MONTHS', 'YEARS'];

export function createScheduleSchema(body) {
  if (!body.assetId || isNaN(Number(body.assetId))) return 'AssetID không hợp lệ';
  if (!body.maintenanceType || !VALID_TYPES.includes(body.maintenanceType))  return `Loại bảo trì không hợp lệ: ${VALID_TYPES.join(', ')}`;
  if (!body.description?.trim()) return 'Mô tả không được để trống';
  if (!body.startDate || isNaN(Date.parse(body.startDate))) return 'Ngày bắt đầu không hợp lệ';
  if (body.frequencyUnit && !VALID_UNIT.includes(body.frequencyUnit)) return `FrequencyUnit không hợp lệ: ${VALID_UNIT.join(', ')}`;
  if (body.priority && !VALID_PRIORITY.includes(body.priority)) return `Priority không hợp lệ: ${VALID_PRIORITY.join(', ')}`;
  return null;
}

export function updateScheduleSchema(body) {
  if (body.startDate && isNaN(Date.parse(body.startDate))) return 'Ngày bắt đầu không hợp lệ';
  if (body.frequencyUnit && !VALID_UNIT.includes(body.frequencyUnit)) return 'FrequencyUnit không hợp lệ';
  if (body.priority && !VALID_PRIORITY.includes(body.priority)) return 'Priority không hợp lệ';
  return null;
}
