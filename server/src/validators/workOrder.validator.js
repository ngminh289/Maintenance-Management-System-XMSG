/**
 * workOrder.validator.js — Validate WorkOrder CRUD.
 * Dùng trong: routes/workOrder.routes.js.
 */
const VALID_PRIORITY = ['EMERGENCY', 'HIGH', 'MEDIUM', 'LOW'];
const VALID_STATUS   = ['WAITING', 'IN_PROGRESS', 'PAUSED', 'AWAITING_CLOSURE', 'COMPLETED', 'CANCELLED'];

export function createWOSchema(body) {
  if (!body.assetId || isNaN(Number(body.assetId))) return 'AssetID không hợp lệ';
  if (!body.plannedDate || isNaN(Date.parse(body.plannedDate))) return 'Ngày kế hoạch không hợp lệ';
  if (body.priority && !VALID_PRIORITY.includes(body.priority)) return `Priority không hợp lệ: ${VALID_PRIORITY.join(', ')}`;
  return null;
}

export function updateWOSchema(body) {
  if (body.plannedDate && isNaN(Date.parse(body.plannedDate))) return 'Ngày kế hoạch không hợp lệ';
  if (body.priority && !VALID_PRIORITY.includes(body.priority)) return `Priority không hợp lệ`;
  return null;
}

export function changeStatusSchema(body) {
  if (!body.status || !VALID_STATUS.includes(body.status)) return `Status không hợp lệ: ${VALID_STATUS.join(', ')}`;
  return null;
}

export function assignSchema(body) {
  if (!body.employeeId || isNaN(Number(body.employeeId))) return 'EmployeeID không hợp lệ';
  return null;
}
