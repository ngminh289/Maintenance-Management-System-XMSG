/**
 * stats.controller.js — Dashboard / Báo cáo tổng hợp.
 * project.rule Phân hệ 6: Báo cáo hiệu suất, thống kê Checklist & Phê duyệt.
 * GET /api/stats                — summary counts
 * GET /api/stats/checklist-trend — tỷ lệ NG/WARNING/OK theo thời gian
 * GET /api/stats/top-faulty      — top tài sản hay hỏng
 * GET /api/stats/wo-completion   — phiếu việc hoàn thành theo tuần
 * GET /api/stats/digital-assets  — báo cáo tài nguyên số
 * GET /api/stats/performance     — BFD 6.4: MTBF, MTTR, Downtime, Kế hoạch vs Thực tế, Pareto
 * GET /api/stats/approval-step-latencies — thời gian giữa các bước phê duyệt (ApprovalLogs); RBAC: TP + Ban GĐ.
 * GET /api/stats/checklist-ng-by-asset   — xu hướng NG theo ngày / theo thiết bị; RBAC: TP + Ban GĐ.
 * GET /api/stats/checklist-schedule-compliance — tỷ lệ slot; RBAC: TP + Ban GĐ.
 * GET /api/stats/resource-usage — 6 báo cáo sử dụng tài nguyên; RBAC: CV KTS (L2), Trưởng phòng, Ban GĐ.
 * Liên quan: routes/stats.routes.js.
 */
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import { getPool } from "../config/database.js";
import * as scheduledChecklistSlotModel from "../models/scheduledChecklistSlot.model.js";

const APPROVAL_TERMINAL = new Set(["APPROVED", "REJECTED", "REQUEST_CHANGES"]);
const toInt = (v) => Number(v ?? 0) || 0;

function sqlDateKey(v) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** Tổng hợp nhanh cho dashboard */
export const summary = asyncHandler(async (_req, res) => {
  const pool = getPool();
  const [[assets]] = await pool.query(`SELECT
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
    SUM(Status = 'AWAITING_CLOSURE') AS awaitingClosure,
    SUM(Status = 'COMPLETED')        AS completed,
    SUM(Status = 'CANCELLED')        AS cancelled
  FROM WorkOrders
  WHERE IsDeleted = 0`);

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
    assets: {
      total: toInt(assets.total),
      available: toInt(assets.available),
      maintenance: toInt(assets.maintenance),
      broken: toInt(assets.broken),
      caution: toInt(assets.caution),
      decommissioned: toInt(assets.decommissioned),
    },
    workOrders: {
      total: toInt(workOrders.total),
      pendingApproval: toInt(workOrders.pendingApproval),
      waiting: toInt(workOrders.waiting),
      inProgress: toInt(workOrders.inProgress),
      awaitingClosure: toInt(workOrders.awaitingClosure),
      completed: toInt(workOrders.completed),
      cancelled: toInt(workOrders.cancelled),
    },
    checklistsLast30Days: {
      total: toInt(checklists.total),
      ok: toInt(checklists.ok),
      warning: toInt(checklists.warning),
      ng: toInt(checklists.ng),
    },
    pendingApprovals: toInt(pendingApprovals.count),
    digitalAssets: {
      total: toInt(digitalAssets.total),
      approved: toInt(digitalAssets.approved),
      pending: toInt(digitalAssets.pending),
      draft: toInt(digitalAssets.draft),
    },
  });
});

/**
 * Tỷ lệ hoàn thành checklist định kỳ: FULFILLED / tổng slot (WO từ lịch) trong kỳ DueDate.
 * Slot tạo khi generateWorkOrder; Fulfilled khi TC/TP duyệt APPROVE checklist gắn WO.
 */
export const checklistScheduleCompliance = asyncHandler(async (req, res) => {
  const months = Math.min(Math.max(parseInt(req.query.months || 12), 1), 36);
  await scheduledChecklistSlotModel.refreshOverdueStatus();
  const data = await scheduledChecklistSlotModel.aggregateCompliance({
    months,
  });
  return ok(res, {
    ...data,
    businessDefinition: {
      metric: "Tỷ lệ hoàn thành checklist định kỳ",
      numerator:
        "Số lượt đã hoàn thành đúng lịch: slot ScheduledChecklistSlots trạng thái FULFILLED (đã gắn ChecklistID sau khi TC/TP duyệt APPROVED).",
      denominator:
        "Tổng số lượt yêu cầu trong kỳ: mọi slot có DueDate trong khoảng thời gian chọn (OPEN / OVERDUE / FULFILLED / WAIVED).",
      formula: "(fulfilledSlots / totalSlots) × 100%",
      note: "Mỗi lượt = một dòng ScheduledChecklistSlots (một mẫu checklist trên một WO từ lịch; lịch N mẫu → N slot/phiếu). Không dùng COUNT(ChecklistResults) làm mẫu số.",
    },
  });
});

/**
 * Thời gian giữa hai bước phê duyệt liên tiếp (cùng ResourceID + ResourceType),
 * tính bằng hiệu ActionDate: log bước k (đã APPROVED) → log bước k+1 (trạng thái kết thúc).
 * Lưu ý: khi gửi duyệt, bản ghi bước 1 ghi nhận thời điểm; khi duyệt xong ActionDate được cập nhật —
 * chênh lệch giữa hai bước phản ánh thời gian chờ/xử lý từ lúc cấp trước quyết định đến lúc cấp sau quyết định.
 */
