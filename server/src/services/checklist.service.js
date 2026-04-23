/**
 * checklist.service.js — Luồng kiểm tra hiện trường (BFD mục 3 + §5 quản lý mẫu theo loại).
 *
 * Gửi checklist: lưu kết quả + chi tiết, ReviewStatus=PENDING — KHÔNG đổi tài sản / WO / bộ đếm.
 * Trưởng ca / Trưởng phòng duyệt (APPROVE): mới chạy logic theo OverallStatus:
 *   OK      → đóng WO (nếu có) + reconcile tài sản (AVAILABLE nếu hết phiến onsite, còn thì MAINTENANCE); không WO → AVAILABLE
 *   WARNING → MONITORING, WO PREDICTIVE HIGH + thông báo
 *   NG      → BROKEN, WO CORRECTIVE EMERGENCY + thông báo (MAINTENANCE khi KTV bắt đầu IN_PROGRESS)
 * Đồng hồ giờ chạy (recordReading) chỉ gọi khi APPROVE.
 *
 * REJECT: giữ nguyên tài sản, thông báo cho người nộp.
 *
 * Liên quan: workOrder.service.js, assetCounter.service.js, notification.service.js,
 *            models/checklistResult.model.js, models/scheduledChecklistSlot.model.js (slot lượt checklist từ lịch).
 *
 * getResultById: bổ sung checklistTemplateName, assetTypeName, locationName và threshold từng câu (màn duyệt).
 * Template: hỗ trợ nhiều mẫu cho một loại tài sản; ChecklistResults lưu TemplateID đã dùng.
 * getQRInfo: ghi AssetQrAccessLogs (lượt mở màn hình QR); kèm runtimeCounter để form checklist hiển thị.
 *
 * Xem kết quả (positionLevel ≤ 1 = công nhân): chỉ phiếu APPROVED (mọi người) + mọi phiếu do mình nộp (mọi trạng thái).
 * NVKT+ xem toàn bộ; GET /results không cho CN lọc theo checkerId người khác.
 */
import { createError } from "../utils/createError.js";
import * as templateModel from "../models/checklistTemplate.model.js";
import * as resultModel from "../models/checklistResult.model.js";
import * as assetModel from "../models/asset.model.js";
import * as workOrderModel from "../models/workOrder.model.js";
import * as workOrderMaintSync from "./workOrderMaintenanceSync.service.js";
import * as workOrderSvc from "./workOrder.service.js";
import * as counterSvc from "./assetCounter.service.js";
import * as counterModel from "../models/assetCounter.model.js";
import * as notifService from "./notification.service.js";
import * as scheduledChecklistSlotModel from "../models/scheduledChecklistSlot.model.js";
import * as assetQrAccessLogModel from "../models/assetQrAccessLog.model.js";
import * as maintenanceScheduleModel from "../models/maintenanceSchedule.model.js";

/** Level ≤ 1: công nhân — giới hạn xem checklist như mô tả file header. */
const CHECKLIST_VIEW_WORKER_MAX_LEVEL = 1;

function isChecklistViewRestrictedWorker(positionLevel) {
  return (Number(positionLevel) || 0) <= CHECKLIST_VIEW_WORKER_MAX_LEVEL;
}

const INPUT_TYPE_TO_DB = {
  PassFail: "PASS_FAIL",
  PASS_FAIL: "PASS_FAIL",
  Numeric: "NUMERIC",
  NUMERIC: "NUMERIC",
  Text: "TEXT",
  TEXT: "TEXT",
  Photo: "PHOTO",
  PHOTO: "PHOTO",
  Range: "RANGE",
  RANGE: "RANGE",
  Selection: "SELECTION",
  SELECTION: "SELECTION",
};

/** API client (PassFail) ↔ MySQL ENUM (PASS_FAIL) */
const DB_INPUT_TO_CLIENT = {
  PASS_FAIL: "PassFail",
  NUMERIC: "Numeric",
  TEXT: "Text",
  PHOTO: "Photo",
  RANGE: "Range",
  SELECTION: "Selection",
};

function mapTemplateForClient(t) {
  if (!t) return t;
  return {
    ...t,
    items: (t.items || []).map((i) => ({
      ...i,
      inputType: DB_INPUT_TO_CLIENT[i.inputType] || i.inputType,
    })),
  };
}

