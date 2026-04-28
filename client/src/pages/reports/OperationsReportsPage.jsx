/**
 * OperationsReportsPage.jsx — Báo cáo nghiệp vụ & vận hành (Trưởng/Phó hai phòng + Admin + Ban GĐ).
 * Tab 1: Tỷ lệ hoàn thành checklist định kỳ (ScheduledChecklistSlots / FULFILLED).
 * Tab 2: Thời gian giữa các bước phê duyệt (ApprovalLogs, ActionDate).
 * Tab 3: Xu hướng NG theo thiết bị (ChecklistResults).
 * RBAC: route report-operations; API đã chặn tương ứng trên server.
 * Liên quan: api/stats.api.js, rbac.js.
 */
import { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  ListTodo,
  Clock,
  AlertTriangle,
  Download,
  Printer,
  Info,
  ArrowLeft,
} from "lucide-react";
import { statsApi } from "../../api/stats.api.js";
import { Card } from "../../components/ui/Card.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { PageLoader } from "../../components/ui/Spinner.jsx";
import { fDate, fDateTime } from "../../utils/format.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { canDo } from "../../utils/rbac.js";
import toast from "react-hot-toast";

const TABS = [
  {
    key: "compliance",
    label: "Checklist định kỳ",
    short: "Định kỳ",
    icon: ListTodo,
    desc: "Lượt bảo trì - Đã hoàn thành sau phê duyệt",
  },
  {
    key: "approval",
    label: "Phê duyệt đa cấp",
    short: "Phê duyệt",
    icon: Clock,
    desc: "Hiệu ngày thực hiện giữa các bước",
  },
  {
    key: "ng",
    label: "Xu hướng NG",
    short: "NG",
    icon: AlertTriangle,
    desc: "Theo ngày & theo thiết bị",
  },
];

const RESOURCE_TYPE_LABEL = {
  WORK_ORDER: "Phiếu việc",
  DIGITAL_ASSET: "Tài nguyên số",
  MAINTENANCE_PLAN: "Lịch bảo trì",
};

const NG_LINE_COLORS = [
  "#dc2626",
  "#ea580c",
  "#b45309",
  "#991b1b",
  "#7c2d12",
  "#be123c",
  "#9f1239",
  "#881337",
  "#4c0519",
  "#831843",
];

const SLOT_STATUS_BADGE = {
  OPEN: "blue",
  OVERDUE: "red",
  FULFILLED: "green",
  WAIVED: "gray",
};

