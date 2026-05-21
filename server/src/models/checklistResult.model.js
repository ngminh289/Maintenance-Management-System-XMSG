/**
 * checklistResult.model.js — SQL thuần cho ChecklistResults + ChecklistDetails.
 * BFD mục 3: ReviewStatus (PENDING → APPROVED/REJECTED) sau khi Trưởng ca xử lý.
 * Không còn cột PartsNotes (đã bỏ — migration 033); vật tư ghi trên WO / AssetMaintenanceHistory.
 * findRecentApprovedByAsset: 3 bản ghi gần nhất cho tham khảo trên phiếu việc.
 * findLatestByWorkOrderId: bản checklist mới nhất gắn WO (mọi ReviewStatus) — hiển thị trên chi tiết WO khi đồng đội đã nộp.
 * Dùng trong: services/checklist.service.js, workOrder.service.js.
 */
import { getPool } from '../config/database.js';

export async function create({
  assetId,
  woId,
  templateId,
  checkerId,
  overallStatus,
  evidencePhoto,
  notes,
  readingValue,
}) {
  const [result] = await getPool().query(
    `INSERT INTO ChecklistResults (AssetID, WO_ID, TemplateID, CheckerID, OverallStatus, EvidencePhoto, Notes, ReadingValue, ReviewStatus)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [
      assetId,
      woId || null,
      templateId ?? null,
      checkerId,
      overallStatus,
      evidencePhoto || null,
      notes || null,
      readingValue ?? null,
    ],
  );
  return result.insertId;
}

export async function createDetails(checklistId, details) {
  if (!details || details.length === 0) return;
  const values = details.map((d) => [checklistId, d.questionText, d.inputType || 'PASS_FAIL', d.answerValue ?? null, d.isOK !== false]);
  await getPool().query(
    'INSERT INTO ChecklistDetails (ChecklistID, QuestionText, InputType, AnswerValue, IsOK) VALUES ?',
    [values],
  );
}

export async function findById(id) {
  const [[result], details] = await Promise.all([
    getPool().query(
      `SELECT cr.ChecklistID AS checklistId, cr.AssetID AS assetId, a.AssetName AS assetName,
              cr.WO_ID AS woId, cr.CheckerID AS checkerId, e.FullName AS checkerName,
              cr.TemplateID AS templateId, ct.TemplateName AS templateName,
              cr.OverallStatus AS overallStatus, cr.EvidencePhoto AS evidencePhoto,
              cr.Notes AS notes, cr.ReadingValue AS readingValue, cr.CheckTime AS checkTime,
              cr.ReviewStatus AS reviewStatus, cr.ReviewedBy AS reviewedBy,
              er.FullName AS reviewerName, cr.ReviewedAt AS reviewedAt,
              cr.SupervisorNotes AS supervisorNotes
       FROM ChecklistResults cr
       JOIN Assets a    ON a.AssetID       = cr.AssetID
       JOIN Employees e ON e.EmployeeID    = cr.CheckerID
       LEFT JOIN ChecklistTemplates ct ON ct.TemplateID = cr.TemplateID
       LEFT JOIN Employees er ON er.EmployeeID = cr.ReviewedBy
       WHERE cr.ChecklistID = ?`,
      [id],
    ).then(([r]) => r),
    getPool().query(
      `SELECT DetailID AS detailId, QuestionText AS questionText, InputType AS inputType,
              AnswerValue AS answerValue, IsOK AS isOK
       FROM ChecklistDetails WHERE ChecklistID = ?`,
      [id],
    ).then(([r]) => r),
  ]);
  if (!result) return null;
  return { ...result, details };
}

export async function findByAsset(assetId, limit = 20) {
  const [rows] = await getPool().query(
    `SELECT cr.ChecklistID AS checklistId, cr.OverallStatus AS overallStatus,
            cr.CheckTime AS checkTime, cr.Notes AS notes, e.FullName AS checkerName,
            cr.ReadingValue AS readingValue, cr.ReviewStatus AS reviewStatus,
            cr.CheckerID AS checkerId, cr.TemplateID AS templateId, ct.TemplateName AS templateName
     FROM ChecklistResults cr
     JOIN Employees e ON e.EmployeeID = cr.CheckerID
     LEFT JOIN ChecklistTemplates ct ON ct.TemplateID = cr.TemplateID
     WHERE cr.AssetID = ? ORDER BY cr.CheckTime DESC LIMIT ?`,
    [assetId, limit],
  );
  return rows;
}

/**
 * Công nhân (level ≤1): chỉ APPROVED (mọi người) + toàn bộ phiếu của mình (mọi ReviewStatus).
 * NVKT+ (level ≥2): giống findByAsset — xem tất cả.
 */
export async function findByAssetVisibleTo(
  assetId,
  limit = 20,
  { employeeId, positionLevel } = {},
) {
  const n = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const lvl = Number(positionLevel) || 0;
  if (lvl >= 2) {
    return findByAsset(assetId, n);
  }
  const [rows] = await getPool().query(
    `SELECT cr.ChecklistID AS checklistId, cr.OverallStatus AS overallStatus,
            cr.CheckTime AS checkTime, cr.Notes AS notes, e.FullName AS checkerName,
            cr.ReadingValue AS readingValue, cr.ReviewStatus AS reviewStatus,
            cr.CheckerID AS checkerId, cr.TemplateID AS templateId, ct.TemplateName AS templateName
     FROM ChecklistResults cr
     JOIN Employees e ON e.EmployeeID = cr.CheckerID
     LEFT JOIN ChecklistTemplates ct ON ct.TemplateID = cr.TemplateID
     WHERE cr.AssetID = ?
       AND (cr.ReviewStatus = 'APPROVED' OR cr.CheckerID = ?)
     ORDER BY cr.CheckTime DESC
     LIMIT ?`,
    [assetId, Number(employeeId), n],
  );
  return rows;
}

/** Chỉ APPROVED — dùng làm tài liệu tham khảo an toàn cho thợ trên phiếu việc. */
/** Bản ghi checklist gắn phiếu WO (mới nhất) — dùng cho banner trên WorkOrderDetail. */
export async function findLatestByWorkOrderId(woId) {
  const wid = Number(woId);
  if (!Number.isFinite(wid) || wid < 1) return null;
  const [rows] = await getPool().query(
    `SELECT cr.ChecklistID AS checklistId, cr.OverallStatus AS overallStatus,
            cr.CheckTime AS checkTime, cr.Notes AS notes, e.FullName AS checkerName,
            cr.ReadingValue AS readingValue, cr.ReviewStatus AS reviewStatus,
            cr.CheckerID AS checkerId, cr.TemplateID AS templateId, ct.TemplateName AS templateName
     FROM ChecklistResults cr
     JOIN Employees e ON e.EmployeeID = cr.CheckerID
     LEFT JOIN ChecklistTemplates ct ON ct.TemplateID = cr.TemplateID
     WHERE cr.WO_ID = ?
     ORDER BY cr.CheckTime DESC
     LIMIT 1`,
    [wid],
  );
  return rows[0] || null;
}

/** Mọi checklist gắn WO (mới nhất trước) — hiển thị nhiều mẫu trên chi tiết phiếu. */
export async function findAllByWorkOrderId(woId) {
  const wid = Number(woId);
  if (!Number.isFinite(wid) || wid < 1) return [];
  const [rows] = await getPool().query(
    `SELECT cr.ChecklistID AS checklistId, cr.OverallStatus AS overallStatus,
            cr.CheckTime AS checkTime, cr.Notes AS notes, e.FullName AS checkerName,
            cr.ReadingValue AS readingValue, cr.ReviewStatus AS reviewStatus,
            cr.CheckerID AS checkerId, cr.TemplateID AS templateId, ct.TemplateName AS templateName
     FROM ChecklistResults cr
     JOIN Employees e ON e.EmployeeID = cr.CheckerID
     LEFT JOIN ChecklistTemplates ct ON ct.TemplateID = cr.TemplateID
     WHERE cr.WO_ID = ?
     ORDER BY ct.TemplateName ASC, cr.CheckTime DESC`,
    [wid],
  );
  return rows;
}

export async function findRecentApprovedByAsset(assetId, limit = 3) {
  const n = Math.min(Math.max(Number(limit) || 3, 1), 10);
  const [rows] = await getPool().query(
    `SELECT cr.ChecklistID AS checklistId, cr.OverallStatus AS overallStatus,
            cr.CheckTime AS checkTime, cr.Notes AS notes, e.FullName AS checkerName,
            cr.ReadingValue AS readingValue, cr.TemplateID AS templateId, ct.TemplateName AS templateName
     FROM ChecklistResults cr
     JOIN Employees e ON e.EmployeeID = cr.CheckerID
     LEFT JOIN ChecklistTemplates ct ON ct.TemplateID = cr.TemplateID
     WHERE cr.AssetID = ? AND cr.ReviewStatus = 'APPROVED'
     ORDER BY cr.CheckTime DESC
     LIMIT ?`,
    [assetId, n],
  );
  return rows;
}

export async function setReviewOutcome(checklistId, { reviewStatus, reviewedBy, supervisorNotes }) {
  const [r] = await getPool().query(
    `UPDATE ChecklistResults
     SET ReviewStatus = ?, ReviewedBy = ?, ReviewedAt = NOW(), SupervisorNotes = ?
     WHERE ChecklistID = ? AND ReviewStatus = 'PENDING'`,
    [reviewStatus, reviewedBy, supervisorNotes ?? null, checklistId],
  );
  return r.affectedRows;
}

export async function findPendingReview(limit = 50) {
  const [rows] = await getPool().query(
    `SELECT cr.ChecklistID AS checklistId, cr.AssetID AS assetId, a.AssetName AS assetName,
            cr.OverallStatus AS overallStatus, cr.CheckTime AS checkTime,
            cr.Notes AS notes, cr.ReadingValue AS readingValue,
            cr.CheckerID AS checkerId, e.FullName AS checkerName,
            cr.TemplateID AS templateId, ct.TemplateName AS templateName
     FROM ChecklistResults cr
     JOIN Assets a ON a.AssetID = cr.AssetID
     JOIN Employees e ON e.EmployeeID = cr.CheckerID
     LEFT JOIN ChecklistTemplates ct ON ct.TemplateID = cr.TemplateID
     WHERE cr.ReviewStatus = 'PENDING'
     ORDER BY cr.CheckTime ASC
     LIMIT ?`,
    [Number(limit)],
  );
  return rows;
}