/** Khớp dòng ChecklistDetails với câu mẫu (theo nội dung + kiểu nhập). */
function matchTemplateItemForReview(templateItems, detailRow) {
  const detailClient =
    DB_INPUT_TO_CLIENT[detailRow.inputType] || detailRow.inputType;
  let item = templateItems.find(
    (i) =>
      i.questionText === detailRow.questionText && i.inputType === detailClient,
  );
  if (!item)
    item = templateItems.find((t) => t.questionText === detailRow.questionText);
  return item || null;
}

function thresholdPayloadFromTemplateItem(item) {
  if (!item) return null;
  return {
    safeNumericMin: item.safeNumericMin ?? null,
    safeNumericMax: item.safeNumericMax ?? null,
    rangeMin: item.rangeMin ?? null,
    rangeMax: item.rangeMax ?? null,
    outOfRangeSuggest: item.outOfRangeSuggest ?? null,
    passFailFailSuggest: item.passFailFailSuggest ?? null,
  };
}

function normalizeDetailInputType(inputType) {
  if (!inputType) return "PASS_FAIL";
  return INPUT_TYPE_TO_DB[inputType] || "PASS_FAIL";
}

function normalizeItemPayload(data) {
  if (!data || typeof data !== "object") return data;
  const out = { ...data };
  if (out.inputType !== undefined) {
    out.inputType = normalizeDetailInputType(out.inputType);
  }
  for (const key of ["outOfRangeSuggest", "passFailFailSuggest"]) {
    if (out[key] === "" || out[key] === undefined) {
      if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = null;
      continue;
    }
    if (typeof out[key] === "string") {
      const u = out[key].toUpperCase();
      out[key] = u === "WARNING" || u === "NG" ? u : null;
    }
  }
  if (out.safeNumericMin === "" || out.safeNumericMin === undefined) {
    if (Object.prototype.hasOwnProperty.call(out, "safeNumericMin"))
      out.safeNumericMin = null;
  } else if (out.safeNumericMin != null) {
    const n = Number(out.safeNumericMin);
    out.safeNumericMin = Number.isNaN(n) ? null : n;
  }
  if (out.safeNumericMax === "" || out.safeNumericMax === undefined) {
    if (Object.prototype.hasOwnProperty.call(out, "safeNumericMax"))
      out.safeNumericMax = null;
  } else if (out.safeNumericMax != null) {
    const n = Number(out.safeNumericMax);
    out.safeNumericMax = Number.isNaN(n) ? null : n;
  }
  return out;
}

/** Map questionId + answer từ app → questionText + InputType cho ChecklistDetails */
async function enrichDetailsForInsert(assetTypeId, details, templateId = null) {
  if (!details?.length) return details;
  const template = templateId
    ? { templateId: Number(templateId) }
    : await templateModel.findByAssetTypeId(assetTypeId);
  if (!template) {
    return details.map((d) => ({
      questionText: d.questionText || `Câu #${d.questionId ?? "?"}`,
      inputType: normalizeDetailInputType(d.inputType),
      answerValue: d.answerValue,
      isOK: d.isOK !== false && d.isOk !== false,
    }));
  }
  const full = await templateModel.findById(template.templateId);
  const byId = new Map((full?.items || []).map((i) => [Number(i.itemId), i]));
  return details.map((d) => {
    const item = byId.get(Number(d.questionId));
    return {
      questionText:
        d.questionText || item?.questionText || `Câu #${d.questionId ?? "?"}`,
      inputType: normalizeDetailInputType(d.inputType || item?.inputType),
      answerValue: d.answerValue,
      isOK: d.isOK !== false && d.isOk !== false,
    };
  });
}

// ─── Template Management ─────────────────────────────────────────────────────

export async function getTemplates(assetTypeId) {
  return templateModel.findAll(assetTypeId ? Number(assetTypeId) : undefined);
}

export async function getTemplateById(id) {
  const t = await templateModel.findById(id);
  if (!t) throw createError("Không tìm thấy mẫu checklist", 404);
  return mapTemplateForClient(t);
}

