/**
 * ReportPerformancePage.jsx — BFD 6.4: Báo cáo hiệu suất & tình trạng tài sản.
 * Gồm: MTBF, MTTR, Tỷ lệ dừng máy, Kế hoạch vs Thực tế, Pareto Downtime.
 * RBAC: Trưởng/Phó bảo trì & PKT (L3), Quản trị (L4+), Ban GĐ — không gồm CV KTS.
 * Liên quan: api/stats.api.js, utils/rbac.js (canAccessPerformanceReport), routes stats.routes.js.
 */
import { useEffect, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { statsApi } from "../../api/stats.api.js";
import logoSrc from "../../assets/logo/logo.png";
import { Card } from "../../components/ui/Card.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { PageLoader } from "../../components/ui/Spinner.jsx";
import { canAccessPerformanceReport } from "../../utils/rbac.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import toast from "react-hot-toast";
import {
  Activity,
  Clock,
  TrendingDown,
  CalendarCheck,
  BarChart2,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";

// pdfmake/build/vfs_fonts export mặc định là object map font-file -> base64.
pdfMake.vfs = pdfFonts?.default ?? pdfFonts?.vfs ?? {};
pdfMake.fonts = {
  Roboto: {
    normal: "Roboto-Regular.ttf",
    bold: "Roboto-Medium.ttf",
    italics: "Roboto-Italic.ttf",
    bolditalics: "Roboto-MediumItalic.ttf",
  },
};

function downloadPdf(docDef, fileName) {
  try {
    pdfMake.createPdf(docDef).download(fileName);
  } catch (err) {
    console.error("PDF download failed:", err);
    toast.error("Xuất PDF thất bại");
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const LOGO_CANDIDATE_URLS = [
  logoSrc,
  "/assets/logo/logo.png",
  "/dist/assets/logo/logo.png",
  "./assets/logo/logo.png",
];

const PDF_REPORT_STYLES = {
  sysTitle: { fontSize: 12, bold: true },
  reportTitle: { fontSize: 22, bold: true, alignment: "center" },
  meta: { fontSize: 10 },
  sign: { fontSize: 12, bold: true, alignment: "center" },
};

async function loadLogoDataUrl() {
  for (const url of LOGO_CANDIDATE_URLS) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.drawImage(bitmap, 0, 0);
      return canvas.toDataURL("image/png");
    } catch {
      // thử candidate URL tiếp theo
    }
  }
  return null;
}

function buildPdfDocDef(content) {
  return {
    pageOrientation: "landscape",
    pageSize: "A4",
    pageMargins: [28, 24, 28, 24],
    content,
    styles: PDF_REPORT_STYLES,
    defaultStyle: { fontSize: 10, font: "Roboto" },
  };
}

/** Label tooltip chung */
const fH = (v) => (v == null ? "—" : `${v} giờ`);
const fP = (v) => (v == null ? "—" : `${v}%`);
const fDateTimeVi = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ── KPI Card nhỏ ─────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  color = "text-gray-900",
  sub,
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} className={color} />}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {label}
        </p>
      </div>
      <p className={`text-3xl font-bold leading-tight ${color}`}>
        {value == null ? (
          <span className="text-gray-300 text-xl">N/A</span>
        ) : (
          value
        )}
        {value != null && (
          <span className="text-base font-medium ml-1 text-gray-400">
            {unit}
          </span>
        )}
      </p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key: "mtbf", label: "MTBF", icon: Activity },
  { key: "mttr", label: "MTTR", icon: Clock },
  { key: "downtime", label: "Tỷ lệ dừng máy", icon: TrendingDown },
  { key: "plan", label: "Kế hoạch vs Thực tế", icon: CalendarCheck },
  { key: "pareto", label: "Pareto Downtime", icon: BarChart2 },
];

const PERIOD_OPTIONS = [
  { value: 3, label: "3 tháng" },
  { value: 6, label: "6 tháng" },
  { value: 12, label: "12 tháng" },
  { value: 24, label: "24 tháng" },
];

