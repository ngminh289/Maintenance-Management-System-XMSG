/**
 * maintenanceSchedule.validator.js — Validate MaintenanceSchedule CRUD.
 * Dùng trong: routes/maintenanceSchedule.routes.js.
 */
const VALID_TYPES = ["CORRECTIVE", "PREVENTIVE", "PREDICTIVE"];
const VALID_PRIORITY = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const VALID_UNIT = ["HOURS", "DAYS", "WEEKS", "MONTHS", "YEARS"];

// Normalize về uppercase để tránh lỗi khi client gửi 'Hours', 'Days', 'Months'
function up(v) {
  return typeof v === "string" ? v.toUpperCase() : v;
}

function validateChecklistTemplateIds(body) {
  if (body.checklistTemplateIds === undefined) return null;
  if (!Array.isArray(body.checklistTemplateIds)) {
    return "checklistTemplateIds phải là mảng";
  }
  for (const id of body.checklistTemplateIds) {
    if (!Number.isFinite(Number(id)) || Number(id) <= 0) {
      return "ChecklistTemplateID trong mảng không hợp lệ";
    }
  }
  return null;
}

export function createScheduleSchema(body) {
  if (!body.assetId || isNaN(Number(body.assetId)))
    return "AssetID không hợp lệ";
  if (!body.scheduleName?.trim()) return "Tên lịch bảo trì không được để trống";
  if (!body.maintenanceType || !VALID_TYPES.includes(up(body.maintenanceType)))
    return `Loại bảo trì không hợp lệ. Hợp lệ: ${VALID_TYPES.join(", ")}`;
  if (!body.description?.trim()) return "Mô tả không được để trống";
  if (!body.startDate || isNaN(Date.parse(body.startDate)))
    return "Ngày bắt đầu không hợp lệ";
  if (body.frequencyUnit && !VALID_UNIT.includes(up(body.frequencyUnit)))
    return `FrequencyUnit không hợp lệ. Hợp lệ: ${VALID_UNIT.join(", ")}`;
  if (body.priority && !VALID_PRIORITY.includes(up(body.priority)))
    return `Priority không hợp lệ. Hợp lệ: ${VALID_PRIORITY.join(", ")}`;
  if (
    body.checklistTemplateId !== undefined &&
    body.checklistTemplateId !== null &&
    body.checklistTemplateId !== "" &&
    (!Number.isFinite(Number(body.checklistTemplateId)) ||
      Number(body.checklistTemplateId) <= 0)
  ) {
    return "ChecklistTemplateID không hợp lệ";
  }
  const idsErr = validateChecklistTemplateIds(body);
  if (idsErr) return idsErr;
  return null;
}

export function updateScheduleSchema(body) {
  if (body.startDate && isNaN(Date.parse(body.startDate)))
    return "Ngày bắt đầu không hợp lệ";
  if (body.frequencyUnit && !VALID_UNIT.includes(up(body.frequencyUnit)))
    return "FrequencyUnit không hợp lệ";
  if (body.priority && !VALID_PRIORITY.includes(up(body.priority)))
    return "Priority không hợp lệ";
  if (
    body.checklistTemplateId !== undefined &&
    body.checklistTemplateId !== null &&
    body.checklistTemplateId !== "" &&
    (!Number.isFinite(Number(body.checklistTemplateId)) ||
      Number(body.checklistTemplateId) <= 0)
  ) {
    return "ChecklistTemplateID không hợp lệ";
  }
  const idsErr = validateChecklistTemplateIds(body);
  if (idsErr) return idsErr;
  return null;
}