export async function createTemplate({
  assetTypeId,
  templateName,
  description,
}) {
  const typeId = Number(assetTypeId);
  const id = await templateModel.createTemplate({
    assetTypeId: typeId,
    templateName,
    description,
  });
  return mapTemplateForClient(await templateModel.findById(id));
}

export async function updateTemplate(id, data) {
  const cur = await templateModel.findById(id);
  if (!cur) throw createError("Không tìm thấy mẫu checklist", 404);
  await templateModel.updateTemplate(id, data);
  return mapTemplateForClient(await templateModel.findById(id));
}

export async function removeTemplate(id) {
  await getTemplateById(id);
  await templateModel.removeTemplate(id);
}

export async function addItem(templateId, data) {
  const t = await templateModel.findById(templateId);
  if (!t) throw createError("Không tìm thấy mẫu checklist", 404);
  const payload = normalizeItemPayload(data);
  await templateModel.addItem({ templateId: Number(templateId), ...payload });
  return mapTemplateForClient(await templateModel.findById(templateId));
}

export async function updateItem(itemId, data) {
  const affected = await templateModel.updateItem(
    itemId,
    normalizeItemPayload(data),
  );
  if (!affected) throw createError("Không tìm thấy câu hỏi", 404);
}

export async function removeItem(itemId) {
  await templateModel.removeItem(itemId);
}

// ─── QR Scan Info ────────────────────────────────────────────────────────────

export async function getQRInfo(assetId, viewer = {}) {
  const asset = await assetModel.findById(assetId);
  if (!asset) throw createError("Không tìm thấy tài sản", 404);

  const templateHeads = await templateModel.findAllByAssetTypeId(asset.assetTypeId);
  const checklistTemplates = await Promise.all(
    templateHeads.map(async (t) => mapTemplateForClient(await templateModel.findById(t.templateId))),
  );
  const checklistTemplate = checklistTemplates[0] || null;
  let preferredTemplateId = checklistTemplate?.templateId ?? null;
  const linkedWoId = viewer.woId != null && viewer.woId !== "" ? Number(viewer.woId) : null;
  if (linkedWoId && Number.isFinite(linkedWoId) && linkedWoId > 0) {
    const wo = await workOrderModel.findById(linkedWoId);
    if (
      wo &&
      Number(wo.assetId) === Number(assetId) &&
      wo.scheduleId != null &&
      (
        String(wo.woSource || "").toUpperCase() === "SCHEDULE" ||
        String(wo.woSource || "").toUpperCase() === "PREDICTIVE_SCHEDULE" ||
        String(wo.woSource || "").toUpperCase() === "PREDICTIVE"
      )
    ) {
      const schedule = await maintenanceScheduleModel.findById(wo.scheduleId);
      if (schedule?.checklistTemplateId != null) {
        preferredTemplateId = Number(schedule.checklistTemplateId);
      }
    }
  }

  const { getPool } = await import("../config/database.js");
  const [documents] = await getPool().query(
    `SELECT da.DigitalAssetID AS digitalAssetId,
            da.FileName       AS fileName,
            da.FileType       AS fileType,
            da.Description    AS description,
            da.CurrentVersion AS currentVersion,
            da.FilePath       AS filePath,
            GROUP_CONCAT(t.TagName ORDER BY t.TagName SEPARATOR '||') AS tagNames,
            GROUP_CONCAT(t.TagID   ORDER BY t.TagName SEPARATOR '||') AS tagIds
     FROM DigitalAssets da
     LEFT JOIN AssetTags at2 ON at2.DigitalAssetID = da.DigitalAssetID
     LEFT JOIN Tags t        ON t.TagID = at2.TagID
     WHERE da.AssetID = ? AND da.Status = 'APPROVED'
     GROUP BY da.DigitalAssetID
     ORDER BY da.UploadDate DESC`,
    [assetId],
  );
  const documentsWithTags = documents.map((doc) => ({
    ...doc,
    tags: doc.tagNames
      ? doc.tagNames.split("||").map((name, i) => ({
          tagId: Number(doc.tagIds.split("||")[i]),
          tagName: name,
        }))
      : [],
    tagNames: undefined,
    tagIds: undefined,
  }));

  const recentResults = await resultModel.findByAssetVisibleTo(assetId, 5, {
    employeeId: viewer.employeeId,
    positionLevel: viewer.positionLevel,
  });

  const counterRow = await counterModel.findByAsset(assetId);
  const runtimeCounter = {
    lastReadingValue: Number(counterRow?.lastReadingValue ?? 0),
    totalAccumulatedHours: Number(counterRow?.totalAccumulatedHours ?? 0),
    lastMaintenanceTotal: Number(counterRow?.lastMaintenanceTotal ?? 0),
    averageHoursPerDay: Number(counterRow?.averageHoursPerDay ?? 0),
    estimatedNextPMDate: counterRow?.estimatedNextPMDate ?? null,
    lastUpdated: counterRow?.lastUpdated ?? null,
  };

  const eid = viewer.employeeId != null ? Number(viewer.employeeId) : null;
  if (eid && !Number.isNaN(eid)) {
    try {
      await assetQrAccessLogModel.insert({
        assetId: Number(assetId),
        employeeId: eid,
      });
    } catch {
      // log không ảnh hưởng tải QR
    }
  }

  return {
    asset,
    checklistTemplate,
    checklistTemplates,
    preferredTemplateId,
    documents: documentsWithTags,
    recentResults,
    runtimeCounter,
  };
}