function downloadCSV(data, filename) {
  if (!data?.length) {
    toast.error("Không có dữ liệu để xuất");
    return;
  }
  const headers = Object.keys(data[0]);
  const rows = data.map((r) =>
    headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","),
  );
  const csv = [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function handleBlockedExport(canExport) {
  if (!canExport) {
    toast.error("Bạn chưa có quyền xuất báo cáo");
    return true;
  }
  return false;
}

export function OperationsReportsPage() {
  const { user } = useAuth();
  const canExport = canDo(user, "REPORT:EXPORT");
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get("tab");
  const activeTab = TABS.some((t) => t.key === tabParam)
    ? tabParam
    : "compliance";

  const setActiveTab = (key) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  const [slotMonths, setSlotMonths] = useState(12);
  const [analysisMonths, setAnalysisMonths] = useState(6);
  const [topAssetN, setTopAssetN] = useState(8);

  const [compliance, setCompliance] = useState(null);
  const [approvalLatency, setApprovalLatency] = useState(null);
  const [ngByAsset, setNgByAsset] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSlots(true);
      try {
        const res = await statsApi.checklistScheduleCompliance(slotMonths);
        if (!cancelled) setCompliance(res.data.data);
      } catch {
        if (!cancelled) toast.error("Không tải tỷ lệ checklist định kỳ");
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slotMonths]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingAnalysis(true);
      try {
        const [ap, ng] = await Promise.all([
          statsApi.approvalStepLatencies(analysisMonths),
          statsApi.checklistNgByAsset(analysisMonths, topAssetN),
        ]);
        if (!cancelled) {
          setApprovalLatency(ap.data.data);
          setNgByAsset(ng.data.data);
        }
      } catch {
        if (!cancelled)
          toast.error("Không tải dữ liệu phê duyệt / NG theo thiết bị");
      } finally {
        if (!cancelled) setLoadingAnalysis(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [analysisMonths, topAssetN]);

  const ngChartRows = useMemo(
    () =>
      (ngByAsset?.chartRows ?? []).map((row) => ({
        ...row,
        dateLabel: row.day ? fDate(row.day) : "",
      })),
    [ngByAsset],
  );

  const recentSlots = compliance?.recentSlots ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl shadow-indigo-900/20 px-6 py-7 md:px-8">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-400/20 via-transparent to-transparent" />
        <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-200 hover:text-white mb-3"
            >
              <ArrowLeft size={14} /> Trang chủ
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Báo cáo nghiệp vụ và vận hành
            </h1>
            <p className="mt-2 text-sm text-indigo-100/90 max-w-2xl leading-relaxed">
              Theo dõi mức độ hoàn thành checklist gắn lịch, độ trễ giữa các cấp
              phê duyệt và xu hướng lỗi NG theo từng thiết bị — phục vụ giám sát
              vận hành, không thay thế chi tiết từng phiếu trên module nghiệp
              vụ.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/15 border border-white/20 transition-colors"
            >
              <Printer size={15} /> In trang
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="relative mt-6 flex flex-wrap gap-2">
          {TABS.map(({ key, label, short, icon: Icon, desc }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all
                ${
                  activeTab === key
                    ? "bg-white text-indigo-950 shadow-lg"
                    : "bg-white/10 text-indigo-100 hover:bg-white/15 border border-white/10"
                }`}
            >
              <Icon
                size={17}
                className={activeTab === key ? "text-indigo-600" : ""}
              />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{short}</span>
            </button>
          ))}
        </div>
        <p className="relative mt-3 text-xs text-indigo-200/80">
          {TABS.find((t) => t.key === activeTab)?.desc}
        </p>
      </div>

      {/* ── Tab: Checklist định kỳ ── */}
      {activeTab === "compliance" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              Kỳ lọc theo ngày tới của hạn lượt bảo trì
            </p>
            <select
              value={slotMonths}
              onChange={(e) => setSlotMonths(Number(e.target.value))}
              className="text-sm text-gray-900 border border-gray-200 rounded-xl px-3 py-2.5 bg-white shadow-sm"
            >
              {[3, 6, 12, 24].map((m) => (
                <option key={m} value={m} className="text-gray-900 bg-white">
                  {m} tháng
                </option>
              ))}
            </select>
          </div>

          {loadingSlots && !compliance ? (
            <PageLoader />
          ) : (
            <>
              {compliance?.summary && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  {[
                    {
                      label: "Tỷ lệ hoàn thành",
                      value:
                        compliance.summary.completionRatePct != null
                          ? `${compliance.summary.completionRatePct}%`
                          : "—",
                      sub: `${compliance.summary.fulfilledSlots} / ${compliance.summary.totalSlots} lượt`,
                      color:
                        (compliance.summary.completionRatePct ?? 0) >= 90
                          ? "text-emerald-700"
                          : (compliance.summary.completionRatePct ?? 0) >= 70
                            ? "text-amber-600"
                            : "text-red-600",
                      bg: "from-emerald-50 to-white border-emerald-100",
                    },
                    {
                      label: "ĐÃ HOÀN THÀNH",
                      value: compliance.summary.fulfilledSlots,
                      sub: "Đã gắn checklist và được duyệt",
                      color: "text-emerald-700",
                      bg: "from-white to-slate-50 border-gray-100",
                    },
                    {
                      label: "CHƯA THỰC HIỆN",
                      value: compliance.summary.openSlots,
                      sub: "Đã đến hạn nhưng thợ chưa làm",
                      color: "text-slate-700",
                      bg: "from-white to-slate-50 border-gray-100",
                    },
                    {
                      label: "QUÁ HẠN",
                      value: compliance.summary.overdueSlots,
                      sub: "Đã vượt ngày đến hạn",
                      color: "text-red-600",
                      bg: "from-red-50/50 to-white border-red-100",
                    },
                    {
                      label: "MIỄN/HUỶ BỎ",
                      value: compliance.summary.waivedSlots ?? 0,
                      sub: "Lượt bảo trì được bỏ qua/huỷ có lý do",
                      color: "text-gray-600",
                      bg: "from-white to-slate-50 border-gray-100",
                    },
                  ].map((k) => (
                    <div
                      key={k.label}
                      className={`rounded-2xl border p-4 bg-gradient-to-br shadow-sm ${k.bg}`}
                    >
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                        {k.label}
                      </p>
                      <p
                        className={`text-2xl font-bold mt-1 tabular-nums ${k.color}`}
                      >
                        {k.value}
                      </p>
                      {k.sub ? (
                        <p className="text-xs text-gray-500 mt-1">{k.sub}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!compliance?.bySchedule?.length}
                  onClick={() => {
                    if (handleBlockedExport(canExport)) return;
                    downloadCSV(
                      compliance.bySchedule.map((r) => ({
                        Lịch: r.scheduleName,
                        "Tài sản": r.assetName,
                        "Tổng lượt": r.totalSlots,
                        "Đã hoàn thành": r.fulfilledSlots,
                        "Quá hạn": r.overdueSlots,
                        "Đang mở": r.openSlots,
                        "Tỷ lệ %": r.ratePct ?? "",
                      })),
                      `bao-cao-checklist-dinh-ky-${slotMonths}m.csv`,
                    );
                  }}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    !compliance?.bySchedule?.length
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : canExport
                        ? "bg-indigo-600 text-white hover:bg-indigo-700"
                        : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                  }`}
                  title={
                    !compliance?.bySchedule?.length
                      ? "Không có dữ liệu để xuất"
                      : canExport
                        ? "Xuất CSV theo lịch"
                        : "Thiếu quyền REPORT:EXPORT"
                  }
                >
                  <Download size={15} /> Xuất CSV theo lịch
                </button>
              </div>

              <Card title="Tổng hợp theo lịch bảo trì & tài sản">
                {!compliance?.bySchedule?.length ? (
                  <p className="text-sm text-gray-400 text-center py-10">
                    Chưa có slot WO từ lịch trong kỳ đã chọn.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">
                        <tr>
                          {[
                            "Lịch",
                            "Tài sản",
                            "Lượt",
                            "Hoàn thành",
                            "Quá hạn",
                            "Mở",
                            "Tỷ lệ",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-3 border-b border-gray-100"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {compliance.bySchedule.map((r) => (
                          <tr
                            key={`${r.scheduleId}-${r.assetName}`}
                            className="hover:bg-indigo-50/40"
                          >
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {r.scheduleName}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {r.assetName}
                            </td>
                            <td className="px-4 py-3 tabular-nums">
                              {r.totalSlots}
                            </td>
                            <td className="px-4 py-3 tabular-nums text-emerald-700 font-semibold">
                              {r.fulfilledSlots}
                            </td>
                            <td className="px-4 py-3 tabular-nums text-red-600">
                              {r.overdueSlots}
                            </td>
                            <td className="px-4 py-3 tabular-nums">
                              {r.openSlots}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                color={
                                  r.ratePct == null
                                    ? "gray"
                                    : Number(r.ratePct) >= 90
                                      ? "green"
                                      : Number(r.ratePct) >= 70
                                        ? "yellow"
                                        : "red"
                                }
                              >
                                {r.ratePct != null ? `${r.ratePct}%` : "—"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card title="Các lượt gần đây (chi tiết slot)">
                <p className="text-xs text-gray-500 mb-4">
                  Tối đa 200 bản ghi mới nhất từ API; dùng để đối chiếu nhanh WO
                  / checklist gắn slot.
                </p>
                {!recentSlots.length ? (
                  <p className="text-sm text-gray-400 text-center py-8">
                    Không có dữ liệu slot trong kỳ.
                  </p>
                ) : (
                  <div className="overflow-x-auto max-h-[420px] overflow-y-auto rounded-xl border border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-left text-xs font-bold text-slate-600 z-10">
                        <tr>
                          {[
                            "DueDate",
                            "Lịch",
                            "Tài sản",
                            "WO",
                            "Trạng thái",
                            "Checklist",
                            "Hoàn thành lúc",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2.5 border-b border-gray-100 whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {recentSlots.map((s) => (
                          <tr key={s.slotId} className="hover:bg-slate-50/80">
                            <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                              {s.dueDate ? fDate(s.dueDate) : "—"}
                            </td>
                            <td
                              className="px-3 py-2 max-w-[140px] truncate"
                              title={s.scheduleName}
                            >
                              {s.scheduleName}
                            </td>
                            <td className="px-3 py-2 max-w-[120px] truncate">
                              {s.assetName}
                            </td>
                            <td className="px-3 py-2">
                              {s.workOrderId ? (
                                <Link
                                  to={`/work-orders/${s.workOrderId}`}
                                  className="font-mono text-indigo-600 hover:underline"
                                >
                                  #{s.workOrderId}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                color={SLOT_STATUS_BADGE[s.status] ?? "gray"}
                              >
                                {s.status}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">
                              {s.checklistId ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                              {s.fulfilledAt ? fDateTime(s.fulfilledAt) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Phê duyệt ── */}
      {activeTab === "approval" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <select
              value={analysisMonths}
              onChange={(e) => setAnalysisMonths(Number(e.target.value))}
              className="text-sm text-gray-900 border border-gray-200 rounded-xl px-3 py-2.5 bg-white shadow-sm"
            >
              {[3, 6, 12, 24].map((m) => (
                <option key={m} value={m} className="text-gray-900 bg-white">
                  {m} tháng
                </option>
              ))}
            </select>
          </div>

          {loadingAnalysis && !approvalLatency ? (
            <PageLoader />
          ) : !approvalLatency?.summary?.transitionCount ? (
            <Card title="Kết quả">
              <p className="text-sm text-gray-500 text-center py-10">
                Chưa có cặp chuyển bước hợp lệ trong kỳ (hoặc chưa có luồng đa
                cấp được sử dụng).
              </p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Số chuyển bước (mẫu)
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">
                    {approvalLatency.summary.transitionCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 shadow-sm">
                  <p className="text-xs font-semibold text-indigo-800 uppercase">
                    Trung bình (giờ)
                  </p>
                  <p className="text-3xl font-bold text-indigo-900 mt-1 tabular-nums">
                    {approvalLatency.summary.avgHoursBetweenSteps ?? "—"}
                  </p>
                </div>
              </div>

              <Card title="Theo loại tài nguyên">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-gray-100 text-xs font-bold text-slate-600">
                      <tr>
                        {["Loại", "Số chuyển bước", "Trung bình (giờ)"].map(
                          (h) => (
                            <th key={h} className="text-left px-4 py-3">
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(approvalLatency.byResourceType ?? []).map((r) => (
                        <tr
                          key={r.resourceType}
                          className="hover:bg-slate-50/60"
                        >
                          <td className="px-4 py-3 font-medium">
                            {RESOURCE_TYPE_LABEL[r.resourceType] ??
                              r.resourceType}
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            {r.transitionCount}
                          </td>
                          <td className="px-4 py-3 tabular-nums font-semibold text-indigo-700">
                            {r.avgHoursBetween}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card title="Mẫu chi tiết (tối đa 200 bản ghi cuối)">
                <div className="flex justify-end mb-3">
                  <button
                    type="button"
                    disabled={!(approvalLatency.samples ?? []).length}
                    onClick={() => {
                      if (handleBlockedExport(canExport)) return;
                      downloadCSV(
                        (approvalLatency.samples ?? []).map((s) => ({
                          Loại:
                            RESOURCE_TYPE_LABEL[s.resourceType] ??
                            s.resourceType,
                          "Resource ID": s.resourceId,
                          "Từ bước": s.fromLevel,
                          "Đến bước": s.toLevel,
                          "Kết quả bước sau": s.toStatus,
                          "Giờ chênh": s.hoursBetween,
                        })),
                        `phe-duyet-buoc-${analysisMonths}m.csv`,
                      );
                    }}
                    className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                      !(approvalLatency.samples ?? []).length
                        ? "text-gray-400 cursor-not-allowed"
                        : canExport
                          ? "text-indigo-600 hover:text-indigo-800"
                          : "text-indigo-500 hover:text-indigo-700"
                    }`}
                    title={
                      !(approvalLatency.samples ?? []).length
                        ? "Không có dữ liệu mẫu để xuất"
                        : canExport
                          ? "Xuất CSV mẫu"
                          : "Thiếu quyền REPORT:EXPORT"
                    }
                  >
                    <Download size={14} /> Xuất CSV mẫu
                  </button>
                </div>
                <div className="overflow-x-auto max-h-[360px] overflow-y-auto rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs font-bold text-slate-600 z-10">
                      <tr>
                        {["Loại", "ID", "Chuyển bước", "Kết quả", "Giờ"].map(
                          (h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left border-b border-gray-100"
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(approvalLatency.samples ?? []).map((s, i) => (
                        <tr
                          key={`${s.resourceType}-${s.resourceId}-${i}`}
                          className="border-b border-gray-50 hover:bg-slate-50/50"
                        >
                          <td className="px-3 py-2 whitespace-nowrap">
                            {RESOURCE_TYPE_LABEL[s.resourceType] ??
                              s.resourceType}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {s.resourceId}
                          </td>
                          <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                            {s.fromLevel} → {s.toLevel}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              color={
                                s.toStatus === "APPROVED"
                                  ? "green"
                                  : s.toStatus === "REJECTED"
                                    ? "red"
                                    : "yellow"
                              }
                            >
                              {s.toStatus}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 tabular-nums font-medium">
                            {s.hoursBetween}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── Tab: NG ── */}
      {activeTab === "ng" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* <p className="text-sm text-gray-600">
              Chỉ số: phiếu <strong>ChecklistResults</strong> có{" "}
              <code className="text-xs bg-gray-100 px-1 rounded">
                OverallStatus = NG
              </code>
              , gom theo ngày và tài sản.
            </p> */}
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={analysisMonths}
                onChange={(e) => setAnalysisMonths(Number(e.target.value))}
                className="text-sm text-gray-900 border border-gray-200 rounded-xl px-3 py-2 bg-white shadow-sm"
              >
                {[3, 6, 12, 24].map((m) => (
                  <option key={m} value={m} className="text-gray-900 bg-white">
                    {m} tháng
                  </option>
                ))}
              </select>
              <select
                value={topAssetN}
                onChange={(e) => setTopAssetN(Number(e.target.value))}
                className="text-sm text-gray-900 border border-gray-200 rounded-xl px-3 py-2 bg-white shadow-sm"
              >
                {[5, 8, 10, 15].map((n) => (
                  <option key={n} value={n} className="text-gray-900 bg-white">
                    Top {n} thiết bị
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loadingAnalysis && !ngByAsset ? (
            <PageLoader />
          ) : !ngChartRows.length ? (
            <Card title="Biểu đồ">
              <p className="text-sm text-gray-500 text-center py-12">
                Chưa có bản ghi NG trong kỳ.
              </p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(ngByAsset.topAssets ?? []).map((a, i) => (
                  <div
                    key={a.assetId}
                    className="rounded-xl border border-gray-100 bg-white p-4 flex items-center gap-3 shadow-sm"
                  >
                    <div
                      className="w-1 self-stretch rounded-full shrink-0"
                      style={{
                        background: NG_LINE_COLORS[i % NG_LINE_COLORS.length],
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-500 font-semibold uppercase">
                        Tài sản
                      </p>
                      <p
                        className="font-semibold text-gray-900 truncate"
                        title={a.assetName}
                      >
                        {a.assetName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Tổng NG trong kỳ:{" "}
                        <span className="font-bold text-red-600 tabular-nums">
                          {a.totalNg}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Card title="Số phiếu NG theo ngày">
                <div className="h-[340px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={ngChartRows}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="dateLabel"
                        tick={{ fontSize: 10 }}
                        stroke="#9ca3af"
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11 }}
                        stroke="#9ca3af"
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #e5e7eb",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {(ngByAsset.topAssets ?? []).map((a, i) => (
                        <Line
                          key={a.assetId}
                          type="monotone"
                          dataKey={`a${a.assetId}`}
                          stroke={NG_LINE_COLORS[i % NG_LINE_COLORS.length]}
                          strokeWidth={2}
                          name={a.assetName}
                          dot={{ r: 2 }}
                          activeDot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="So sánh nhanh (tổng NG / thiết bị)">
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(ngByAsset.topAssets ?? []).map((a) => ({
                        name:
                          a.assetName.length > 22
                            ? `${a.assetName.slice(0, 20)}…`
                            : a.assetName,
                        full: a.assetName,
                        ng: a.totalNg,
                      }))}
                      layout="vertical"
                      margin={{ left: 8, right: 16 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke="#e5e7eb"
                      />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip
                        formatter={(v) => [v, "Tổng NG"]}
                        labelFormatter={(_, p) => p?.[0]?.payload?.full ?? ""}
                      />
                      <Bar
                        dataKey="ng"
                        fill="#dc2626"
                        radius={[0, 6, 6, 0]}
                        name="NG"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