export const approvalStepLatencies = asyncHandler(async (req, res) => {
  const months = Math.min(Math.max(parseInt(req.query.months || 12), 1), 36);
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT LogID AS logId, ResourceID AS resourceId, ResourceType AS resourceType,
            WorkflowID AS workflowId, CurrentLevel AS currentLevel, Status AS status,
            ActionDate AS actionDate
     FROM ApprovalLogs
     WHERE ActionDate >= DATE_SUB(NOW(), INTERVAL ? MONTH)
     ORDER BY ResourceID ASC, ResourceType ASC, LogID ASC`,
    [months],
  );

  const byKey = new Map();
  for (const r of rows) {
    const k = `${r.resourceType}:${r.resourceId}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(r);
  }

  const samples = [];
  for (const chain of byKey.values()) {
    for (let i = 0; i < chain.length - 1; i += 1) {
      const a = chain[i];
      const b = chain[i + 1];
      if (Number(a.currentLevel) + 1 !== Number(b.currentLevel)) continue;
      if (a.status !== "APPROVED") continue;
      if (!APPROVAL_TERMINAL.has(b.status)) continue;
      const t0 = new Date(a.actionDate).getTime();
      const t1 = new Date(b.actionDate).getTime();
      if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 < t0) continue;
      const hours = (t1 - t0) / 3600000;
      samples.push({
        resourceType: a.resourceType,
        resourceId: a.resourceId,
        fromLevel: Number(a.currentLevel),
        toLevel: Number(b.currentLevel),
        toStatus: b.status,
        hoursBetween: Math.round(hours * 100) / 100,
      });
    }
  }

  const avgHours =
    samples.length > 0
      ? Math.round(
          (samples.reduce((s, x) => s + x.hoursBetween, 0) / samples.length) *
            100,
        ) / 100
      : null;

  const byResourceTypeMap = new Map();
  for (const s of samples) {
    if (!byResourceTypeMap.has(s.resourceType))
      byResourceTypeMap.set(s.resourceType, []);
    byResourceTypeMap.get(s.resourceType).push(s.hoursBetween);
  }
  const byResourceType = [...byResourceTypeMap.entries()].map(
    ([resourceType, arr]) => ({
      resourceType,
      transitionCount: arr.length,
      avgHoursBetween:
        Math.round((arr.reduce((x, y) => x + y, 0) / arr.length) * 100) / 100,
    }),
  );

  return ok(res, {
    months,
    summary: {
      transitionCount: samples.length,
      avgHoursBetweenSteps: avgHours,
    },
    byResourceType,
    samples: samples.slice(-200),
  });
});