// ─── Áp dụng hiệu lực sau khi TC/TP APPROVE ──────────────────────────────────

/**
 * @param {object} row — checklist row (checklistId, assetId, woId, checkerId, overallStatus, readingValue)
 * @returns {Promise<number|null>} newWorkOrderId
 */
export async function applyApprovedChecklistEffects(row) {
  const { checklistId, assetId, woId, checkerId, overallStatus, readingValue } =
    row;
  const asset = await assetModel.findById(assetId);
  if (!asset) throw createError("Không tìm thấy tài sản", 404);

  if (readingValue != null) {
    await counterSvc.recordReading({
      assetId,
      readingValue,
      checklistId,
      dataSource: "MANUAL",
    });
  }

  let newWorkOrderId = null;

  if (overallStatus === "OK") {
    if (woId) {
      const w = await workOrderModel.findById(woId);
      const autoHours = w
        ? workOrderModel.computeSuggestedActualHours(w)
        : undefined;
      await workOrderModel.updateStatus(woId, "COMPLETED", {
        actualDate: new Date().toISOString().split("T")[0],
        ...(autoHours !== undefined ? { actualHours: autoHours } : {}),
      });
      const completedWo = await workOrderModel.findById(woId);
      await workOrderMaintSync.afterWorkOrderCompleted(completedWo);
      await workOrderSvc.reconcileAssetStatusForOnsiteWorkOrders(assetId);
    } else {
      await assetModel.updateStatus(assetId, "AVAILABLE");
    }
  } else if (overallStatus === "WARNING") {
    await assetModel.updateStatus(assetId, "MONITORING");
    newWorkOrderId = await workOrderSvc.createAutomatic({
      assetId,
      woSource: "PREDICTIVE",
      priority: "HIGH",
      description: `[CẢNH BÁO] Checklist #${checklistId}: ${asset.assetName} — Theo dõi thêm (đã xác nhận giám sát)`,
      createdBy: checkerId,
    });
    await notifService.notifyManagers(
      `CẢNH BÁO: [${asset.assetName}] checklist #${checklistId} đã được giám sát duyệt. WO #${newWorkOrderId} chờ phê duyệt.`,
      "SYSTEM_ALERT",
      2,
      { resourceType: "WORK_ORDER", resourceId: newWorkOrderId },
    );
  } else if (overallStatus === "NG") {
    await assetModel.updateStatus(assetId, "BROKEN");
    newWorkOrderId = await workOrderSvc.createAutomatic({
      assetId,
      woSource: "CORRECTIVE",
      priority: "EMERGENCY",
      description: `[SỰ CỐ] Checklist #${checklistId}: ${asset.assetName} — NG (đã xác nhận giám sát)`,
      createdBy: checkerId,
    });
    await notifService.notifyManagers(
      `SỰ CỐ: [${asset.assetName}] checklist #${checklistId} giám sát xác nhận NG. WO #${newWorkOrderId} đã tạo.`,
      "SYSTEM_ALERT",
      2,
      { resourceType: "WORK_ORDER", resourceId: newWorkOrderId },
    );
  }

  return newWorkOrderId;
}

