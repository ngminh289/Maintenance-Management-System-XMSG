/**
 * workOrder.validator.js — Validate WorkOrder CRUD + lưu nháp closure notes.
 * Dùng trong: routes/workOrder.routes.js.
 */
const MAX_CLOSURE_NOTE_LEN = 8000;
const VALID_PRIORITY = ["EMERGENCY", "HIGH", "MEDIUM", "LOW"];
const VALID_STATUS = [
  "WAITING",
  "IN_PROGRESS",
  "PAUSED",
  "AWAITING_CLOSURE",
  "COMPLETED",
  "CANCELLED",
];

export function createWOSchema(body) {
  if (!body.assetId || isNaN(Number(body.assetId)))
    return "AssetID không hợp lệ";
  if (!body.plannedDate || isNaN(Date.parse(body.plannedDate)))
    return "Ngày kế hoạch không hợp lệ";
  if (body.priority && !VALID_PRIORITY.includes(body.priority))
    return `Priority không hợp lệ: ${VALID_PRIORITY.join(", ")}`;
  return null;
}

export function updateWOSchema(body) {
  if (body.plannedDate && isNaN(Date.parse(body.plannedDate)))
    return "Ngày kế hoạch không hợp lệ";
  if (body.priority && !VALID_PRIORITY.includes(body.priority))
    return `Priority không hợp lệ`;
  return null;
}

export function changeStatusSchema(body) {
  if (!body.status || !VALID_STATUS.includes(body.status))
    return `Status không hợp lệ: ${VALID_STATUS.join(", ")}`;
  return null;
}

export function assignSchema(body) {
  if (!body.employeeId || isNaN(Number(body.employeeId)))
    return "EmployeeID không hợp lệ";
  return null;
}

/** PATCH closure-notes — hai trường optional string */
export function closureNotesDraftSchema(body) {
  const cf = body?.closureFieldNotes;
  const cp = body?.closurePartsNotes;
  if (cf != null && String(cf).length > MAX_CLOSURE_NOTE_LEN)
    return `Ghi chú hiện trường tối đa ${MAX_CLOSURE_NOTE_LEN} ký tự`;
  if (cp != null && String(cp).length > MAX_CLOSURE_NOTE_LEN)
    return `Ghi chú vật tư tối đa ${MAX_CLOSURE_NOTE_LEN} ký tự`;
  return null;
}