// ── Tooltip tùy chỉnh cho Pareto ─────────────────────────────────────────────
function ParetoTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-1 max-w-[180px] truncate">
        {label}
      </p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}:{" "}
          <span className="font-bold">
            {p.value}
            {p.name === "Tích lũy %" ? "%" : " giờ"}
          </span>
        </p>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function ReportPerformancePage() {
  const { user } = useAuth();
  // Theo nghiệp vụ: ai xem được báo cáo hiệu suất thì được xuất.
  const canExport = canAccessPerformanceReport(user);
  const [tab, setTab] = useState("mtbf");
  const [months, setMonths] = useState(12);
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [planTypeFilter, setPlanTypeFilter] = useState("ALL");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logoDataUrl, setLogoDataUrl] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const employeeIdForApi =
        tab === "plan" && employeeFilter !== "all"
          ? Number(employeeFilter)
          : undefined;
      const res = await statsApi.performance(
        months,
        employeeIdForApi,
        tab === "plan" ? planTypeFilter : undefined,
      );
      setData(res.data.data);
    } catch {
      toast.error("Không tải được dữ liệu báo cáo hiệu suất");
    } finally {
      setLoading(false);
    }
  }, [months, tab, employeeFilter, planTypeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadLogoDataUrl()
      .then((v) => setLogoDataUrl(v))
      .catch(() => setLogoDataUrl(null));
  }, []);

  if (loading) return <PageLoader />;

  const { mtbf, mttr, downtime, planVsActual, pareto } = data ?? {};
  const selectedPlanTypeLabel =
    planTypeFilter === "PERIODIC"
      ? "Định kỳ"
      : planTypeFilter === "PREDICTIVE"
        ? "Dự báo"
        : planTypeFilter === "EMERGENCY"
          ? "Khẩn cấp"
          : "Tất cả";
  const selectedPlanEmployeeName =
    employeeFilter === "all"
      ? "Tất cả nhân sự"
      : (planVsActual?.employeeOptions ?? []).find(
          (e) => Number(e.employeeId) === Number(employeeFilter),
        )?.fullName ?? "Nhân sự đã chọn";

  // ── Export helpers theo từng tab (không gộp) ───────────────────────────────
  const exportedBy =
    user?.fullName ||
    user?.name ||
    user?.username ||
    `NV #${user?.employeeId ?? "?"}`;

  const guardExport = () => {
    if (!canExport) {
      toast.error("Bạn chưa có quyền xuất báo cáo");
      return false;
    }
    return true;
  };

  const buildHstsRows = () =>
    (mtbf?.byAsset ?? []).map((r) => {
      const mttrRow = (mttr?.byAsset ?? []).find(
        (m) => Number(m.assetId) === Number(r.assetId),
      );
      return {
        assetId: r.assetId,
        assetName: r.assetName,
        totalRunHours: Number(r.totalRunHours || 0),
        failureCount: Number(r.failureCount || 0),
        totalRepairHours: Math.round(Number(mttrRow?.totalRepairHours || 0)),
        mtbf: r.mtbf ?? "",
        mttr: mttrRow?.mttr ?? "",
      };
    });

  const buildPdfHeader = (title) => {
    const nowText = new Date().toLocaleString("vi-VN");
    return [
      {
        columns: [
          logoDataUrl
            ? { image: logoDataUrl, width: 64, margin: [0, 0, 10, 0] }
            : { text: "", width: 64 },
          {
            width: "*",
            stack: [
              {
                text: "PHẦN MỀM BẢO TRÌ TÀI SẢN SẢN XUẤT TÍCH HỢP TÀI NGUYÊN SỐ CÔNG TY CỔ PHẦN XI MĂNG SÔNG GIANH",
                style: "sysTitle",
              },
              {
                text: `Thời gian xuất: ${nowText}    Người xuất: ${exportedBy}`,
                style: "meta",
                margin: [0, 2, 0, 0],
              },
            ],
          },
        ],
      },
      { text: title, style: "reportTitle", margin: [0, 10, 0, 4] },
      { text: `Bộ lọc: ${months} tháng`, alignment: "right", style: "meta" },
    ];
  };

  const exportPlanPdf = () => {
    if (!guardExport()) return;
    const s = planVsActual?.summary;
    const byMonthRows = planVsActual?.byMonth ?? [];
    const byEmployeeRows = planVsActual?.byEmployee ?? [];
    if (!s || (!byMonthRows.length && !byEmployeeRows.length)) {
      return toast.error("Không có dữ liệu để xuất");
    }
    try {
      const content = buildPdfHeader("BÁO CÁO KẾ HOẠCH VS THỰC TẾ");
      content.push({
        text: `Bộ lọc nhân sự: ${selectedPlanEmployeeName}`,
        alignment: "right",
        style: "meta",
        margin: [0, 2, 0, 0],
      });
      content.push({
        text: `Nhóm phiếu việc: ${selectedPlanTypeLabel}`,
        alignment: "right",
        style: "meta",
        margin: [0, 2, 0, 0],
      });
      content.push({
        columns: [
          { text: `Tổng WO theo bộ lọc: ${s.totalScheduled ?? 0}` },
          { text: `Hoàn thành: ${s.completed ?? 0}` },
          { text: `Đúng hạn: ${s.onTime ?? 0}` },
          { text: `Trễ hạn: ${s.late ?? 0}` },
        ],
        margin: [0, 10, 0, 0],
      });
      content.push({
        columns: [
          { text: `Tỷ lệ hoàn thành: ${s.completionRate ?? 0}%` },
          { text: `Tỷ lệ đúng hạn: ${s.onTimeRate ?? 0}%` },
          { text: `Đã hủy: ${s.cancelled ?? 0}` },
          { text: "" },
        ],
        margin: [0, 2, 0, 0],
      });
      if (byMonthRows.length) {
        content.push({
          text: "Tổng hợp theo tháng",
          bold: true,
          margin: [0, 12, 0, 6],
        });
        content.push({
          table: {
            headerRows: 1,
            widths: [80, 80, 80, 80, 80],
            body: [
              ["Tháng", "Tổng KH", "Hoàn thành", "Đúng hạn", "Trễ hạn"],
              ...byMonthRows.map((r) => [
                String(r.month ?? "—"),
                String(r.total ?? 0),
                String(r.completed ?? 0),
                String(r.onTime ?? 0),
                String(r.late ?? 0),
              ]),
            ],
          },
          layout: "lightHorizontalLines",
        });
      }
      if (byEmployeeRows.length) {
        content.push({
          text: "Danh sách nhân sự",
          bold: true,
          margin: [0, 12, 0, 6],
        });
        content.push({
          table: {
            headerRows: 1,
            widths: ["*", 54, 54, 54, 66, 70, 74],
            body: [
              [
                "Nhân sự",
                "Phiếu đảm nhận",
                "Hoàn thành",
                "Đúng hạn",
                "Nhóm phiếu việc",
                "Tỷ lệ đúng hạn",
                "Tổng giờ thực tế",
              ],
              ...byEmployeeRows.map((r) => [
                r.fullName ?? `NV #${r.employeeId}`,
                String(r.assignedCount ?? 0),
                String(r.completedCount ?? 0),
                String(r.onTimeCount ?? 0),
                selectedPlanTypeLabel,
                `${Number(r.onTimeRate ?? 0).toFixed(1)}%`,
                `${Number(r.totalActualHours ?? 0).toFixed(1)} h`,
              ]),
            ],
          },
          layout: "lightHorizontalLines",
        });
      }
      content.push({
        columns: [
          { text: "Người lập báo cáo\n(Ký và ghi rõ họ tên)", style: "sign" },
          { text: "Quản lý hệ thống\n(Ký và ghi rõ họ tên)", style: "sign" },
          { text: "Giám đốc\n(Ký và ghi rõ họ tên)", style: "sign" },
        ],
        columnGap: 12,
        margin: [0, 34, 0, 0],
      });
      const docDef = buildPdfDocDef(content);
      const employeePart =
        employeeFilter === "all" ? "tat-ca-nhan-su" : `nv-${employeeFilter}`;
      downloadPdf(
        docDef,
        `ke-hoach-vs-thuc-te-${months}thang-${employeePart}.pdf`,
      );
      toast.success("Đã xuất PDF Kế hoạch vs Thực tế");
    } catch (err) {
      console.error(err);
      toast.error("Xuất PDF Kế hoạch vs Thực tế thất bại");
    }
  };

  const exportHstsExcel = () => {
    if (!guardExport()) return;
    const rows = buildHstsRows().map((r) => ({
      "Mã máy": r.assetId,
      "Tên máy": r.assetName,
      "Tổng giờ chạy (h)": r.totalRunHours,
      "Số lần hỏng (Emergency)": r.failureCount,
      "Tổng giờ sửa (h)": r.totalRepairHours,
      "MTBF (h)": r.mtbf,
      "MTTR (h)": r.mttr,
    }));
    if (!rows.length) return toast.error("Không có dữ liệu để xuất");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows),
      "Chi so HSTS",
    );
    XLSX.writeFile(wb, `bao-cao-chi-so-hsts-${months}thang.xlsx`);
    toast.success("Đã xuất Excel chỉ số HSTS");
  };

  const exportHstsPdf = () => {
    if (!guardExport()) return;
    const rows = buildHstsRows();
    if (!rows.length) return toast.error("Không có dữ liệu để xuất");
    try {
      const content = buildPdfHeader(
        "BÁO CÁO TỔNG HỢP CHỈ SỐ HIỆU SUẤT TÀI SẢN",
      );
      content.push({
        table: {
          headerRows: 1,
          widths: [50, "*", 82, 84, 70, 50, 50],
          body: [
            [
              "Mã máy",
              "Tên máy",
              "Tổng giờ chạy (h)",
              "Số lần hỏng (Emergency)",
              "Tổng giờ sửa (h)",
              "MTBF (h)",
              "MTTR (h)",
            ],
            ...rows.map((r) => [
              String(r.assetId),
              r.assetName,
              String(r.totalRunHours),
              String(r.failureCount),
              String(r.totalRepairHours),
              String(r.mtbf),
              String(r.mttr),
            ]),
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 12, 0, 0],
      });
      content.push({
        columns: [
          { text: "Người lập báo cáo\n(Ký và ghi rõ họ tên)", style: "sign" },
          { text: "Quản lý hệ thống\n(Ký và ghi rõ họ tên)", style: "sign" },
          { text: "Giám đốc\n(Ký và ghi rõ họ tên)", style: "sign" },
        ],
        columnGap: 12,
        margin: [0, 34, 0, 0],
      });
      const docDef = buildPdfDocDef(content);
      downloadPdf(docDef, `bao-cao-chi-so-hsts-${months}thang.pdf`);
      toast.success("Đã xuất PDF chỉ số HSTS");
    } catch (err) {
      console.error(err);
      toast.error("Xuất PDF chỉ số HSTS thất bại");
    }
  };

  const exportParetoExcel = () => {
    if (!guardExport()) return;
    const rows = (pareto?.rows ?? []).map((r) => ({
      "Mã tài sản": r.assetId,
      "Tên tài sản": r.assetName,
      "Tổng giờ dừng máy (h)": Number(r.downtimeHours || 0),
      "% Tỷ trọng":
        pareto?.total > 0
          ? Number(
              (
                (Number(r.downtimeHours || 0) / Number(pareto.total || 1)) *
                100
              ).toFixed(2),
            )
          : 0,
      "% Tích lũy": Number(r.cumulativePercent || 0),
      "Trạng thái":
        Number(r.cumulativePercent || 0) <= 80
          ? "Ưu tiên 1 (Bôi đỏ)"
          : Number(r.cumulativePercent || 0) <= 95
            ? "Ưu tiên 2 (Bôi đỏ)"
            : "Bình thường",
    }));
    if (!rows.length) return toast.error("Không có dữ liệu để xuất");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows),
      "Pareto Downtime",
    );
    XLSX.writeFile(wb, `bao-cao-pareto-downtime-${months}thang.xlsx`);
    toast.success("Đã xuất Excel Pareto Downtime");
  };

  const exportParetoPdf = () => {
    if (!guardExport()) return;
    const rows = pareto?.rows ?? [];
    if (!rows.length) return toast.error("Không có dữ liệu để xuất");
    try {
      const content = buildPdfHeader("BÁO CÁO PHÂN TÍCH PARETO DOWNTIME");
      content.push({
        table: {
          headerRows: 1,
          widths: [60, "*", 90, 72, 62, 90],
          body: [
            [
              "Mã tài sản",
              "Tên tài sản",
              "Tổng giờ dừng máy (h)",
              "% Tỷ trọng",
              "% Tích lũy",
              "Trạng thái",
            ],
            ...rows.map((r) => {
              const pct =
                Number(pareto?.total || 0) > 0
                  ? (Number(r.downtimeHours || 0) / Number(pareto.total || 1)) *
                    100
                  : 0;
              const cum = Number(r.cumulativePercent || 0);
              const status =
                cum <= 80
                  ? "Ưu tiên 1 (Bôi đỏ)"
                  : cum <= 95
                    ? "Ưu tiên 2 (Bôi đỏ)"
                    : "Bình thường";
              return [
                String(r.assetId),
                r.assetName,
                `${Number(r.downtimeHours || 0).toFixed(2)}`,
                `${pct.toFixed(2)}%`,
                `${cum.toFixed(2)}%`,
                status,
              ];
            }),
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 12, 0, 0],
      });
      content.push({
        columns: [
          { text: "Người lập báo cáo\n(Ký và ghi rõ họ tên)", style: "sign" },
          { text: "Quản lý hệ thống\n(Ký và ghi rõ họ tên)", style: "sign" },
          { text: "Giám đốc\n(Ký và ghi rõ họ tên)", style: "sign" },
        ],
        columnGap: 12,
        margin: [0, 34, 0, 0],
      });
      const docDef = buildPdfDocDef(content);
      downloadPdf(docDef, `bao-cao-pareto-downtime-${months}thang.pdf`);
      toast.success("Đã xuất PDF Pareto Downtime");
    } catch (err) {
      console.error(err);
      toast.error("Xuất PDF Pareto thất bại");
    }
  };

  const exportDowntimeExcel = () => {
    if (!guardExport()) return;
    const rows = (downtime?.logs ?? []).map((r) => ({
      "Mã tài sản": r.assetCode ?? r.assetId,
      "Tên máy": r.assetName ?? "",
      "Dừng lúc nào": fDateTimeVi(r.startAt),
      "Sửa xong lúc nào": fDateTimeVi(r.endAt),
      "Tổng giờ dừng (h)": Number(r.downtimeHours || 0),
      "Nguyên nhân sự cố":
        r.reason ||
        (r.downtimeType === "PLANNED_MAINTENANCE"
          ? "Bảo trì có kế hoạch"
          : "Sự cố đột xuất"),
    }));
    if (!rows.length) return toast.error("Không có dữ liệu để xuất");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows),
      "Nhat ky dung may",
    );
    XLSX.writeFile(wb, `nhat-ky-dung-may-${months}thang.xlsx`);
    toast.success("Đã xuất Excel nhật ký dừng máy");
  };

  const exportDowntimeDetailExcel = () => {
    if (!guardExport()) return;
    const rows = (downtime?.byAsset ?? []).map((r) => ({
      "Mã tài sản": r.assetId,
      "Tên máy": r.assetName ?? "",
      "Vị trí": r.locationName ?? "",
      "Giờ vận hành (h)": Number(r.totalRunHours || 0),
      "Giờ dừng có kế hoạch (h)": Number(r.plannedDowntimeHours || 0),
      "Giờ dừng không kế hoạch (h)": Number(r.unplannedDowntimeHours || 0),
      "Tổng giờ dừng (h)": Number(r.downtimeHours || 0),
      "Tỷ lệ dừng máy (%)": Number(r.downtimePercent || 0),
    }));
    if (!rows.length) return toast.error("Không có dữ liệu để xuất");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows),
      "Chi tiet dung may",
    );
    XLSX.writeFile(wb, `chi-tiet-dung-may-${months}thang.xlsx`);
    toast.success("Đã xuất Excel chi tiết dừng máy");
  };

  const exportDowntimePdf = () => {
    if (!guardExport()) return;
    const rows = downtime?.logs ?? [];
    if (!rows.length) return toast.error("Không có dữ liệu để xuất");
    try {
      const content = buildPdfHeader("NHẬT KÝ DỪNG MÁY");
      content.push({
        table: {
          headerRows: 1,
          widths: [55, 68, 86, 86, 62, "*"],
          body: [
            [
              "Mã tài sản",
              "Tên máy",
              "Dừng lúc nào",
              "Sửa xong lúc nào",
              "Tổng giờ dừng (h)",
              "Nguyên nhân sự cố",
            ],
            ...rows.map((r) => [
              String(r.assetCode ?? r.assetId),
              r.assetName ?? "",
              fDateTimeVi(r.startAt),
              fDateTimeVi(r.endAt),
              `${Number(r.downtimeHours || 0).toFixed(2)}`,
              r.reason ||
                (r.downtimeType === "PLANNED_MAINTENANCE"
                  ? "Bảo trì có kế hoạch"
                  : "Sự cố đột xuất"),
            ]),
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 12, 0, 0],
      });
      content.push({
        columns: [
          { text: "Người lập báo cáo\n(Ký và ghi rõ họ tên)", style: "sign" },
          { text: "Quản lý hệ thống\n(Ký và ghi rõ họ tên)", style: "sign" },
          { text: "Giám đốc\n(Ký và ghi rõ họ tên)", style: "sign" },
        ],
        columnGap: 12,
        margin: [0, 34, 0, 0],
      });
      const docDef = buildPdfDocDef(content);
      downloadPdf(docDef, `nhat-ky-dung-may-${months}thang.pdf`);
      toast.success("Đã xuất PDF nhật ký dừng máy");
    } catch (err) {
      console.error(err);
      toast.error("Xuất PDF nhật ký dừng máy thất bại");
    }
  };

  const exportDowntimeDetailPdf = () => {
    if (!guardExport()) return;
    const rows = downtime?.byAsset ?? [];
    if (!rows.length) return toast.error("Không có dữ liệu để xuất");
    try {
      const content = buildPdfHeader("BÁO CÁO CHI TIẾT DỪNG MÁY");
      content.push({
        table: {
          headerRows: 1,
          widths: [50, "*", 80, 68, 60, 62, 70, 54],
          body: [
            [
              "Mã tài sản",
              "Tên máy",
              "Vị trí",
              "Giờ vận hành (h)",
              "Có kế hoạch (h)",
              "Không kế hoạch (h)",
              "Tổng giờ dừng (h)",
              "Tỷ lệ (%)",
            ],
            ...rows.map((r) => [
              String(r.assetId),
              r.assetName ?? "",
              r.locationName ?? "—",
              Number(r.totalRunHours || 0).toFixed(2),
              Number(r.plannedDowntimeHours || 0).toFixed(2),
              Number(r.unplannedDowntimeHours || 0).toFixed(2),
              Number(r.downtimeHours || 0).toFixed(2),
              Number(r.downtimePercent || 0).toFixed(2),
            ]),
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 12, 0, 0],
      });
      content.push({
        columns: [
          { text: "Người lập báo cáo\n(Ký và ghi rõ họ tên)", style: "sign" },
          { text: "Quản lý hệ thống\n(Ký và ghi rõ họ tên)", style: "sign" },
          { text: "Giám đốc\n(Ký và ghi rõ họ tên)", style: "sign" },
        ],
        columnGap: 12,
        margin: [0, 34, 0, 0],
      });
      const docDef = buildPdfDocDef(content);
      downloadPdf(docDef, `chi-tiet-dung-may-${months}thang.pdf`);
      toast.success("Đã xuất PDF chi tiết dừng máy");
    } catch (err) {
      console.error(err);
      toast.error("Xuất PDF chi tiết dừng máy thất bại");
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Header toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors
                ${tab === key ? "bg-white shadow text-blue-700" : "text-gray-600 hover:text-gray-800"}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Bộ lọc khoảng thời gian + actions */}
        <div className="flex items-center gap-2">
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="text-sm text-gray-900 border border-gray-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={14} /> Làm mới
          </button>
          {(tab === "mtbf" || tab === "mttr") && (
            <>
              <button
                onClick={exportHstsPdf}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  canExport
                    ? "text-white bg-blue-600 hover:bg-blue-700"
                    : "text-gray-400 bg-gray-200 cursor-not-allowed"
                }`}
                title={
                  canExport
                    ? "Xuất PDF báo cáo chỉ số hiệu suất tài sản"
                    : "Thiếu quyền REPORT:EXPORT"
                }
              >
                <Download size={14} /> PDF chỉ số HSTS
              </button>
              <button
                onClick={exportHstsExcel}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  canExport
                    ? "text-gray-700 border-gray-200 hover:bg-gray-50"
                    : "text-gray-400 border-gray-200 bg-gray-100 cursor-not-allowed"
                }`}
                title={
                  canExport
                    ? "Xuất Excel báo cáo chỉ số hiệu suất tài sản"
                    : "Thiếu quyền REPORT:EXPORT"
                }
              >
                <Download size={14} /> Excel chỉ số HSTS
              </button>
            </>
          )}
          {tab === "pareto" && (
            <>
              <button
                onClick={exportParetoPdf}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  canExport
                    ? "text-white bg-blue-600 hover:bg-blue-700"
                    : "text-gray-400 bg-gray-200 cursor-not-allowed"
                }`}
                title={
                  canExport
                    ? "Xuất PDF báo cáo Pareto downtime"
                    : "Thiếu quyền REPORT:EXPORT"
                }
              >
                <Download size={14} /> PDF Pareto
              </button>
              <button
                onClick={exportParetoExcel}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  canExport
                    ? "text-gray-700 border-gray-200 hover:bg-gray-50"
                    : "text-gray-400 border-gray-200 bg-gray-100 cursor-not-allowed"
                }`}
                title={
                  canExport
                    ? "Xuất Excel báo cáo Pareto downtime"
                    : "Thiếu quyền REPORT:EXPORT"
                }
              >
                <Download size={14} /> Excel Pareto
              </button>
            </>
          )}
          {tab === "downtime" && (
            <>
              <button
                onClick={exportDowntimeDetailPdf}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  canExport
                    ? "text-white bg-blue-600 hover:bg-blue-700"
                    : "text-gray-400 bg-gray-200 cursor-not-allowed"
                }`}
                title={
                  canExport
                    ? "Xuất PDF chi tiết dừng máy"
                    : "Thiếu quyền REPORT:EXPORT"
                }
              >
                <Download size={14} /> PDF chi tiết dừng máy
              </button>
              <button
                onClick={exportDowntimeDetailExcel}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  canExport
                    ? "text-gray-700 border-gray-200 hover:bg-gray-50"
                    : "text-gray-400 border-gray-200 bg-gray-100 cursor-not-allowed"
                }`}
                title={
                  canExport
                    ? "Xuất Excel chi tiết dừng máy"
                    : "Thiếu quyền REPORT:EXPORT"
                }
              >
                <Download size={14} /> Excel chi tiết dừng máy
              </button>
              <button
                onClick={exportDowntimePdf}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  canExport
                    ? "text-white bg-blue-600 hover:bg-blue-700"
                    : "text-gray-400 bg-gray-200 cursor-not-allowed"
                }`}
                title={
                  canExport
                    ? "Xuất PDF nhật ký dừng máy"
                    : "Thiếu quyền REPORT:EXPORT"
                }
              >
                <Download size={14} /> PDF nhật ký dừng máy
              </button>
              <button
                onClick={exportDowntimeExcel}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  canExport
                    ? "text-gray-700 border-gray-200 hover:bg-gray-50"
                    : "text-gray-400 border-gray-200 bg-gray-100 cursor-not-allowed"
                }`}
                title={
                  canExport
                    ? "Xuất Excel nhật ký dừng máy"
                    : "Thiếu quyền REPORT:EXPORT"
                }
              >
                <Download size={14} /> Excel nhật ký dừng máy
              </button>
            </>
          )}
          {tab === "plan" && (
            <button
              onClick={exportPlanPdf}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                canExport
                  ? "text-white bg-blue-600 hover:bg-blue-700"
                  : "text-gray-400 bg-gray-200 cursor-not-allowed"
              }`}
              title={
                canExport
                  ? "Xuất PDF Kế hoạch vs Thực tế theo bộ lọc hiện tại"
                  : "Thiếu quyền REPORT:EXPORT"
              }
            >
              <Download size={14} /> PDF kế hoạch vs thực tế
            </button>
          )}
        </div>
      </div>

      {/* ── Tab: MTBF ──────────────────────────────────────────────────────── */}
      {tab === "mtbf" && (
        <div className="space-y-5">
          {/* KPI summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard
              label="MTBF trung bình hệ thống"
              value={mtbf?.overall != null ? mtbf.overall : null}
              unit="giờ/lần hỏng"
              icon={Activity}
              color={
                mtbf?.overall == null
                  ? "text-gray-400"
                  : mtbf.overall >= 100
                    ? "text-green-600"
                    : "text-amber-600"
              }
              sub={`Tổng ${(mtbf?.byAsset ?? []).reduce((s, r) => s + Number(r.failureCount), 0)} lần hỏng khẩn`}
            />
            <KpiCard
              label="Tổng giờ vận hành (đo được)"
              value={(mtbf?.byAsset ?? []).reduce(
                (s, r) => s + Number(r.totalRunHours),
                0,
              )}
              unit="giờ"
              icon={Activity}
              color="text-blue-700"
              sub={`Trong ${months} tháng gần nhất`}
            />
            <KpiCard
              label="Thiết bị có sự cố khẩn"
              value={
                (mtbf?.byAsset ?? []).filter((r) => r.failureCount > 0).length
              }
              unit="thiết bị"
              icon={AlertTriangle}
              color="text-red-600"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Bar chart MTBF */}
            <Card title="MTBF theo thiết bị (giờ/lần hỏng)">
              {(mtbf?.byAsset ?? []).filter((r) => r.mtbf != null).length ===
              0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  Chưa có dữ liệu hỏng đột xuất trong kỳ
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={(mtbf?.byAsset ?? [])
                      .filter((r) => r.mtbf != null)
                      .slice(0, 10)}
                    layout="vertical"
                    margin={{ left: 8, right: 40 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f0f0f0"
                      horizontal={false}
                    />
                    <XAxis type="number" tick={{ fontSize: 11 }} unit=" h" />
                    <YAxis
                      type="category"
                      dataKey="assetName"
                      tick={{ fontSize: 10 }}
                      width={100}
                    />
                    <Tooltip formatter={(v) => [`${v} giờ`, "MTBF"]} />
                    <Bar dataKey="mtbf" name="MTBF" radius={[0, 4, 4, 0]}>
                      {(mtbf?.byAsset ?? [])
                        .filter((r) => r.mtbf != null)
                        .slice(0, 10)
                        .map((r, i) => (
                          <Cell
                            key={i}
                            fill={
                              Number(r.mtbf) >= 100
                                ? "#22c55e"
                                : Number(r.mtbf) >= 50
                                  ? "#f59e0b"
                                  : "#ef4444"
                            }
                          />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Bảng chi tiết MTBF */}
            <Card title="Chi tiết MTBF từng máy">
              {(mtbf?.byAsset ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  Không có dữ liệu
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {["Tài sản", "Giờ chạy", "Lần hỏng", "MTBF"].map(
                          (h) => (
                            <th
                              key={h}
                              className="text-left text-xs font-bold text-gray-600 px-3 py-2"
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(mtbf?.byAsset ?? []).map((r) => (
                        <tr key={r.assetId} className="hover:bg-blue-50/30">
                          <td className="px-3 py-2 font-medium text-gray-900">
                            <p className="truncate max-w-[140px]">
                              {r.assetName}
                            </p>
                            <p className="text-xs text-gray-400">
                              {r.locationName ?? "—"}
                            </p>
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {r.totalRunHours}h
                          </td>
                          <td className="px-3 py-2">
                            <Badge color={r.failureCount > 0 ? "red" : "gray"}>
                              {r.failureCount}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 font-bold">
                            {r.mtbf == null ? (
                              <span className="text-gray-400 font-normal">
                                —
                              </span>
                            ) : (
                              <span
                                className={
                                  Number(r.mtbf) >= 100
                                    ? "text-green-600"
                                    : Number(r.mtbf) >= 50
                                      ? "text-amber-600"
                                      : "text-red-600"
                                }
                              >
                                {r.mtbf}h
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Ghi chú nghiệp vụ */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-800">
            <strong>Công thức:</strong> MTBF = Tổng giờ chạy máy ÷ Số lần phát
            sinh Phiếu việc khẩn cấp hoàn thành. MTBF &ge; 100 giờ{" "}
            <span className="text-green-700 font-semibold">●</span> ổn định —
            50–100 giờ <span className="text-amber-600 font-semibold">●</span>{" "}
            cần theo dõi — &lt; 50 giờ{" "}
            <span className="text-red-600 font-semibold">●</span> nguy cơ cao.
          </div>
        </div>
      )}

      {/* ── Tab: MTTR ──────────────────────────────────────────────────────── */}
      {tab === "mttr" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard
              label="MTTR trung bình hệ thống"
              value={mttr?.overall != null ? mttr.overall : null}
              unit="giờ/lần sửa"
              icon={Clock}
              color={
                mttr?.overall == null
                  ? "text-gray-400"
                  : mttr.overall <= 4
                    ? "text-green-600"
                    : mttr.overall <= 8
                      ? "text-amber-600"
                      : "text-red-600"
              }
              sub={`Tổng ${(mttr?.byAsset ?? []).reduce((s, r) => s + Number(r.repairCount), 0)} lần sửa chữa`}
            />
            <KpiCard
              label="Tổng giờ sửa chữa"
              value={Math.round(
                (mttr?.byAsset ?? []).reduce(
                  (s, r) => s + Number(r.totalRepairHours),
                  0,
                ),
              )}
              unit="giờ"
              icon={Clock}
              color="text-blue-700"
              sub={`Trong ${months} tháng gần nhất`}
            />
            <KpiCard
              label="Thiết bị phát sinh sửa chữa"
              value={(mttr?.byAsset ?? []).length}
              unit="thiết bị"
              icon={AlertTriangle}
              color="text-amber-600"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card title="MTTR theo thiết bị (giờ/lần)">
              {(mttr?.byAsset ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  Chưa có dữ liệu sửa chữa trong kỳ
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={(mttr?.byAsset ?? []).slice(0, 10)}
                    layout="vertical"
                    margin={{ left: 8, right: 40 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f0f0f0"
                      horizontal={false}
                    />
                    <XAxis type="number" tick={{ fontSize: 11 }} unit=" h" />
                    <YAxis
                      type="category"
                      dataKey="assetName"
                      tick={{ fontSize: 10 }}
                      width={100}
                    />
                    <Tooltip formatter={(v) => [`${v} giờ`, "MTTR"]} />
                    <Bar dataKey="mttr" name="MTTR" radius={[0, 4, 4, 0]}>
                      {(mttr?.byAsset ?? []).slice(0, 10).map((r, i) => (
                        <Cell
                          key={i}
                          fill={
                            Number(r.mttr) <= 4
                              ? "#22c55e"
                              : Number(r.mttr) <= 8
                                ? "#f59e0b"
                                : "#ef4444"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card title="Chi tiết MTTR từng máy">
              {(mttr?.byAsset ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  Không có dữ liệu
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {["Tài sản", "Lần sửa", "Tổng giờ", "MTTR"].map((h) => (
                          <th
                            key={h}
                            className="text-left text-xs font-bold text-gray-600 px-3 py-2"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(mttr?.byAsset ?? []).map((r) => (
                        <tr key={r.assetId} className="hover:bg-blue-50/30">
                          <td className="px-3 py-2 font-medium text-gray-900">
                            <p className="truncate max-w-[140px]">
                              {r.assetName}
                            </p>
                            <p className="text-xs text-gray-400">
                              {r.locationName ?? "—"}
                            </p>
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {r.repairCount}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {Math.round(Number(r.totalRepairHours || 0))}h
                          </td>
                          <td className="px-3 py-2 font-bold">
                            <span
                              className={
                                Number(r.mttr) <= 4
                                  ? "text-green-600"
                                  : Number(r.mttr) <= 8
                                    ? "text-amber-600"
                                    : "text-red-600"
                              }
                            >
                              {r.mttr}h
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-800">
            <strong>Công thức:</strong> MTTR = Tổng ActualHours (Phiếu việc sự
            cố hoàn thành) ÷ Số phiếu sửa chữa. MTTR &le; 4 giờ{" "}
            <span className="text-green-700 font-semibold">●</span> nhanh — 4–8
            giờ <span className="text-amber-600 font-semibold">●</span> trung
            bình — &gt; 8 giờ{" "}
            <span className="text-red-600 font-semibold">●</span> cần cải thiện.
          </div>
        </div>
      )}

      {/* ── Tab: Tỷ lệ dừng máy ──────────────────────────────────────────── */}
      {tab === "downtime" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard
              label="Tỷ lệ dừng máy trung bình"
              value={downtime?.overall != null ? downtime.overall : null}
              unit="%"
              icon={TrendingDown}
              color={
                downtime?.overall == null
                  ? "text-gray-400"
                  : downtime.overall <= 5
                    ? "text-green-600"
                    : downtime.overall <= 15
                      ? "text-amber-600"
                      : "text-red-600"
              }
              sub="Giờ sửa chữa / Giờ vận hành"
            />
            <KpiCard
              label="Tổng giờ dừng ước tính"
              value={(downtime?.byAsset ?? [])
                .reduce((s, r) => s + Number(r.downtimeHours), 0)
                .toFixed(1)}
              unit="giờ"
              icon={TrendingDown}
              color="text-red-700"
              sub={`Trong ${months} tháng gần nhất`}
            />
            <KpiCard
              label="Có kế hoạch / Không kế hoạch"
              value={`${Number(downtime?.plannedOverallHours ?? 0).toFixed(1)} / ${Number(downtime?.unplannedOverallHours ?? 0).toFixed(1)}`}
              unit="giờ"
              icon={AlertTriangle}
              color="text-amber-600"
            />
          </div>

          <Card title="Tỷ lệ dừng máy theo thiết bị (%)">
            {(downtime?.byAsset ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                Không có dữ liệu dừng máy trong kỳ
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={(downtime?.byAsset ?? []).slice(0, 15)}
                  layout="vertical"
                  margin={{ left: 8, right: 50 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f0f0f0"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    unit="%"
                    domain={[0, "auto"]}
                  />
                  <YAxis
                    type="category"
                    dataKey="assetName"
                    tick={{ fontSize: 10 }}
                    width={110}
                  />
                  <Tooltip
                    formatter={(v, name) => [
                      name === "Tỷ lệ dừng" ? `${v}%` : `${v}h`,
                      name,
                    ]}
                  />
                  <Bar
                    dataKey="downtimePercent"
                    name="Tỷ lệ dừng"
                    radius={[0, 4, 4, 0]}
                  >
                    {(downtime?.byAsset ?? []).slice(0, 15).map((r, i) => (
                      <Cell
                        key={i}
                        fill={
                          Number(r.downtimePercent) <= 5
                            ? "#22c55e"
                            : Number(r.downtimePercent) <= 15
                              ? "#f59e0b"
                              : "#ef4444"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="Bảng chi tiết dừng máy">
            {(downtime?.byAsset ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                Không có dữ liệu
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {[
                        "Tài sản",
                        "Vị trí",
                        "Giờ vận hành",
                        "Có kế hoạch",
                        "Không kế hoạch",
                        "Giờ dừng",
                        "Tỷ lệ (%)",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left text-xs font-bold text-gray-600 px-3 py-2"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(downtime?.byAsset ?? []).map((r) => (
                      <tr key={r.assetId} className="hover:bg-blue-50/30">
                        <td className="px-3 py-2 font-semibold text-gray-900 truncate max-w-[160px]">
                          {r.assetName}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {r.locationName ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {r.totalRunHours}h
                        </td>
                        <td className="px-3 py-2 text-blue-700 font-medium">
                          {r.plannedDowntimeHours}h
                        </td>
                        <td className="px-3 py-2 text-orange-700 font-medium">
                          {r.unplannedDowntimeHours}h
                        </td>
                        <td className="px-3 py-2 text-red-700 font-medium">
                          {r.downtimeHours}h
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            color={
                              Number(r.downtimePercent) <= 5
                                ? "green"
                                : Number(r.downtimePercent) <= 15
                                  ? "yellow"
                                  : "red"
                            }
                          >
                            {r.downtimePercent}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Nhật ký dừng máy">
            {(downtime?.logs ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                Chưa có sự kiện dừng máy trong kỳ
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {[
                        "Mã tài sản",
                        "Tên máy",
                        "Dừng lúc nào",
                        "Sửa xong lúc nào",
                        "Tổng giờ dừng (h)",
                        "Nguyên nhân sự cố",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left text-xs font-bold text-gray-600 px-3 py-2"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(downtime?.logs ?? []).map((r) => (
                      <tr key={r.eventId} className="hover:bg-blue-50/30">
                        <td className="px-3 py-2 font-mono text-xs text-gray-700">
                          {r.assetCode ?? `#${r.assetId}`}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {r.assetName}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {fDateTimeVi(r.startAt)}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {fDateTimeVi(r.endAt)}
                        </td>
                        <td className="px-3 py-2 text-red-700 font-semibold">
                          {Number(r.downtimeHours || 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {r.reason ||
                            (r.downtimeType === "PLANNED_MAINTENANCE"
                              ? "Bảo trì có kế hoạch"
                              : "Sự cố đột xuất")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-800">
            <strong>Công thức chuẩn:</strong> Downtime% ={" "}
            <em>Giờ dừng / (Giờ chạy + Giờ dừng)</em>.
          </div>
        </div>
      )}

      {/* ── Tab: Kế hoạch vs Thực tế ─────────────────────────────────────── */}
      {tab === "plan" && (
        <div className="space-y-5">
          <Card title="Bộ lọc nhân sự">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-semibold text-gray-700">
                Nhóm phiếu việc
              </label>
              <select
                value={planTypeFilter}
                onChange={(e) => setPlanTypeFilter(e.target.value)}
                className="min-w-[220px] text-sm text-gray-900 border border-gray-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="ALL">Tất cả</option>
                <option value="PERIODIC">Định kỳ</option>
                <option value="PREDICTIVE">Dự báo</option>
                <option value="EMERGENCY">Khẩn cấp</option>
              </select>
              <label className="text-sm font-semibold text-gray-700">
                Nhân sự
              </label>
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="min-w-[260px] text-sm text-gray-900 border border-gray-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="all">Tất cả nhân sự</option>
                {(planVsActual?.employeeOptions ?? []).map((e) => (
                  <option key={e.employeeId} value={String(e.employeeId)}>
                    {e.fullName}
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-500">
                Bộ lọc này chỉ áp dụng cho tab Kế hoạch vs Thực tế.
              </span>
            </div>
          </Card>

          {planVsActual?.summary &&
            (() => {
              const s = planVsActual.summary;
              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard
                    label="Tổng WO theo bộ lọc"
                    value={s.totalScheduled}
                    unit="phiếu"
                    icon={CalendarCheck}
                    color="text-gray-900"
                  />
                  <KpiCard
                    label="Tỷ lệ hoàn thành"
                    value={s.completionRate}
                    unit="%"
                    icon={CheckCircle}
                    color={
                      Number(s.completionRate) >= 90
                        ? "text-green-600"
                        : Number(s.completionRate) >= 70
                          ? "text-amber-600"
                          : "text-red-600"
                    }
                    sub={`${s.completed} / ${s.totalScheduled} WO`}
                  />
                  <KpiCard
                    label="Đúng hạn"
                    value={s.onTimeRate}
                    unit="%"
                    icon={CheckCircle}
                    color={
                      Number(s.onTimeRate) >= 80
                        ? "text-green-600"
                        : Number(s.onTimeRate) >= 60
                          ? "text-amber-600"
                          : "text-red-600"
                    }
                    sub={`${s.onTime} phiếu đúng hạn`}
                  />
                  <KpiCard
                    label="Trễ hạn"
                    value={s.late}
                    unit="phiếu"
                    icon={XCircle}
                    color={
                      Number(s.late) === 0 ? "text-green-600" : "text-red-600"
                    }
                    sub={`${s.cancelled} phiếu đã hủy`}
                  />
                </div>
              );
            })()}

          <Card title={`Kế hoạch vs Thực tế theo tháng (${months} tháng)`}>
            {(planVsActual?.byMonth ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                Chưa có dữ liệu WO theo bộ lọc trong kỳ
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={planVsActual.byMonth}
                  margin={{ top: 5, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="total"
                    name="Tổng KH"
                    fill="#94a3b8"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="completed"
                    name="Hoàn thành"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="onTime"
                    name="Đúng hạn"
                    fill="#22c55e"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="late"
                    name="Trễ hạn"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="Danh sách nhân sự">
            {(planVsActual?.byEmployee ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                Không có dữ liệu nhân sự theo bộ lọc hiện tại
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {[
                        "Nhân sự",
                        "Phiếu đảm nhận",
                        "Hoàn thành",
                        "Đúng hạn",
                        "Nhóm phiếu việc",
                        "Tỷ lệ đúng hạn",
                        "Tổng giờ thực tế",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left text-xs font-bold text-gray-600 px-3 py-2"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(planVsActual?.byEmployee ?? []).map((r) => (
                      <tr
                        key={r.employeeId}
                        className="hover:bg-blue-50/30"
                      >
                        <td className="px-3 py-2 font-semibold text-gray-900">
                          {r.fullName ?? `NV #${r.employeeId}`}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {Number(r.assignedCount || 0)}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {Number(r.completedCount || 0)}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {Number(r.onTimeCount || 0)}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {selectedPlanTypeLabel}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            color={
                              Number(r.onTimeRate || 0) >= 80
                                ? "green"
                                : Number(r.onTimeRate || 0) >= 60
                                  ? "yellow"
                                  : "red"
                            }
                          >
                            {Number(r.onTimeRate || 0).toFixed(1)}%
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {Number(r.totalActualHours || 0).toFixed(1)} h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-800">
            <strong>Công thức:</strong> Tỷ lệ hoàn thành = Phiếu việc hoàn thành
            / Tổng phiếu việc theo bộ lọc. Đúng hạn = Ngày thực hiện ≤ Ngày dự
            kiến.
          </div>
        </div>
      )}

      {/* ── Tab: Pareto Downtime ──────────────────────────────────────────── */}
      {tab === "pareto" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard
              label="Tổng giờ dừng máy (kỳ)"
              value={(pareto?.total ?? 0).toFixed(1)}
              unit="giờ"
              icon={TrendingDown}
              color="text-red-700"
              sub={`${months} tháng gần nhất`}
            />
            <KpiCard
              label="Số thiết bị phát sinh"
              value={(pareto?.rows ?? []).length}
              unit="máy"
              icon={AlertTriangle}
              color="text-amber-600"
            />
            <KpiCard
              label="Top 20% gây ra"
              value={(() => {
                const rows = pareto?.rows ?? [];
                if (!rows.length) return 0;
                const top20pct = Math.max(1, Math.ceil(rows.length * 0.2));
                const topHours = rows
                  .slice(0, top20pct)
                  .reduce((s, r) => s + Number(r.downtimeHours), 0);
                const total = rows.reduce(
                  (s, r) => s + Number(r.downtimeHours),
                  0,
                );
                if (!(total > 0)) return 0;
                const pct = (topHours / total) * 100;
                return Math.min(100, Math.max(0, Math.round(pct)));
              })()}
              unit="% downtime"
              icon={BarChart2}
              color="text-purple-700"
              sub={`Từ top 20% thiết bị (Pareto 80/20)`}
            />
          </div>

          <Card title="Biểu đồ Pareto — Tổng giờ dừng & Tích lũy (%)">
            {(pareto?.rows ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                Chưa có dữ liệu dừng máy trong kỳ
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart
                  data={pareto.rows}
                  margin={{ top: 5, right: 50, left: 0, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="assetName"
                    tick={{ fontSize: 10 }}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} unit="h" />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    unit="%"
                    domain={[0, 100]}
                  />
                  <Tooltip content={<ParetoTooltip />} />
                  <Legend verticalAlign="top" />
                  <Bar
                    yAxisId="left"
                    dataKey="downtimeHours"
                    name="Giờ dừng"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cumulativePercent"
                    name="Tích lũy %"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#6366f1" }}
                  />
                  <ReferenceLine
                    yAxisId="right"
                    y={80}
                    stroke="#f59e0b"
                    strokeDasharray="6 3"
                    label={{
                      value: "80%",
                      position: "insideTopRight",
                      fontSize: 11,
                      fill: "#d97706",
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Bảng Pareto */}
          <Card title="Bảng xếp hạng thiết bị gây dừng máy">
            {(pareto?.rows ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                Không có dữ liệu
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {[
                        "#",
                        "Tài sản",
                        "Vị trí",
                        "Planned",
                        "Unplanned",
                        "Giờ dừng",
                        "Tích lũy %",
                        "Phân loại",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left text-xs font-bold text-gray-600 px-3 py-2"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(pareto?.rows ?? []).map((r, i) => {
                      const isTop80 = r.cumulativePercent <= 80;
                      return (
                        <tr
                          key={r.assetId}
                          className={`hover:bg-blue-50/30 ${isTop80 ? "bg-red-50/30" : ""}`}
                        >
                          <td className="px-3 py-2 text-gray-500 font-mono">
                            #{i + 1}
                          </td>
                          <td className="px-3 py-2 font-semibold text-gray-900 truncate max-w-[160px]">
                            {r.assetName}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {r.locationName ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-blue-700 font-medium">
                            {r.plannedHours}h
                          </td>
                          <td className="px-3 py-2 text-orange-700 font-medium">
                            {r.unplannedHours}h
                          </td>
                          <td className="px-3 py-2 font-bold text-red-700">
                            {r.downtimeHours}h
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${r.cumulativePercent <= 80 ? "bg-red-500" : "bg-purple-400"}`}
                                  style={{
                                    width: `${Math.min(r.cumulativePercent, 100)}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs font-medium text-gray-700">
                                {r.cumulativePercent}%
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {isTop80 ? (
                              <Badge color="red">Ưu tiên cao</Badge>
                            ) : (
                              <Badge color="gray">Thứ yếu</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 text-xs text-purple-800">
            <strong>Phân tích 80/20:</strong> Các thiết bị có{" "}
            <strong>Tích lũy % &le; 80%</strong> (vùng đỏ) là nhóm 20% máy gây
            ra 80% tổng thời gian dừng. Ưu tiên phân bổ nguồn lực bảo trì cho
            nhóm này trước.
          </div>
        </div>
      )}
    </div>
  );
}