// ─── Submit Checklist (chờ TC) ───────────────────────────────────────────────

/**
 * Nộp kết quả — trạng thái PENDING, không đổi asset/WO/counter.
 */
export async function submitResult({
  assetId,
  woId,
  templateId,
  readingValue,
  overallStatus,
  evidencePhoto,
  notes,
  details,
  checkerId,
}) {
  const asset = await assetModel.findById(assetId);
  if (!asset) throw createError("Không tìm thấy tài sản", 404);

  // Ảnh minh chứng bắt buộc
  if (!evidencePhoto) {
    throw createError("Vui lòng đính kèm ảnh minh chứng khi nộp checklist.", 400);
  }

  let resolvedWoId = null;
  let linkedWorkOrder = null;
  if (woId != null && woId !== "") {
    const wid = Number(woId);
    if (!Number.isFinite(wid) || wid <= 0) {
      throw createError("WO_ID không hợp lệ", 400);
    }
    const wo = await workOrderModel.findById(wid);
    if (!wo) throw createError("Không tìm thấy phiếu việc", 404);
    if (Number(wo.assetId) !== Number(assetId)) {
      throw createError("Phiếu việc không thuộc tài sản này", 400);
    }
    const woSource = String(wo.woSource || "").toUpperCase();
    const isScheduleWo =
      woSource === "SCHEDULE" ||
      woSource === "PREDICTIVE_SCHEDULE" ||
      (woSource === "PREDICTIVE" && wo.scheduleId != null);
    if (!isScheduleWo) {
      throw createError(
        "Chỉ được gắn checklist với phiếu tạo từ lịch bảo trì định kỳ hoặc lịch dự báo.",
        400,
      );
    }
    if (wo.scheduleId == null) {
      throw createError("Phiếu không gắn lịch — không hợp lệ cho checklist định kỳ", 400);
    }
    if (String(wo.status).toUpperCase() === "CANCELLED") {
      throw createError("Phiếu việc đã hủy — không nộp checklist gắn phiếu này", 400);
    }
    const slot = await scheduledChecklistSlotModel.findByWorkOrderId(wid);
    if (!slot) {
      throw createError(
        "Phiếu này chưa có yêu cầu checklist từ lịch. Liên hệ quản trị để đồng bộ lại slot checklist.",
        409,
      );
    }
    if (!["OPEN", "OVERDUE"].includes(String(slot.status).toUpperCase())) {
      throw createError("Checklist của phiếu này đã được thực hiện trước đó.", 409);
    }
    if (woSource === "PREDICTIVE_SCHEDULE" || woSource === "PREDICTIVE") {
      const today = new Date().toISOString().split("T")[0];
      const dueDate = String(slot.dueDate || "").slice(0, 10);
      if (!dueDate || dueDate !== today) {
        throw createError(
          `Checklist dự báo chỉ được thực hiện trong ngày đến hạn (${dueDate || "không xác định"}).`,
          400,
        );
      }
    }
    resolvedWoId = wid;
    linkedWorkOrder = wo;
  }

  if (readingValue != null && readingValue !== "") {
    const rv = Number(readingValue);
    if (!Number.isFinite(rv) || rv < 0) {
      throw createError("Giá trị đồng hồ phải là số ≥ 0", 400);
    }
    const counterRow = await counterModel.findByAsset(assetId);
    const last = Number(counterRow?.lastReadingValue ?? 0);
    if (rv < last) {
      throw createError(
        `Giá trị đồng hồ phải ≥ ${last} giờ (đã lưu lần trước; không được nhỏ hơn).`,
        400,
      );
    }
  }

  let resolvedTemplateId = null;
  if (templateId != null && templateId !== "") {
    const tid = Number(templateId);
    if (!Number.isFinite(tid) || tid <= 0) {
      throw createError("TemplateID không hợp lệ", 400);
    }
    const t = await templateModel.findById(tid);
    if (!t) throw createError("Không tìm thấy mẫu checklist", 404);
    if (Number(t.assetTypeId) !== Number(asset.assetTypeId)) {
      throw createError("Mẫu checklist không thuộc loại tài sản của thiết bị này", 400);
    }
    resolvedTemplateId = tid;
  } else if (linkedWorkOrder?.scheduleId) {
    const schedule = await maintenanceScheduleModel.findById(linkedWorkOrder.scheduleId);
    resolvedTemplateId = schedule?.checklistTemplateId ?? null;
    if (!resolvedTemplateId) {
      const fallback = await templateModel.findByAssetTypeId(asset.assetTypeId);
      resolvedTemplateId = fallback?.templateId ?? null;
    }
  } else {
    const fallback = await templateModel.findByAssetTypeId(asset.assetTypeId);
    resolvedTemplateId = fallback?.templateId ?? null;
  }

  const enriched = await enrichDetailsForInsert(
    asset.assetTypeId,
    details,
    resolvedTemplateId,
  );

  const checklistId = await resultModel.create({
    assetId,
    woId: resolvedWoId,
    templateId: resolvedTemplateId,
    checkerId,
    overallStatus,
    evidencePhoto,
    notes,
    readingValue,
  });
  if (enriched?.length) {
    await resultModel.createDetails(checklistId, enriched);
  }

  await notifService.notifyManagers(
    `Checklist #${checklistId} chờ TC/TP: ${asset.assetName} — ${overallStatus}. Người nộp ID ${checkerId}.`,
    "APPROVAL_REQUEST",
    3,
    { resourceType: "CHECKLIST", resourceId: checklistId },
  );

  return {
    checklistId,
    overallStatus,
    reviewStatus: "PENDING",
    newWorkOrderId: null,
    message:
      "Đã gửi kết quả. Chờ Trưởng ca / Trưởng phòng xác nhận (OK / Theo dõi / NG) trước khi hệ thống cập nhật tài sản và phiếu việc.",
  };
}

