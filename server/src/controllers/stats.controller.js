/**
 * stats.controller.js — Dashboard / Báo cáo tổng hợp.
 * project.rule Phân hệ 6: Báo cáo hiệu suất, thống kê Checklist & Phê duyệt.
 * GET /api/stats           — summary counts
 * GET /api/stats/checklist — tỷ lệ NG/WARNING/OK theo thời gian
 * GET /api/stats/workorders — phiếu việc theo trạng thái
 * GET /api/stats/assets    — tài sản theo trạng thái
 * Liên quan: routes/stats.routes.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { getPool } from '../config/database.js';

/** Tổng hợp nhanh cho dashboard */
export const summary = asyncHandler(async (_req, res) => {
  const pool = getPool();
  const [[assets]]     = await pool.query(`SELECT
    COUNT(*) AS total,
    SUM(Status = 'AVAILABLE')     AS available,
    SUM(Status = 'MAINTENANCE')   AS maintenance,
    SUM(Status = 'BROKEN')        AS broken,
    SUM(Status = 'CAUTION')       AS caution,
    SUM(Status = 'DECOMMISSIONED') AS decommissioned
  FROM Assets`);

  const [[workOrders]] = await pool.query(`SELECT
    COUNT(*) AS total,
    SUM(Status = 'PENDING_APPROVAL') AS pendingApproval,
    SUM(Status = 'WAITING')          AS waiting,
    SUM(Status = 'IN_PROGRESS')      AS inProgress,
    SUM(Status = 'COMPLETED')        AS completed,
    SUM(Status = 'CANCELLED')        AS cancelled
  FROM WorkOrders`);

  const [[checklists]] = await pool.query(`SELECT
    COUNT(*) AS total,
    SUM(OverallStatus = 'OK')      AS ok,
    SUM(OverallStatus = 'WARNING') AS warning,
    SUM(OverallStatus = 'NG')      AS ng
  FROM ChecklistResults
  WHERE CheckTime >= DATE_SUB(NOW(), INTERVAL 30 DAY)`);

  const [[pendingApprovals]] = await pool.query(
    `SELECT COUNT(*) AS count FROM ApprovalLogs WHERE Status = 'PENDING'`,
  );

  const [[digitalAssets]] = await pool.query(`SELECT
    COUNT(*) AS total,
    SUM(Status = 'APPROVED')  AS approved,
    SUM(Status = 'PENDING')   AS pending,
    SUM(Status = 'DRAFT')     AS draft
  FROM DigitalAssets`);

  return ok(res, {
    assets,
    workOrders,
    checklistsLast30Days: checklists,
    pendingApprovals:     pendingApprovals.count,
    digitalAssets,
  });
});

/** Tỷ lệ OK/WARNING/NG theo ngày (30 ngày gần nhất) */
export const checklistTrend = asyncHandler(async (_req, res) => {
  const pool = getPool();
  const [rows] = await pool.query(`
    SELECT
      DATE(CheckTime)            AS date,
      SUM(OverallStatus = 'OK')      AS ok,
      SUM(OverallStatus = 'WARNING') AS warning,
      SUM(OverallStatus = 'NG')      AS ng,
      COUNT(*)                       AS total
    FROM ChecklistResults
    WHERE CheckTime >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY DATE(CheckTime)
    ORDER BY date ASC
  `);
  return ok(res, rows);
});

/** Top tài sản có nhiều NG/WARNING nhất */
export const topFaultyAssets = asyncHandler(async (req, res) => {
  const pool = getPool();
  const limit = Math.min(parseInt(req.query.limit || 10), 50);
  const [rows] = await pool.query(`
    SELECT
      cr.AssetID       AS assetId,
      a.AssetName      AS assetName,
      a.Location       AS location,
      SUM(cr.OverallStatus = 'NG')      AS ngCount,
      SUM(cr.OverallStatus = 'WARNING') AS warningCount,
      COUNT(*)                          AS totalChecks
    FROM ChecklistResults cr
    JOIN Assets a ON cr.AssetID = a.AssetID
    WHERE cr.CheckTime >= DATE_SUB(NOW(), INTERVAL 90 DAY)
    GROUP BY cr.AssetID, a.AssetName, a.Location
    ORDER BY ngCount DESC, warningCount DESC
    LIMIT ?
  `, [limit]);
  return ok(res, rows);
});

/** BFD 6.3 — Báo cáo sử dụng tài nguyên số */
export const digitalAssetReport = asyncHandler(async (_req, res) => {
  const pool = getPool();

  // Phân bố trạng thái
  const [[statusSummary]] = await pool.query(`
    SELECT
      COUNT(*) AS total,
      SUM(Status = 'DRAFT')     AS draft,
      SUM(Status = 'PENDING')   AS pending,
      SUM(Status = 'APPROVED')  AS approved,
      SUM(Status = 'REJECTED')  AS rejected,
      SUM(Status = 'ARCHIVED')  AS archived
    FROM DigitalAssets
  `);

  // Upload theo tháng (6 tháng gần nhất)
  const [uploadTrend] = await pool.query(`
    SELECT
      DATE_FORMAT(UploadDate, '%Y-%m') AS month,
      COUNT(*) AS count
    FROM DigitalAssets
    WHERE UploadDate >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
    GROUP BY DATE_FORMAT(UploadDate, '%Y-%m')
    ORDER BY month ASC
  `);

  // Tài liệu có nhiều phiên bản nhất (tài liệu được cập nhật nhiều)
  const [mostVersioned] = await pool.query(`
    SELECT da.DigitalAssetID AS digitalAssetId, da.FileName AS fileName,
           da.CurrentVersion AS currentVersion, a.AssetName AS assetName
    FROM DigitalAssets da
    LEFT JOIN Assets a ON a.AssetID = da.AssetID
    ORDER BY da.CurrentVersion DESC
    LIMIT 10
  `);

  // Tài liệu cũ chưa cập nhật (> 180 ngày, vẫn APPROVED)
  const [staleDocuments] = await pool.query(`
    SELECT da.DigitalAssetID AS digitalAssetId, da.FileName AS fileName,
           da.CurrentVersion AS currentVersion, da.UploadDate AS uploadDate,
           a.AssetName AS assetName,
           DATEDIFF(NOW(), da.UploadDate) AS daysSinceUpload
    FROM DigitalAssets da
    LEFT JOIN Assets a ON a.AssetID = da.AssetID
    WHERE da.Status = 'APPROVED'
      AND da.UploadDate < DATE_SUB(NOW(), INTERVAL 180 DAY)
    ORDER BY daysSinceUpload DESC
    LIMIT 20
  `);

  return ok(res, { statusSummary, uploadTrend, mostVersioned, staleDocuments });
});

/** Phiếu việc hoàn thành theo tuần (12 tuần gần nhất) */
export const workOrderCompletion = asyncHandler(async (_req, res) => {
  const pool = getPool();
  const [rows] = await pool.query(`
    SELECT
      YEARWEEK(ActualDate, 1) AS yearWeek,
      MIN(ActualDate)         AS weekStart,
      COUNT(*)                AS completed
    FROM WorkOrders
    WHERE Status = 'COMPLETED'
      AND ActualDate >= DATE_SUB(NOW(), INTERVAL 12 WEEK)
    GROUP BY YEARWEEK(ActualDate, 1)
    ORDER BY yearWeek ASC
  `);
  return ok(res, rows);
});