/** Số phiếu NG theo ngày, tách theo thiết bị (top N thiết bị hay NG nhất trong kỳ). */
export const checklistNgTrendByAsset = asyncHandler(async (req, res) => {
  const months = Math.min(Math.max(parseInt(req.query.months || 6), 1), 36);
  const topN = Math.min(Math.max(parseInt(req.query.topAssets || 5), 1), 15);
  const pool = getPool();

  const [topAssets] = await pool.query(
    `SELECT cr.AssetID AS assetId, a.AssetName AS assetName, COUNT(*) AS totalNg
     FROM ChecklistResults cr
     INNER JOIN Assets a ON a.AssetID = cr.AssetID
     WHERE cr.OverallStatus = 'NG'
       AND cr.CheckTime >= DATE_SUB(NOW(), INTERVAL ? MONTH)
     GROUP BY cr.AssetID, a.AssetName
     ORDER BY totalNg DESC
     LIMIT ?`,
    [months, topN],
  );

  if (!topAssets.length) {
    return ok(res, {
      months,
      topAssets: [],
      chartRows: [],
      businessDefinition: {
        metric: "Xu hướng lỗi NG theo thiết bị",
        formula:
          "Với mỗi ngày D và tài sản A: count(ChecklistResults WHERE OverallStatus = «NG» AND DATE(CheckTime)=D AND AssetID=A).",
        note: "Chỉ vẽ top thiết bị có tổng NG cao nhất trong kỳ để biểu đồ đọc được.",
      },
    });
  }

  const ids = topAssets.map((r) => r.assetId);
  const placeholders = ids.map(() => "?").join(",");
  const [daily] = await pool.query(
    `SELECT DATE(cr.CheckTime) AS d, cr.AssetID AS assetId, COUNT(*) AS ngCount
     FROM ChecklistResults cr
     WHERE cr.OverallStatus = 'NG'
       AND cr.CheckTime >= DATE_SUB(NOW(), INTERVAL ? MONTH)
       AND cr.AssetID IN (${placeholders})
     GROUP BY DATE(cr.CheckTime), cr.AssetID
     ORDER BY d ASC`,
    [months, ...ids],
  );

  const daySet = new Set();
  for (const r of daily) daySet.add(sqlDateKey(r.d));
  const dayList = [...daySet].sort();

  const combo = new Map();
  for (const r of daily) {
    const dk = sqlDateKey(r.d);
    combo.set(`${dk}:${r.assetId}`, Number(r.ngCount));
  }

  const chartRows = dayList.map((day) => {
    const row = { day };
    for (const a of topAssets) {
      row[`a${a.assetId}`] = combo.get(`${day}:${a.assetId}`) ?? 0;
    }
    return row;
  });

  return ok(res, {
    months,
    topAssets: topAssets.map((r) => ({
      assetId: r.assetId,
      assetName: r.assetName,
      totalNg: Number(r.totalNg),
    })),
    chartRows,
    businessDefinition: {
      metric: "Xu hướng lỗi NG theo thiết bị",
      formula:
        "Mỗi điểm: số phiếu ChecklistResults có OverallStatus = NG trong ngày, theo từng AssetID.",
      note: `Top ${topN} thiết bị theo tổng NG trong ${months} tháng gần nhất.`,
    },
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
  const [rows] = await pool.query(
    `
    SELECT
      cr.AssetID       AS assetId,
      a.AssetName      AS assetName,
      l.LocationName   AS location,
      SUM(cr.OverallStatus = 'NG')      AS ngCount,
      SUM(cr.OverallStatus = 'WARNING') AS warningCount,
      COUNT(*)                          AS totalChecks
    FROM ChecklistResults cr
    JOIN Assets a ON cr.AssetID = a.AssetID
    LEFT JOIN Locations l ON l.LocationID = a.LocationID
    WHERE cr.CheckTime >= DATE_SUB(NOW(), INTERVAL 90 DAY)
    GROUP BY cr.AssetID, a.AssetName, l.LocationName
    ORDER BY ngCount DESC, warningCount DESC
    LIMIT ?
  `,
    [limit],
  );
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

/**
 * BFD 6.4 — Báo cáo hiệu suất & tình trạng tài sản.
 * ?months=12 (mặc định) — khoảng thời gian phân tích.
 * Trả về: mtbf, mttr, downtime (kèm logs), planVsActual, pareto.
 * RBAC: CV KTS (L2), Trưởng phòng (L3, PID 6), Giám đốc (L5+) — kiểm tra tại route.
 */
export const performanceReport = asyncHandler(async (req, res) => {
  const pool = getPool();
  const months = Math.min(Math.max(parseInt(req.query.months || 12), 1), 36);
  const parsedEmployeeId = Number(req.query.employeeId);
  const employeeFilterId =
    Number.isFinite(parsedEmployeeId) && parsedEmployeeId > 0
      ? parsedEmployeeId
      : null;
  const planTypeRaw = String(req.query.planType || "ALL").toUpperCase();
  const planType = ["ALL", "PERIODIC", "PREDICTIVE", "EMERGENCY"].includes(
    planTypeRaw,
  )
    ? planTypeRaw
    : "ALL";

  // ── 1. MTBF — trung bình giờ chạy giữa 2 lần hỏng EMERGENCY ──────────────
  const [mtbfRows] = await pool.query(
    `
    SELECT
      a.AssetID       AS assetId,
      a.AssetName     AS assetName,
      l.LocationName  AS locationName,
      COALESCE(rt.totalRunHours, 0)   AS totalRunHours,
      COALESCE(f.failureCount,  0)    AS failureCount,
      CASE
        WHEN COALESCE(f.failureCount, 0) > 0 AND COALESCE(rt.totalRunHours, 0) > 0
          THEN ROUND(rt.totalRunHours / f.failureCount, 2)
        ELSE NULL
      END AS mtbf
    FROM Assets a
    LEFT JOIN Locations l ON l.LocationID = a.LocationID
    LEFT JOIN (
      SELECT AssetID, SUM(DeltaHours) AS totalRunHours
      FROM AssetRuntimeLogs
      WHERE CaptureTime >= DATE_SUB(NOW(), INTERVAL ? MONTH)
      GROUP BY AssetID
    ) rt ON rt.AssetID = a.AssetID
    LEFT JOIN (
      SELECT AssetID, COUNT(*) AS failureCount
      FROM WorkOrders
      WHERE Priority = 'EMERGENCY' AND Status = 'COMPLETED' AND IsDeleted = 0
        AND ActualDate >= DATE_SUB(NOW(), INTERVAL ? MONTH)
      GROUP BY AssetID
    ) f ON f.AssetID = a.AssetID
    WHERE a.Status != 'DECOMMISSIONED'
      AND (COALESCE(rt.totalRunHours, 0) > 0 OR COALESCE(f.failureCount, 0) > 0)
    ORDER BY f.failureCount DESC, rt.totalRunHours DESC
    LIMIT 20
  `,
    [months, months],
  );

  const totalRunAll = mtbfRows.reduce((s, r) => s + Number(r.totalRunHours), 0);
  const totalFailureAll = mtbfRows.reduce(
    (s, r) => s + Number(r.failureCount),
    0,
  );
  const mtbfOverall =
    totalFailureAll > 0
      ? Math.round((totalRunAll / totalFailureAll) * 100) / 100
      : null;

  // ── 2. MTTR — trung bình giờ sửa một phiếu CORRECTIVE ────────────────────
  const [mttrRows] = await pool.query(
    `
    SELECT
      a.AssetID       AS assetId,
      a.AssetName     AS assetName,
      l.LocationName  AS locationName,
      COALESCE(rp.repairCount, 0)        AS repairCount,
      COALESCE(rp.totalRepairHours, 0)   AS totalRepairHours,
      CASE
        WHEN COALESCE(rp.repairCount, 0) > 0
          THEN ROUND(rp.totalRepairHours / rp.repairCount, 2)
        ELSE NULL
      END AS mttr
    FROM Assets a
    LEFT JOIN Locations l ON l.LocationID = a.LocationID
    LEFT JOIN (
      SELECT AssetID,
             COUNT(*)          AS repairCount,
             SUM(ActualHours)  AS totalRepairHours
      FROM WorkOrders
      WHERE WO_Source = 'CORRECTIVE' AND Status = 'COMPLETED' AND IsDeleted = 0
        AND ActualHours IS NOT NULL
        AND ActualDate >= DATE_SUB(NOW(), INTERVAL ? MONTH)
      GROUP BY AssetID
    ) rp ON rp.AssetID = a.AssetID
    WHERE a.Status != 'DECOMMISSIONED' AND COALESCE(rp.repairCount, 0) > 0
    ORDER BY mttr DESC
    LIMIT 20
  `,
    [months],
  );

  const totalRepairAll = mttrRows.reduce(
    (s, r) => s + Number(r.totalRepairHours),
    0,
  );
  const totalRepairCnt = mttrRows.reduce(
    (s, r) => s + Number(r.repairCount),
    0,
  );
  const mttrOverall =
    totalRepairCnt > 0
      ? Math.round((totalRepairAll / totalRepairCnt) * 100) / 100
      : null;

  // ── 3. Tỷ lệ dừng máy — chuẩn theo AssetDowntimeEvents (planned + unplanned) ──
  const [downtimeRows] = await pool.query(
    `
    SELECT
      a.AssetID       AS assetId,
      a.AssetName     AS assetName,
      l.LocationName  AS locationName,
      COALESCE(rt.totalRunHours,   0) AS totalRunHours,
      COALESCE(dt.totalDowntimeHours, 0) AS downtimeHours,
      COALESCE(dt.plannedHours, 0) AS plannedDowntimeHours,
      COALESCE(dt.unplannedHours, 0) AS unplannedDowntimeHours,
      CASE
        WHEN (COALESCE(rt.totalRunHours, 0) + COALESCE(dt.totalDowntimeHours, 0)) > 0
          THEN ROUND(
            COALESCE(dt.totalDowntimeHours, 0) /
            (COALESCE(rt.totalRunHours, 0) + COALESCE(dt.totalDowntimeHours, 0)) * 100,
            2
          )
        ELSE 0
      END AS downtimePercent
    FROM Assets a
    LEFT JOIN Locations l ON l.LocationID = a.LocationID
    LEFT JOIN (
      SELECT AssetID, SUM(DeltaHours) AS totalRunHours
      FROM AssetRuntimeLogs
      WHERE CaptureTime >= DATE_SUB(NOW(), INTERVAL ? MONTH)
      GROUP BY AssetID
    ) rt ON rt.AssetID = a.AssetID
    LEFT JOIN (
      SELECT
        ade.AssetID,
        ROUND(
          SUM(
            TIMESTAMPDIFF(
              SECOND,
              GREATEST(ade.StartAt, DATE_SUB(NOW(), INTERVAL ? MONTH)),
              LEAST(COALESCE(ade.EndAt, NOW()), NOW())
            )
          ) / 3600, 4
        ) AS totalDowntimeHours,
        ROUND(
          SUM(
            CASE WHEN ade.DowntimeType = 'PLANNED_MAINTENANCE' THEN
              TIMESTAMPDIFF(
                SECOND,
                GREATEST(ade.StartAt, DATE_SUB(NOW(), INTERVAL ? MONTH)),
                LEAST(COALESCE(ade.EndAt, NOW()), NOW())
              )
            ELSE 0 END
          ) / 3600, 4
        ) AS plannedHours,
        ROUND(
          SUM(
            CASE WHEN ade.DowntimeType = 'UNPLANNED_BREAKDOWN' THEN
              TIMESTAMPDIFF(
                SECOND,
                GREATEST(ade.StartAt, DATE_SUB(NOW(), INTERVAL ? MONTH)),
                LEAST(COALESCE(ade.EndAt, NOW()), NOW())
              )
            ELSE 0 END
          ) / 3600, 4
        ) AS unplannedHours
      FROM AssetDowntimeEvents ade
      WHERE ade.StartAt < NOW()
        AND COALESCE(ade.EndAt, NOW()) > DATE_SUB(NOW(), INTERVAL ? MONTH)
      GROUP BY ade.AssetID
    ) dt ON dt.AssetID = a.AssetID
    WHERE a.Status != 'DECOMMISSIONED'
      AND (COALESCE(rt.totalRunHours, 0) + COALESCE(dt.totalDowntimeHours, 0)) > 0
    ORDER BY downtimePercent DESC
    LIMIT 20
  `,
    [months, months, months, months, months],
  );

  const sumRunAll = downtimeRows.reduce(
    (s, r) => s + Number(r.totalRunHours),
    0,
  );
  const sumDownAll = downtimeRows.reduce(
    (s, r) => s + Number(r.downtimeHours),
    0,
  );
  const sumPlannedAll = downtimeRows.reduce(
    (s, r) => s + Number(r.plannedDowntimeHours),
    0,
  );
  const sumUnplannedAll = downtimeRows.reduce(
    (s, r) => s + Number(r.unplannedDowntimeHours),
    0,
  );
  const downtimeOverall =
    sumRunAll + sumDownAll > 0
      ? Math.round((sumDownAll / (sumRunAll + sumDownAll)) * 10000) / 100
      : 0;

  // ── 3b. Nhật ký dừng máy chi tiết (theo AssetDowntimeEvents) ──────────────
  const [downtimeLogs] = await pool.query(
    `
    SELECT
      ade.EventID AS eventId,
      ade.AssetID AS assetId,
      CONCAT('#', a.AssetID) AS assetCode,
      a.AssetName AS assetName,
      ade.StartAt AS startAt,
      ade.EndAt AS endAt,
      ROUND(
        TIMESTAMPDIFF(
          SECOND,
          GREATEST(ade.StartAt, DATE_SUB(NOW(), INTERVAL ? MONTH)),
          LEAST(COALESCE(ade.EndAt, NOW()), NOW())
        ) / 3600,
        2
      ) AS downtimeHours,
      ade.DowntimeType AS downtimeType,
      ade.Reason AS reason
    FROM AssetDowntimeEvents ade
    JOIN Assets a ON a.AssetID = ade.AssetID
    WHERE ade.StartAt < NOW()
      AND COALESCE(ade.EndAt, NOW()) > DATE_SUB(NOW(), INTERVAL ? MONTH)
    ORDER BY ade.StartAt DESC
    LIMIT 200
  `,
    [months, months],
  );

  // ── 4. Kế hoạch vs Thực tế ────────────────────────────────────────────────
  const planTypeSqlMap = {
    ALL: "1=1",
    PERIODIC: "w.WO_Source IN ('SCHEDULE', 'PREDICTIVE_SCHEDULE')",
    PREDICTIVE: "w.WO_Source = 'PREDICTIVE'",
    EMERGENCY:
      "(w.Priority = 'EMERGENCY' OR (w.WO_Source = 'CORRECTIVE' AND w.Priority = 'HIGH'))",
  };
  const planTypeSql = planTypeSqlMap[planType] ?? planTypeSqlMap.ALL;

  const employeeFilterSql = employeeFilterId
    ? "AND EXISTS (SELECT 1 FROM WO_Assignments wa WHERE wa.WO_ID = w.WO_ID AND wa.EmployeeID = ?)"
    : "";
  const employeeFilterParams = employeeFilterId ? [employeeFilterId] : [];

  const [[planSummary]] = await pool.query(
    `
    SELECT
      COUNT(*)                                                           AS totalScheduled,
      SUM(Status = 'COMPLETED')                                          AS completed,
      SUM(Status = 'COMPLETED' AND ActualDate <= PlannedDate)            AS onTime,
      SUM(Status = 'COMPLETED' AND ActualDate > PlannedDate)             AS late,
      SUM(Status = 'CANCELLED')                                          AS cancelled,
      ROUND(SUM(Status = 'COMPLETED') / COUNT(*) * 100, 1)              AS completionRate,
      CASE WHEN SUM(Status = 'COMPLETED') > 0
        THEN ROUND(
          SUM(Status = 'COMPLETED' AND ActualDate <= PlannedDate) /
          SUM(Status = 'COMPLETED') * 100, 1)
        ELSE 0
      END AS onTimeRate
    FROM WorkOrders w
    WHERE w.IsDeleted = 0
      AND (${planTypeSql})
      AND w.PlannedDate >= DATE_SUB(NOW(), INTERVAL ? MONTH)
      ${employeeFilterSql}
  `,
    [months, ...employeeFilterParams],
  );

  const [planByMonth] = await pool.query(
    `
    SELECT
      DATE_FORMAT(PlannedDate, '%Y-%m')                               AS month,
      COUNT(*)                                                         AS total,
      SUM(Status = 'COMPLETED')                                        AS completed,
      SUM(Status = 'COMPLETED' AND ActualDate <= PlannedDate)          AS onTime,
      SUM(Status = 'COMPLETED' AND ActualDate > PlannedDate)           AS late
    FROM WorkOrders w
    WHERE w.IsDeleted = 0
      AND (${planTypeSql})
      AND w.PlannedDate >= DATE_SUB(NOW(), INTERVAL ? MONTH)
      ${employeeFilterSql}
    GROUP BY DATE_FORMAT(PlannedDate, '%Y-%m')
    ORDER BY month ASC
  `,
    [months, ...employeeFilterParams],
  );

  const [employeeOptionsRows] = await pool.query(
    `
    SELECT DISTINCT
      e.EmployeeID AS employeeId,
      e.FullName   AS fullName
    FROM WorkOrders w
    INNER JOIN WO_Assignments wa ON wa.WO_ID = w.WO_ID
    INNER JOIN Employees e ON e.EmployeeID = wa.EmployeeID
    WHERE w.IsDeleted = 0
      AND (${planTypeSql})
      AND w.PlannedDate >= DATE_SUB(NOW(), INTERVAL ? MONTH)
      AND e.IsActive = TRUE
    ORDER BY e.FullName ASC
  `,
    [months],
  );

  const [planByEmployee] = await pool.query(
    `
    SELECT
      wa.EmployeeID AS employeeId,
      e.FullName AS fullName,
      COUNT(DISTINCT w.WO_ID) AS assignedCount,
      SUM(CASE WHEN w.Status = 'COMPLETED' THEN 1 ELSE 0 END) AS completedCount,
      SUM(CASE WHEN w.Status = 'COMPLETED' AND w.ActualDate <= w.PlannedDate THEN 1 ELSE 0 END) AS onTimeCount,
      SUM(CASE WHEN w.Priority = 'EMERGENCY' OR (w.WO_Source = 'CORRECTIVE' AND w.Priority = 'HIGH') THEN 1 ELSE 0 END) AS emergencyCount,
      ROUND(
        CASE
          WHEN SUM(CASE WHEN w.Status = 'COMPLETED' THEN 1 ELSE 0 END) > 0 THEN
            SUM(CASE WHEN w.Status = 'COMPLETED' AND w.ActualDate <= w.PlannedDate THEN 1 ELSE 0 END) * 100.0
            / SUM(CASE WHEN w.Status = 'COMPLETED' THEN 1 ELSE 0 END)
          ELSE 0
        END,
        1
      ) AS onTimeRate,
      ROUND(
        SUM(CASE WHEN w.Status = 'COMPLETED' THEN COALESCE(w.ActualHours, 0) ELSE 0 END),
        1
      ) AS totalActualHours
    FROM WorkOrders w
    INNER JOIN WO_Assignments wa ON wa.WO_ID = w.WO_ID
    INNER JOIN Employees e ON e.EmployeeID = wa.EmployeeID
    WHERE w.IsDeleted = 0
      AND (${planTypeSql})
      AND w.PlannedDate >= DATE_SUB(NOW(), INTERVAL ? MONTH)
      ${employeeFilterId ? "AND wa.EmployeeID = ?" : ""}
    GROUP BY wa.EmployeeID, e.FullName
    ORDER BY assignedCount DESC, e.FullName ASC
  `,
    [months, ...employeeFilterParams],
  );

  // ── 5. Pareto Downtime — top thiết bị gây ra dừng máy nhiều nhất ──────────
  const [paretoRaw] = await pool.query(
    `
    SELECT
      a.AssetID       AS assetId,
      a.AssetName     AS assetName,
      l.LocationName  AS locationName,
      ROUND(
        SUM(
          TIMESTAMPDIFF(
            SECOND,
            GREATEST(ade.StartAt, DATE_SUB(NOW(), INTERVAL ? MONTH)),
            LEAST(COALESCE(ade.EndAt, NOW()), NOW())
          )
        ) / 3600, 4
      ) AS downtimeHours,
      ROUND(
        SUM(
          CASE WHEN ade.DowntimeType = 'PLANNED_MAINTENANCE' THEN
            TIMESTAMPDIFF(
              SECOND,
              GREATEST(ade.StartAt, DATE_SUB(NOW(), INTERVAL ? MONTH)),
              LEAST(COALESCE(ade.EndAt, NOW()), NOW())
            )
          ELSE 0 END
        ) / 3600, 4
      ) AS plannedHours,
      ROUND(
        SUM(
          CASE WHEN ade.DowntimeType = 'UNPLANNED_BREAKDOWN' THEN
            TIMESTAMPDIFF(
              SECOND,
              GREATEST(ade.StartAt, DATE_SUB(NOW(), INTERVAL ? MONTH)),
              LEAST(COALESCE(ade.EndAt, NOW()), NOW())
            )
          ELSE 0 END
        ) / 3600, 4
      ) AS unplannedHours
    FROM AssetDowntimeEvents ade
    JOIN Assets a   ON a.AssetID  = ade.AssetID
    LEFT JOIN Locations l ON l.LocationID = a.LocationID
    WHERE ade.StartAt < NOW()
      AND COALESCE(ade.EndAt, NOW()) > DATE_SUB(NOW(), INTERVAL ? MONTH)
    GROUP BY a.AssetID, a.AssetName, l.LocationName
    ORDER BY downtimeHours DESC
    LIMIT 20
  `,
    [months, months, months, months],
  );

  // Tính cumulative % (Pareto)
  const paretoTotal = paretoRaw.reduce(
    (s, r) => s + Number(r.downtimeHours),
    0,
  );
  let cumulative = 0;
  const paretoRows = paretoRaw.map((r) => {
    cumulative += Number(r.downtimeHours);
    return {
      ...r,
      downtimeHours: Math.round(Number(r.downtimeHours) * 100) / 100,
      plannedHours: Math.round(Number(r.plannedHours) * 100) / 100,
      unplannedHours: Math.round(Number(r.unplannedHours) * 100) / 100,
      cumulativePercent:
        paretoTotal > 0
          ? Math.round((cumulative / paretoTotal) * 1000) / 10
          : 0,
    };
  });

  return ok(res, {
    months,
    mtbf: { overall: mtbfOverall, byAsset: mtbfRows },
    mttr: { overall: mttrOverall, byAsset: mttrRows },
    downtime: {
      overall: downtimeOverall,
      plannedOverallHours: Math.round(sumPlannedAll * 100) / 100,
      unplannedOverallHours: Math.round(sumUnplannedAll * 100) / 100,
      byAsset: downtimeRows,
      logs: downtimeLogs,
    },
    planVsActual: {
      summary: planSummary,
      byMonth: planByMonth,
      employeeOptions: employeeOptionsRows,
      byEmployee: planByEmployee,
      employeeFilterId,
      planType,
    },
    pareto: { total: paretoTotal, rows: paretoRows },
  });
});

const RESOURCE_USAGE_MAX_MONTHS = 24;

/**
 * 6 mục: (1) phiếu checklist theo tài sản+người; lượt mở QR; (2)(3) lượt mở tài liệu + hot; (4) tài liệu 12–24 tháng chưa cập nhật pb gần đây;
 * (5) tỷ lệ góp ý / số phiên bản thêm trong kỳ; (6) góp ý mở chưa có phiên bản sau góp ý.
 * Không tính "độ chính xác dự báo PM" (theo yêu cầu tách phạm vi).
 */
export const resourceUsageReport = asyncHandler(async (req, res) => {
  const m = Math.min(
    RESOURCE_USAGE_MAX_MONTHS,
    Math.max(1, Number(req.query.months) || 6),
  );
  const pool = getPool();
  const p = [m];

  const [[checklistTotals]] = await pool.query(
    `SELECT COUNT(*) AS totalSubmissions
     FROM ChecklistResults cr
     WHERE cr.CheckTime >= DATE_SUB(NOW(), INTERVAL ? MONTH)`,
    p,
  );
  const [checklistByAssetChecker] = await pool.query(
    `SELECT
       cr.AssetID   AS assetId,
       a.AssetName  AS assetName,
       cr.CheckerID AS checkerId,
       e.FullName   AS checkerName,
       COUNT(*)     AS submissionCount
     FROM ChecklistResults cr
     JOIN Assets a    ON a.AssetID = cr.AssetID
     JOIN Employees e ON e.EmployeeID = cr.CheckerID
     WHERE cr.CheckTime >= DATE_SUB(NOW(), INTERVAL ? MONTH)
     GROUP BY cr.AssetID, a.AssetName, cr.CheckerID, e.FullName
     ORDER BY submissionCount DESC
     LIMIT 200`,
    p,
  );

  const [qrByDay] = await pool.query(
    `SELECT DATE_FORMAT(q.AccessAt, '%Y-%m-%d') AS dayKey, COUNT(*) AS accessCount
     FROM AssetQrAccessLogs q
     WHERE q.AccessAt >= DATE_SUB(NOW(), INTERVAL ? MONTH)
     GROUP BY DATE_FORMAT(q.AccessAt, '%Y-%m-%d')
     ORDER BY dayKey ASC`,
    p,
  );
  const [[qrTotals]] = await pool.query(
    `SELECT COUNT(*) AS totalQrOpens
     FROM AssetQrAccessLogs q
     WHERE q.AccessAt >= DATE_SUB(NOW(), INTERVAL ? MONTH)`,
    p,
  );
  const [qrTopAssets] = await pool.query(
    `SELECT q.AssetID AS assetId, a.AssetName AS assetName, COUNT(*) AS openCount
     FROM AssetQrAccessLogs q
     JOIN Assets a ON a.AssetID = q.AssetID
     WHERE q.AccessAt >= DATE_SUB(NOW(), INTERVAL ? MONTH)
     GROUP BY q.AssetID, a.AssetName
     ORDER BY openCount DESC
     LIMIT 15`,
    p,
  );

  const [docViewByDay] = await pool.query(
    `SELECT DATE_FORMAT(l.AccessAt, '%Y-%m-%d') AS dayKey, COUNT(*) AS viewCount
     FROM DigitalAssetViewLogs l
     WHERE l.AccessAt >= DATE_SUB(NOW(), INTERVAL ? MONTH)
     GROUP BY DATE_FORMAT(l.AccessAt, '%Y-%m-%d')
     ORDER BY dayKey ASC`,
    p,
  );
  const [[docViewTotals]] = await pool.query(
    `SELECT COUNT(*) AS totalDocViews
     FROM DigitalAssetViewLogs l
     WHERE l.AccessAt >= DATE_SUB(NOW(), INTERVAL ? MONTH)`,
    p,
  );
  const [docHot] = await pool.query(
    `SELECT l.DigitalAssetID AS digitalAssetId, da.FileName AS fileName,
            COALESCE(a.AssetName, '—') AS assetName, COUNT(*) AS viewCount
     FROM DigitalAssetViewLogs l
     JOIN DigitalAssets da ON da.DigitalAssetID = l.DigitalAssetID
     LEFT JOIN Assets a ON a.AssetID = da.AssetID
     WHERE l.AccessAt >= DATE_SUB(NOW(), INTERVAL ? MONTH)
     GROUP BY l.DigitalAssetID, da.FileName, a.AssetName
     ORDER BY viewCount DESC
     LIMIT 20`,
    p,
  );

  const [staleDocuments] = await pool.query(
    `SELECT
       da.DigitalAssetID AS digitalAssetId,
       da.FileName       AS fileName,
       da.UploadDate     AS uploadDate,
       da.CurrentVersion AS currentVersion,
       DATEDIFF(NOW(), da.UploadDate) AS daysSinceUpload,
       (SELECT MAX(av.ChangeDate) FROM AssetVersions av WHERE av.DigitalAssetID = da.DigitalAssetID) AS lastVersionChangeAt
     FROM DigitalAssets da
     WHERE da.Status = 'APPROVED'
       AND da.UploadDate <= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       AND da.UploadDate >= DATE_SUB(NOW(), INTERVAL 24 MONTH)
       AND (
         (SELECT MAX(av.ChangeDate) FROM AssetVersions av WHERE av.DigitalAssetID = da.DigitalAssetID) IS NULL
         OR (SELECT MAX(av.ChangeDate) FROM AssetVersions av WHERE av.DigitalAssetID = da.DigitalAssetID)
            < DATE_SUB(NOW(), INTERVAL 12 MONTH)
       )
     ORDER BY da.UploadDate ASC
     LIMIT 100`,
  );

  const [[fbRow]] = await pool.query(
    `SELECT COUNT(*) AS feedbackInPeriod
     FROM DigitalAssetFeedback f
     WHERE f.CreatedAt >= DATE_SUB(NOW(), INTERVAL ? MONTH)`,
    p,
  );
  const [[verRow]] = await pool.query(
    `SELECT COUNT(*) AS versionAddsInPeriod
     FROM AssetVersions av
     WHERE av.ChangeDate >= DATE_SUB(NOW(), INTERVAL ? MONTH)`,
    p,
  );
  const feedbackInPeriod = Number(fbRow?.feedbackInPeriod ?? 0);
  const versionAddsInPeriod = Number(verRow?.versionAddsInPeriod ?? 0);
  const feedbackToVersionRatio =
    versionAddsInPeriod > 0
      ? Math.round((feedbackInPeriod / versionAddsInPeriod) * 1000) / 1000
      : null;

  const [feedbackUnresolved] = await pool.query(
    `SELECT
       f.FeedbackID   AS feedbackId,
       f.DigitalAssetID AS digitalAssetId,
       da.FileName    AS fileName,
       f.Body         AS body,
       f.Status       AS status,
       f.CreatedAt    AS createdAt
     FROM DigitalAssetFeedback f
     JOIN DigitalAssets da ON da.DigitalAssetID = f.DigitalAssetID
     WHERE f.Status IN ('OPEN', 'IN_REVIEW')
       AND NOT EXISTS (
         SELECT 1 FROM AssetVersions av
         WHERE av.DigitalAssetID = f.DigitalAssetID
           AND av.ChangeDate > f.CreatedAt
       )
     ORDER BY f.CreatedAt ASC
     LIMIT 150`,
  );

  return ok(res, {
    months: m,
    logicNotes: {
      qrVsChecklist:
        "Lượt mở QR = mỗi lần gọi getQRInfo (bảng AssetQrAccessLogs). Phiếu checklist = số bản ghi nộp trong kỳ (ChecklistResults).",
      documentViews:
        "Lượt mở tài liệu = mỗi lần user bấm mở file từ checklist (DigitalAssetViewLogs; không tự động khi tải danh sách tài liệu).",
      feedbackRatio:
        "Tỷ lệ = số góp ý tạo trong kỳ / số bản ghi AssetVersions tạo trong kỳ (kể cả tải mới tạo v1; phản ánh tần cập nhật so với phản hồi).",
      stale:
        'Tài liệu APPROVED, tuổi thọ upload nằm trong khoảng 12–24 tháng, và (MAX ChangeDate) NULL hoặc cách hiện tại hơn 12 tháng — chưa được cập nhật phiên bản gần đây (proxy "review" vận hành).',
      unresolved:
        "Góp ý OPEN/IN_REVIEW mà chưa có bản ghi AssetVersions với ChangeDate sau thời điểm góp ý (coi như chưa phản ứng bằng phiên bản mới).",
    },
    checklistSubmissions: {
      totalSubmissions: Number(checklistTotals?.totalSubmissions ?? 0),
      byAssetChecker: checklistByAssetChecker,
    },
    qrFieldUsage: {
      totalOpens: Number(qrTotals?.totalQrOpens ?? 0),
      byDay: qrByDay,
      topAssets: qrTopAssets,
    },
    documentAccess: {
      totalViews: Number(docViewTotals?.totalDocViews ?? 0),
      byDay: docViewByDay,
    },
    documentHot: docHot,
    staleDocuments,
    feedbackImprovement: {
      feedbackInPeriod,
      versionAddsInPeriod,
      ratio: feedbackToVersionRatio,
    },
    feedbackWithoutNewVersion: feedbackUnresolved,
  });
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
    WHERE Status = 'COMPLETED' AND IsDeleted = 0
      AND ActualDate >= DATE_SUB(NOW(), INTERVAL 12 WEEK)
    GROUP BY YEARWEEK(ActualDate, 1)
    ORDER BY yearWeek ASC
  `);
  return ok(res, rows);
});