// ─── TC/TP: duyệt / từ chối ───────────────────────────────────────────────────

export async function getPendingReviewResults(limit = 50) {
  return resultModel.findPendingReview(limit);
}

/** Trưởng ca (3) + Trưởng/Phó phòng bảo trì (6,8) xử lý tiếp nhận; không tuyến PKT. */
const PID_CHECKLIST_REVIEW = new Set([3, 6, 8]);

export async function reviewChecklistResult(
  checklistId,
  { supervisorId, supervisorPositionId, decision, supervisorNotes },
) {
  const pid = Number(supervisorPositionId);
  if (!PID_CHECKLIST_REVIEW.has(pid)) {
    throw createError("Chỉ Trưởng ca / Trưởng phòng bảo trì (hoặc phó tương ứng) xác nhận checklist tại trường này", 403);
  }
  const row = await resultModel.findById(checklistId);
  if (!row) throw createError("Không tìm thấy kết quả checklist", 404);
  if (row.reviewStatus !== "PENDING") {
    throw createError("Kết quả này đã được xử lý", 409);
  }

  const dec = String(decision || "").toUpperCase();
  if (dec === "REJECT") {
    const n = await resultModel.setReviewOutcome(checklistId, {
      reviewStatus: "REJECTED",
      reviewedBy: supervisorId,
      supervisorNotes,
    });
    if (!n) throw createError("Không thể từ chối (đã xử lý?)", 409);
    await notifService.send(
      row.checkerId,
      `Giám sát từ chối checklist #${checklistId} (${row.assetName}). ${supervisorNotes ? `Lý do: ${supervisorNotes}` : ""}`,
      "SYSTEM_ALERT",
      { resourceType: "CHECKLIST", resourceId: checklistId },
    );
    return { checklistId, reviewStatus: "REJECTED", newWorkOrderId: null };
  }

  if (dec !== "APPROVE") {
    throw createError("decision phải là APPROVE hoặc REJECT", 400);
  }

  const newWorkOrderId = await applyApprovedChecklistEffects({
    checklistId: row.checklistId,
    assetId: row.assetId,
    woId: row.woId,
    checkerId: row.checkerId,
    overallStatus: row.overallStatus,
    readingValue: row.readingValue,
  });

  const updated = await resultModel.setReviewOutcome(checklistId, {
    reviewStatus: "APPROVED",
    reviewedBy: supervisorId,
    supervisorNotes,
  });
  if (!updated) throw createError("Không thể xác nhận (đã xử lý?)", 409);

  if (row.woId != null) {
    await scheduledChecklistSlotModel.fulfillByWorkOrder(
      Number(row.woId),
      checklistId,
    );
  }

  return { checklistId, reviewStatus: "APPROVED", newWorkOrderId };
}

