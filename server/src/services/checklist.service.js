/**
 * checklist.service.js — Luồng kiểm tra hiện trường (BFD mục 3 + §5 quản lý mẫu theo loại).
 *
 * Gửi checklist: lưu kết quả + chi tiết, ReviewStatus=PENDING — KHÔNG đổi tài sản / WO / bộ đếm.
 * Trưởng ca / Trưởng phòng duyệt (APPROVE): mới chạy logic theo OverallStatus:
 *   OK      → AVAILABLE, đóng WO (nếu có) + đồng bộ bảo trì
 *   WARNING → MONITORING, WO PREDICTIVE HIGH + thông báo
 *   NG      → BROKEN, WO CORRECTIVE EMERGENCY + thông báo
 * Đồng hồ giờ chạy (recordReading) chỉ gọi khi APPROVE.
 *
 * REJECT: giữ nguyên tài sản, thông báo cho người nộp.
 *
 * Liên quan: workOrder.service.js, assetCounter.service.js, notification.service.js,
 *            models/checklistResult.model.js.
 *
 * getResultById: bổ sung checklistTemplateName, assetTypeName, locationName và threshold từng câu (màn duyệt).
 * getQRInfo: kèm runtimeCounter (đồng hồ máy, tích lũy delta, mốc LastMaintenanceTotal…) để form checklist hiển thị rõ và chặn nhập < lần trước.
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
async function enrichDetailsForInsert(assetTypeId, details) {
  if (!details?.length) return details;
  const template = await templateModel.findByAssetTypeId(assetTypeId);
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
  const existing = await templateModel.findAll(typeId);
  if (existing.length > 0) {
    throw createError(
      "Loại tài sản này đã có mẫu checklist. Chỉ được một mẫu / loại — mở chỉnh sửa mẫu hiện có.",
      409,
    );
  }
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

  const template = await templateModel.findByAssetTypeId(asset.assetTypeId);
  const checklistTemplate = template
    ? mapTemplateForClient(await templateModel.findById(template.templateId))
    : null;

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

  return {
    asset,
    checklistTemplate,
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
    await assetModel.updateStatus(assetId, "AVAILABLE");
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
  readingValue,
  overallStatus,
  evidencePhoto,
  notes,
  details,
  checkerId,
}) {
  const asset = await assetModel.findById(assetId);
  if (!asset) throw createError("Không tìm thấy tài sản", 404);

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

  const enriched = await enrichDetailsForInsert(asset.assetTypeId, details);

  const checklistId = await resultModel.create({
    assetId,
    woId,
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
    "SYSTEM_ALERT",
    3,
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

export async function reviewChecklistResult(
  checklistId,
  { supervisorId, decision, supervisorNotes },
) {
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
  if (asset?.assetTypeId) {
    const head = await templateModel.findByAssetTypeId(asset.assetTypeId);
    if (head) {
      const t = mapTemplateForClient(
        await templateModel.findById(head.templateId),
      );
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