export async function getResultById(id, viewer = {}) {
  const r = await resultModel.findById(id);
  if (!r) throw createError("Không tìm thấy kết quả checklist", 404);

  if (
    isChecklistViewRestrictedWorker(viewer.positionLevel) &&
    viewer.employeeId != null
  ) {
    const mine = Number(r.checkerId) === Number(viewer.employeeId);
    const approved = String(r.reviewStatus).toUpperCase() === "APPROVED";
    if (!mine && !approved) {
      throw createError("Không có quyền xem phiếu checklist này", 403);
    }
  }

  const asset = await assetModel.findById(r.assetId);
  let checklistTemplateName = null;
  let templateItems = [];
  const selectedTemplateId = Number(r.templateId);
  if (selectedTemplateId > 0) {
    const t = mapTemplateForClient(await templateModel.findById(selectedTemplateId));
    checklistTemplateName = t?.templateName ?? null;
    templateItems = t?.items || [];
  } else if (asset?.assetTypeId) {
    // Backward compatibility: checklist cũ chưa lưu TemplateID.
    const head = await templateModel.findByAssetTypeId(asset.assetTypeId);
    if (head) {
      const t = mapTemplateForClient(await templateModel.findById(head.templateId));
      checklistTemplateName = t?.templateName ?? null;
      templateItems = t?.items || [];
    }
  }

  const details = (r.details || []).map((d) => {
    const tm = matchTemplateItemForReview(templateItems, d);
    return {
      ...d,
      inputType: DB_INPUT_TO_CLIENT[d.inputType] || d.inputType,
      threshold: thresholdPayloadFromTemplateItem(tm),
    };
  });

  return {
    ...r,
    details,
    checklistTemplateName,
    assetTypeName: asset?.assetTypeName ?? null,
    locationName: asset?.locationName ?? null,
  };
}

export async function getResults(
  {
    page = 1,
    limit = 20,
    checkerId,
    assetId,
    reviewStatus,
  } = {},
  viewer = {},
) {
  const offset = (page - 1) * limit;
  const { getPool } = await import("../config/database.js");
  const conditions = [];
  const params = [];
  const restrict = isChecklistViewRestrictedWorker(viewer.positionLevel);

  if (!restrict && checkerId) {
    conditions.push("cr.CheckerID = ?");
    params.push(checkerId);
  }
  if (assetId) {
    conditions.push("cr.AssetID = ?");
    params.push(assetId);
  }
  if (reviewStatus) {
    conditions.push("cr.ReviewStatus = ?");
    params.push(reviewStatus);
  }
  if (restrict && viewer.employeeId != null) {
    conditions.push("(cr.ReviewStatus = 'APPROVED' OR cr.CheckerID = ?)");
    params.push(Number(viewer.employeeId));
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [[{ total }]] = await getPool().query(
    `SELECT COUNT(*) AS total FROM ChecklistResults cr ${where}`,
    params,
  );
  const [rows] = await getPool().query(
    `SELECT cr.ChecklistID AS checklistId, cr.AssetID AS assetId,
            a.AssetName AS assetName, cr.OverallStatus AS overallStatus,
            cr.CheckTime AS checkTime, cr.Notes AS notes,
            cr.ReviewStatus AS reviewStatus, cr.ReviewedAt AS reviewedAt,
            cr.CheckerID AS checkerId,
            e.FullName AS checkerName
     FROM ChecklistResults cr
     LEFT JOIN Assets a    ON a.AssetID   = cr.AssetID
     LEFT JOIN Employees e ON e.EmployeeID = cr.CheckerID
     ${where}
     ORDER BY cr.CheckTime DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)],
  );
  return { items: rows, total, page: Number(page), limit: Number(limit) };
}

export async function getResultsByAsset(assetId, limit = 20, viewer = {}) {
  const asset = await assetModel.findById(assetId);
  if (!asset) throw createError("Không tìm thấy tài sản", 404);
  return resultModel.findByAssetVisibleTo(assetId, limit, {
    employeeId: viewer.employeeId,
    positionLevel: viewer.positionLevel,
  });
}
