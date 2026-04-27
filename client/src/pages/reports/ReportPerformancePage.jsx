/**
 * ReportPerformancePage.jsx — BFD 6.4: Báo cáo hiệu suất & tình trạng tài sản.
 * Gồm: MTBF, MTTR, Tỷ lệ dừng máy, Kế hoạch vs Thực tế, Pareto Downtime.
 * RBAC: Trưởng/Phó bảo trì & PKT (L3), Quản trị (L4+), Ban GĐ — không gồm CV KTS.
 * Liên quan: api/stats.api.js, utils/rbac.js (canAccessPerformanceReport), routes stats.routes.js.
 */
import { useEffect, useState, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { statsApi }    from '../../api/stats.api.js';
import { Card }        from '../../components/ui/Card.jsx';
import { Badge }       from '../../components/ui/Badge.jsx';
import { PageLoader }  from '../../components/ui/Spinner.jsx';
import { canAccessPerformanceReport } from '../../utils/rbac.js';
import { useAuth }     from '../../contexts/AuthContext.jsx';
import toast           from 'react-hot-toast';
import {
  Activity, Clock, TrendingDown, CalendarCheck,
  BarChart2, Download, RefreshCw, AlertTriangle,
  CheckCircle, XCircle,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────
function downloadCSV(data, filename) {
  if (!data?.length) { toast.error('Không có dữ liệu để xuất'); return; }
  const headers = Object.keys(data[0]);
  const rows    = data.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','));
  const csv     = [headers.join(','), ...rows].join('\r\n');
  const blob    = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const LOGO_URL = '/assets/logo/logo.png';

async function loadLogoDataUrl() {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Label tooltip chung */
const fH = (v) => v == null ? '—' : `${v} giờ`;
const fP = (v) => v == null ? '—' : `${v}%`;

// ── KPI Card nhỏ ─────────────────────────────────────────────────────────────
function KpiCard({ label, value, unit, icon: Icon, color = 'text-gray-900', sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} className={color} />}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-3xl font-bold leading-tight ${color}`}>
        {value == null ? <span className="text-gray-300 text-xl">N/A</span> : value}
        {value != null && <span className="text-base font-medium ml-1 text-gray-400">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'mtbf',    label: 'MTBF',             icon: Activity    },
  { key: 'mttr',    label: 'MTTR',             icon: Clock       },
  { key: 'downtime',label: 'Tỷ lệ dừng máy',  icon: TrendingDown },
  { key: 'plan',    label: 'Kế hoạch vs Thực tế', icon: CalendarCheck },
  { key: 'pareto',  label: 'Pareto Downtime',  icon: BarChart2   },
];

const PERIOD_OPTIONS = [
  { value: 3,  label: '3 tháng'  },
  { value: 6,  label: '6 tháng'  },
  { value: 12, label: '12 tháng' },
  { value: 24, label: '24 tháng' },
];

// ── Tooltip tùy chỉnh cho Pareto ─────────────────────────────────────────────
function ParetoTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-1 max-w-[180px] truncate">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}{p.name === 'Tích lũy %' ? '%' : ' giờ'}</span>
        </p>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function ReportPerformancePage() {
  const { user }      = useAuth();
  // Theo nghiệp vụ: ai xem được báo cáo hiệu suất thì được xuất.
  const canExport     = canAccessPerformanceReport(user);
  const [tab,         setTab]     = useState('mtbf');
  const [months,      setMonths]  = useState(12);
  const [data,        setData]    = useState(null);
  const [loading,     setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await statsApi.performance(months);
      setData(res.data.data);
    } catch {
      toast.error('Không tải được dữ liệu báo cáo hiệu suất');
    } finally {
      setLoading(false);
    }
  }, [months]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageLoader />;

  const { mtbf, mttr, downtime, planVsActual, pareto } = data ?? {};

  // ── Export helpers ──────────────────────────────────────────────────────────
  const exportCurrent = () => {
    if (tab === 'mtbf') {
      downloadCSV(
        (mtbf?.byAsset ?? []).map(r => ({
          'Tài sản': r.assetName, 'Vị trí': r.locationName ?? '',
          'Giờ chạy': r.totalRunHours, 'Lần hỏng': r.failureCount, 'MTBF (giờ)': r.mtbf ?? '',
        })), `mtbf-${months}thang.csv`,
      );
    } else if (tab === 'mttr') {
      downloadCSV(
        (mttr?.byAsset ?? []).map(r => ({
          'Tài sản': r.assetName, 'Vị trí': r.locationName ?? '',
          'Số lần sửa': r.repairCount, 'Tổng giờ': Math.round(Number(r.totalRepairHours || 0)), 'MTTR (giờ)': r.mttr ?? '',
        })), `mttr-${months}thang.csv`,
      );
    } else if (tab === 'downtime') {
      downloadCSV(
        (downtime?.byAsset ?? []).map(r => ({
          'Tài sản': r.assetName, 'Vị trí': r.locationName ?? '',
          'Giờ chạy': r.totalRunHours, 'Giờ dừng': r.downtimeHours,
          'Planned dừng': r.plannedDowntimeHours,
          'Unplanned dừng': r.unplannedDowntimeHours,
          'Tỷ lệ (%)': r.downtimePercent,
        })), `downtime-${months}thang.csv`,
      );
    } else if (tab === 'plan') {
      downloadCSV(
        (planVsActual?.byMonth ?? []).map(r => ({
          'Tháng': r.month, 'Tổng KH': r.total, 'Hoàn thành': r.completed,
          'Đúng hạn': r.onTime, 'Trễ': r.late,
        })), `ke-hoach-thuc-te-${months}thang.csv`,
      );
    } else if (tab === 'pareto') {
      downloadCSV(
        (pareto?.rows ?? []).map(r => ({
          'Tài sản': r.assetName,
          'Giờ dừng': r.downtimeHours,
          'Planned': r.plannedHours,
          'Unplanned': r.unplannedHours,
          'Tích lũy (%)': r.cumulativePercent,
        })), `pareto-${months}thang.csv`,
      );
    }
  };

  const exportPerformanceExcel = () => {
    if (!canExport) {
      toast.error('Bạn chưa có quyền REPORT:EXPORT để xuất báo cáo');
      return;
    }
    const wb = XLSX.utils.book_new();
    const mtbfSheet = XLSX.utils.json_to_sheet(
      (mtbf?.byAsset ?? []).map((r) => ({
        'Mã tài sản': r.assetId,
        'Tên tài sản': r.assetName,
        'Vị trí': r.locationName ?? '',
        'Tổng giờ chạy (h)': Number(r.totalRunHours || 0),
        'Số lần hỏng (Emergency)': Number(r.failureCount || 0),
        'MTBF (h)': r.mtbf ?? '',
      })),
    );
    const mttrSheet = XLSX.utils.json_to_sheet(
      (mttr?.byAsset ?? []).map((r) => ({
        'Mã tài sản': r.assetId,
        'Tên tài sản': r.assetName,
        'Vị trí': r.locationName ?? '',
        'Số lần sửa': Number(r.repairCount || 0),
        'Tổng giờ sửa (h)': Math.round(Number(r.totalRepairHours || 0)),
        'MTTR (h)': r.mttr ?? '',
      })),
    );
    const paretoSheet = XLSX.utils.json_to_sheet(
      (pareto?.rows ?? []).map((r) => ({
        'Mã tài sản': r.assetId,
        'Tên tài sản': r.assetName,
        'Vị trí': r.locationName ?? '',
        'Downtime (h)': Number(r.downtimeHours || 0),
        'Planned (h)': Number(r.plannedHours || 0),
        'Unplanned (h)': Number(r.unplannedHours || 0),
        'Tích lũy (%)': Number(r.cumulativePercent || 0),
        'Ưu tiên 80/20': Number(r.cumulativePercent || 0) <= 80 ? 'Ưu tiên 1' : 'Ưu tiên 2',
      })),
    );
    const downtimeLogSheet = XLSX.utils.json_to_sheet(
      (downtime?.byAsset ?? []).map((r) => ({
        'Mã tài sản': r.assetId,
        'Tên tài sản': r.assetName,
        'Vị trí': r.locationName ?? '',
        'Downtime tổng (h)': Number(r.downtimeHours || 0),
        'Planned (h)': Number(r.plannedDowntimeHours || 0),
        'Unplanned (h)': Number(r.unplannedDowntimeHours || 0),
        'Tỷ lệ dừng (%)': Number(r.downtimePercent || 0),
      })),
    );
    XLSX.utils.book_append_sheet(wb, mtbfSheet, 'Tong hieu suat');
    XLSX.utils.book_append_sheet(wb, mttrSheet, 'MTTR');
    XLSX.utils.book_append_sheet(wb, paretoSheet, 'Pareto');
    XLSX.utils.book_append_sheet(wb, downtimeLogSheet, 'Nhat ky dung may');
    XLSX.writeFile(wb, `bao-cao-hieu-suat-${months}thang.xlsx`);
  };

  const exportPerformancePdf = async () => {
    try {
      if (!canExport) {
        toast.error('Bạn chưa có quyền xuất báo cáo');
        return;
      }
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const now = new Date();
      const generatedAt = `${now.toLocaleTimeString('vi-VN')} ${now.toLocaleDateString('vi-VN')}`;
      const exportedBy =
        user?.fullName ||
        user?.name ||
        user?.username ||
        user?.email ||
        `Employee #${user?.employeeId ?? 'unknown'}`;
      const logoDataUrl = await loadLogoDataUrl();

      const drawHeaderFooter = (title) => {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageW, 18, 'F');
        if (logoDataUrl) {
          try {
            doc.addImage(logoDataUrl, 'PNG', 8, 3, 12, 12);
          } catch {
            // Bỏ qua lỗi logo để vẫn xuất được PDF
          }
        }
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('BAO CAO HIEU SUAT TAI SAN', 24, 11);
        doc.setFontSize(9);
        doc.text(`Ky: ${months} thang`, pageW - 40, 7);
        doc.text(`Trang ${doc.getNumberOfPages()}`, pageW - 40, 12);
        doc.setTextColor(20, 20, 20);
        doc.setFontSize(14);
        doc.text(title, 14, 28);
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(`Nguoi xuat: ${exportedBy}`, 14, pageH - 12);
        doc.text(`Bao cao trich xuat tu he thong luc ${generatedAt}`, 14, pageH - 8);
        doc.setTextColor(20, 20, 20);
      };

      drawHeaderFooter('1) Tong quan KPI');
      autoTable(doc, {
      startY: 34,
      head: [['Chi so', 'Gia tri']],
      body: [
        ['MTBF trung binh (h)', mtbf?.overall ?? '—'],
        ['MTTR trung binh (h)', mttr?.overall ?? '—'],
        ['Downtime trung binh (%)', downtime?.overall ?? '—'],
        ['Tong planned downtime (h)', Number(downtime?.plannedOverallHours ?? 0).toFixed(2)],
        ['Tong unplanned downtime (h)', Number(downtime?.unplannedOverallHours ?? 0).toFixed(2)],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 41, 59] },
    });

      doc.addPage();
      drawHeaderFooter('2) MTBF & MTTR chi tiet');
      autoTable(doc, {
      startY: 34,
      head: [['Ma TS', 'Ten tai san', 'Tong gio chay', 'Lan hong', 'Tong gio sua', 'MTBF', 'MTTR']],
      body: (mtbf?.byAsset ?? []).map((r) => {
        const mttrRow = (mttr?.byAsset ?? []).find((m) => Number(m.assetId) === Number(r.assetId));
        return [
          r.assetId,
          r.assetName,
          Number(r.totalRunHours || 0).toFixed(2),
          Number(r.failureCount || 0),
          Math.round(Number(mttrRow?.totalRepairHours || 0)),
          r.mtbf ?? '—',
          mttrRow?.mttr ?? '—',
        ];
      }),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59] },
      columnStyles: { 1: { cellWidth: 42 } },
    });

      doc.addPage();
      drawHeaderFooter('3) Pareto downtime');
      autoTable(doc, {
      startY: 34,
      head: [['#', 'Ma TS', 'Ten tai san', 'Downtime (h)', 'Planned (h)', 'Unplanned (h)', 'Tich luy (%)', 'Uu tien']],
      body: (pareto?.rows ?? []).map((r, idx) => [
        idx + 1,
        r.assetId,
        r.assetName,
        Number(r.downtimeHours || 0).toFixed(2),
        Number(r.plannedHours || 0).toFixed(2),
        Number(r.unplannedHours || 0).toFixed(2),
        Number(r.cumulativePercent || 0).toFixed(1),
        Number(r.cumulativePercent || 0) <= 80 ? 'Uu tien 1' : 'Uu tien 2',
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59] },
      didParseCell: (hookData) => {
        if (hookData.section === 'body') {
          const cum = Number(hookData.row.raw?.[6] || 0);
          if (cum <= 80) hookData.cell.styles.fillColor = [254, 226, 226];
        }
      },
    });

      doc.addPage();
      drawHeaderFooter('4) Nhat ky downtime theo tai san');
      autoTable(doc, {
      startY: 34,
      head: [['Ma TS', 'Ten tai san', 'Tong dung (h)', 'Planned', 'Unplanned', 'Ty le (%)']],
      body: (downtime?.byAsset ?? []).map((r) => [
        r.assetId,
        r.assetName,
        Number(r.downtimeHours || 0).toFixed(2),
        Number(r.plannedDowntimeHours || 0).toFixed(2),
        Number(r.unplannedDowntimeHours || 0).toFixed(2),
        Number(r.downtimePercent || 0).toFixed(2),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59] },
      columnStyles: { 1: { cellWidth: 52 } },
    });

      doc.save(`bao-cao-hieu-suat-${months}thang.pdf`);
      toast.success('Đã tạo file PDF báo cáo');
    } catch (err) {
      console.error('Export PDF failed:', err);
      toast.error('Xuất PDF lỗi. Mở Console (F12) để xem chi tiết.');
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
                ${tab === key ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-800'}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Bộ lọc khoảng thời gian + actions */}
        <div className="flex items-center gap-2">
          <select
            value={months}
            onChange={e => setMonths(Number(e.target.value))}
            className="text-sm text-gray-900 border border-gray-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {PERIOD_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={14} /> Làm mới
          </button>
          <>
            <button
              onClick={exportPerformancePdf}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                canExport
                  ? 'text-white bg-blue-600 hover:bg-blue-700'
                  : 'text-gray-400 bg-gray-200 cursor-not-allowed'
              }`}
              title={canExport ? 'Xuất PDF báo cáo' : 'Thiếu quyền REPORT:EXPORT'}
            >
              <Download size={14} /> Xuất PDF đẹp
            </button>
            <button
              onClick={exportPerformanceExcel}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                canExport
                  ? 'text-gray-700 border-gray-200 hover:bg-gray-50'
                  : 'text-gray-400 border-gray-200 bg-gray-100 cursor-not-allowed'
              }`}
              title={canExport ? 'Xuất Excel báo cáo' : 'Thiếu quyền REPORT:EXPORT'}
            >
              <Download size={14} /> Xuất Excel
            </button>
            <button
              onClick={exportCurrent}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                canExport
                  ? 'text-gray-700 border-gray-200 hover:bg-gray-50'
                  : 'text-gray-400 border-gray-200 bg-gray-100 cursor-not-allowed'
              }`}
              title={canExport ? 'Xuất CSV báo cáo' : 'Thiếu quyền REPORT:EXPORT'}
            >
              <Download size={14} /> Xuất CSV
            </button>
          </>
        </div>
      </div>

      {/* ── Tab: MTBF ──────────────────────────────────────────────────────── */}
      {tab === 'mtbf' && (
        <div className="space-y-5">
          {/* KPI summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard
              label="MTBF trung bình hệ thống"
              value={mtbf?.overall != null ? mtbf.overall : null}
              unit="giờ/lần hỏng"
              icon={Activity}
              color={mtbf?.overall == null ? 'text-gray-400' : mtbf.overall >= 100 ? 'text-green-600' : 'text-amber-600'}
              sub={`Tổng ${(mtbf?.byAsset ?? []).reduce((s, r) => s + Number(r.failureCount), 0)} lần hỏng khẩn`}
            />
            <KpiCard
              label="Tổng giờ vận hành (đo được)"
              value={(mtbf?.byAsset ?? []).reduce((s, r) => s + Number(r.totalRunHours), 0)}
              unit="giờ"
              icon={Activity}
              color="text-blue-700"
              sub={`Trong ${months} tháng gần nhất`}
            />
            <KpiCard
              label="Thiết bị có sự cố EMERGENCY"
              value={(mtbf?.byAsset ?? []).filter(r => r.failureCount > 0).length}
              unit="thiết bị"
              icon={AlertTriangle}
              color="text-red-600"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Bar chart MTBF */}
            <Card title="MTBF theo thiết bị (giờ/lần hỏng)">
              {(mtbf?.byAsset ?? []).filter(r => r.mtbf != null).length === 0
                ? <p className="text-sm text-gray-400 text-center py-8">Chưa có dữ liệu hỏng đột xuất trong kỳ</p>
                : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={(mtbf?.byAsset ?? []).filter(r => r.mtbf != null).slice(0, 10)}
                      layout="vertical" margin={{ left: 8, right: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} unit=" h" />
                      <YAxis type="category" dataKey="assetName" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip formatter={(v) => [`${v} giờ`, 'MTBF']} />
                      <Bar dataKey="mtbf" name="MTBF" radius={[0, 4, 4, 0]}>
                        {(mtbf?.byAsset ?? []).filter(r => r.mtbf != null).slice(0, 10).map((r, i) => (
                          <Cell key={i} fill={Number(r.mtbf) >= 100 ? '#22c55e' : Number(r.mtbf) >= 50 ? '#f59e0b' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
            </Card>

            {/* Bảng chi tiết MTBF */}
            <Card title="Chi tiết MTBF từng máy">
              {(mtbf?.byAsset ?? []).length === 0
                ? <p className="text-sm text-gray-400 text-center py-8">Không có dữ liệu</p>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['Tài sản', 'Giờ chạy', 'Lần hỏng', 'MTBF'].map(h => (
                            <th key={h} className="text-left text-xs font-bold text-gray-600 px-3 py-2">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(mtbf?.byAsset ?? []).map(r => (
                          <tr key={r.assetId} className="hover:bg-blue-50/30">
                            <td className="px-3 py-2 font-medium text-gray-900">
                              <p className="truncate max-w-[140px]">{r.assetName}</p>
                              <p className="text-xs text-gray-400">{r.locationName ?? '—'}</p>
                            </td>
                            <td className="px-3 py-2 text-gray-700">{r.totalRunHours}h</td>
                            <td className="px-3 py-2">
                              <Badge color={r.failureCount > 0 ? 'red' : 'gray'}>{r.failureCount}</Badge>
                            </td>
                            <td className="px-3 py-2 font-bold">
                              {r.mtbf == null
                                ? <span className="text-gray-400 font-normal">—</span>
                                : <span className={Number(r.mtbf) >= 100 ? 'text-green-600' : Number(r.mtbf) >= 50 ? 'text-amber-600' : 'text-red-600'}>
                                    {r.mtbf}h
                                  </span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </Card>
          </div>

          {/* Ghi chú nghiệp vụ */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-800">
            <strong>Công thức:</strong> MTBF = Tổng giờ chạy máy ÷ Số lần phát sinh WO EMERGENCY hoàn thành.
            MTBF &ge; 100 giờ <span className="text-green-700 font-semibold">●</span> ổn định —
            50–100 giờ <span className="text-amber-600 font-semibold">●</span> cần theo dõi —
            &lt; 50 giờ <span className="text-red-600 font-semibold">●</span> nguy cơ cao.
          </div>
        </div>
      )}

      {/* ── Tab: MTTR ──────────────────────────────────────────────────────── */}
      {tab === 'mttr' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard
              label="MTTR trung bình hệ thống"
              value={mttr?.overall != null ? mttr.overall : null}
              unit="giờ/lần sửa"
              icon={Clock}
              color={mttr?.overall == null ? 'text-gray-400' : mttr.overall <= 4 ? 'text-green-600' : mttr.overall <= 8 ? 'text-amber-600' : 'text-red-600'}
              sub={`Tổng ${(mttr?.byAsset ?? []).reduce((s, r) => s + Number(r.repairCount), 0)} lần sửa chữa`}
            />
            <KpiCard
              label="Tổng giờ sửa chữa"
              value={Math.round((mttr?.byAsset ?? []).reduce((s, r) => s + Number(r.totalRepairHours), 0))}
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
              {(mttr?.byAsset ?? []).length === 0
                ? <p className="text-sm text-gray-400 text-center py-8">Chưa có dữ liệu sửa chữa trong kỳ</p>
                : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={(mttr?.byAsset ?? []).slice(0, 10)}
                      layout="vertical" margin={{ left: 8, right: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} unit=" h" />
                      <YAxis type="category" dataKey="assetName" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip formatter={(v) => [`${v} giờ`, 'MTTR']} />
                      <Bar dataKey="mttr" name="MTTR" radius={[0, 4, 4, 0]}>
                        {(mttr?.byAsset ?? []).slice(0, 10).map((r, i) => (
                          <Cell key={i} fill={Number(r.mttr) <= 4 ? '#22c55e' : Number(r.mttr) <= 8 ? '#f59e0b' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
            </Card>

            <Card title="Chi tiết MTTR từng máy">
              {(mttr?.byAsset ?? []).length === 0
                ? <p className="text-sm text-gray-400 text-center py-8">Không có dữ liệu</p>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['Tài sản', 'Lần sửa', 'Tổng giờ', 'MTTR'].map(h => (
                            <th key={h} className="text-left text-xs font-bold text-gray-600 px-3 py-2">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(mttr?.byAsset ?? []).map(r => (
                          <tr key={r.assetId} className="hover:bg-blue-50/30">
                            <td className="px-3 py-2 font-medium text-gray-900">
                              <p className="truncate max-w-[140px]">{r.assetName}</p>
                              <p className="text-xs text-gray-400">{r.locationName ?? '—'}</p>
                            </td>
                            <td className="px-3 py-2 text-gray-700">{r.repairCount}</td>
                            <td className="px-3 py-2 text-gray-700">{Math.round(Number(r.totalRepairHours || 0))}h</td>
                            <td className="px-3 py-2 font-bold">
                              <span className={Number(r.mttr) <= 4 ? 'text-green-600' : Number(r.mttr) <= 8 ? 'text-amber-600' : 'text-red-600'}>
                                {r.mttr}h
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </Card>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-800">
            <strong>Công thức:</strong> MTTR = Tổng ActualHours (WO CORRECTIVE hoàn thành) ÷ Số phiếu sửa chữa.
            MTTR &le; 4 giờ <span className="text-green-700 font-semibold">●</span> nhanh —
            4–8 giờ <span className="text-amber-600 font-semibold">●</span> trung bình —
            &gt; 8 giờ <span className="text-red-600 font-semibold">●</span> cần cải thiện.
          </div>
        </div>
      )}

      {/* ── Tab: Tỷ lệ dừng máy ──────────────────────────────────────────── */}
      {tab === 'downtime' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard
              label="Tỷ lệ dừng máy trung bình"
              value={downtime?.overall != null ? downtime.overall : null}
              unit="%"
              icon={TrendingDown}
              color={downtime?.overall == null ? 'text-gray-400' : downtime.overall <= 5 ? 'text-green-600' : downtime.overall <= 15 ? 'text-amber-600' : 'text-red-600'}
              sub="Giờ sửa chữa / Giờ vận hành"
            />
            <KpiCard
              label="Tổng giờ dừng ước tính"
              value={(downtime?.byAsset ?? []).reduce((s, r) => s + Number(r.downtimeHours), 0).toFixed(1)}
              unit="giờ"
              icon={TrendingDown}
              color="text-red-700"
              sub={`Trong ${months} tháng gần nhất`}
            />
            <KpiCard
              label="Planned / Unplanned"
              value={`${Number(downtime?.plannedOverallHours ?? 0).toFixed(1)} / ${Number(downtime?.unplannedOverallHours ?? 0).toFixed(1)}`}
              unit="giờ"
              icon={AlertTriangle}
              color="text-amber-600"
            />
          </div>

          <Card title="Tỷ lệ dừng máy theo thiết bị (%)">
            {(downtime?.byAsset ?? []).length === 0
              ? <p className="text-sm text-gray-400 text-center py-8">Không có dữ liệu dừng máy trong kỳ</p>
              : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={(downtime?.byAsset ?? []).slice(0, 15)}
                    layout="vertical" margin={{ left: 8, right: 50 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} unit="%" domain={[0, 'auto']} />
                    <YAxis type="category" dataKey="assetName" tick={{ fontSize: 10 }} width={110} />
                    <Tooltip formatter={(v, name) => [name === 'Tỷ lệ dừng' ? `${v}%` : `${v}h`, name]} />
                    <Bar dataKey="downtimePercent" name="Tỷ lệ dừng" radius={[0, 4, 4, 0]}>
                      {(downtime?.byAsset ?? []).slice(0, 15).map((r, i) => (
                        <Cell key={i} fill={Number(r.downtimePercent) <= 5 ? '#22c55e' : Number(r.downtimePercent) <= 15 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </Card>

          <Card title="Bảng chi tiết dừng máy">
            {(downtime?.byAsset ?? []).length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">Không có dữ liệu</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Tài sản', 'Vị trí', 'Giờ vận hành', 'Planned', 'Unplanned', 'Giờ dừng', 'Tỷ lệ (%)'].map(h => (
                          <th key={h} className="text-left text-xs font-bold text-gray-600 px-3 py-2">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(downtime?.byAsset ?? []).map(r => (
                        <tr key={r.assetId} className="hover:bg-blue-50/30">
                          <td className="px-3 py-2 font-semibold text-gray-900 truncate max-w-[160px]">{r.assetName}</td>
                          <td className="px-3 py-2 text-gray-700">{r.locationName ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-700">{r.totalRunHours}h</td>
                          <td className="px-3 py-2 text-blue-700 font-medium">{r.plannedDowntimeHours}h</td>
                          <td className="px-3 py-2 text-orange-700 font-medium">{r.unplannedDowntimeHours}h</td>
                          <td className="px-3 py-2 text-red-700 font-medium">{r.downtimeHours}h</td>
                          <td className="px-3 py-2">
                            <Badge color={Number(r.downtimePercent) <= 5 ? 'green' : Number(r.downtimePercent) <= 15 ? 'yellow' : 'red'}>
                              {r.downtimePercent}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </Card>

          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-800">
            <strong>Công thức chuẩn:</strong> Downtime% = <em>Giờ dừng / (Giờ chạy + Giờ dừng)</em>.
            Giờ dừng lấy từ <code>AssetDowntimeEvents</code> gồm planned (bảo trì có tắt máy) và unplanned (hỏng hóc/BROKEN).
          </div>
        </div>
      )}

      {/* ── Tab: Kế hoạch vs Thực tế ─────────────────────────────────────── */}
      {tab === 'plan' && (
        <div className="space-y-5">
          {planVsActual?.summary && (() => {
            const s = planVsActual.summary;
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard
                  label="Tổng WO theo lịch"
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
                  color={Number(s.completionRate) >= 90 ? 'text-green-600' : Number(s.completionRate) >= 70 ? 'text-amber-600' : 'text-red-600'}
                  sub={`${s.completed} / ${s.totalScheduled} WO`}
                />
                <KpiCard
                  label="Đúng hạn"
                  value={s.onTimeRate}
                  unit="%"
                  icon={CheckCircle}
                  color={Number(s.onTimeRate) >= 80 ? 'text-green-600' : Number(s.onTimeRate) >= 60 ? 'text-amber-600' : 'text-red-600'}
                  sub={`${s.onTime} phiếu đúng hạn`}
                />
                <KpiCard
                  label="Trễ hạn"
                  value={s.late}
                  unit="phiếu"
                  icon={XCircle}
                  color={Number(s.late) === 0 ? 'text-green-600' : 'text-red-600'}
                  sub={`${s.cancelled} phiếu đã hủy`}
                />
              </div>
            );
          })()}

          <Card title={`Kế hoạch vs Thực tế theo tháng (${months} tháng)`}>
            {(planVsActual?.byMonth ?? []).length === 0
              ? <p className="text-sm text-gray-400 text-center py-8">Chưa có dữ liệu WO theo lịch trong kỳ</p>
              : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={planVsActual.byMonth} margin={{ top: 5, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total"     name="Tổng KH"   fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" name="Hoàn thành" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="onTime"    name="Đúng hạn"   fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="late"      name="Trễ hạn"    fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </Card>

          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-800">
            <strong>Công thức:</strong> Tỷ lệ hoàn thành = WO COMPLETED / Tổng WO từ lịch bảo trì.
            Đúng hạn = ActualDate &le; PlannedDate. Chỉ tính WO có <code>WO_Source = 'SCHEDULE'</code>.
          </div>
        </div>
      )}

      {/* ── Tab: Pareto Downtime ──────────────────────────────────────────── */}
      {tab === 'pareto' && (
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
                const topHours = rows.slice(0, top20pct).reduce((s, r) => s + Number(r.downtimeHours), 0);
                const total = rows.reduce((s, r) => s + Number(r.downtimeHours), 0);
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
            {(pareto?.rows ?? []).length === 0
              ? <p className="text-sm text-gray-400 text-center py-8">Chưa có dữ liệu dừng máy trong kỳ</p>
              : (
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={pareto.rows} margin={{ top: 5, right: 50, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="assetName"
                      tick={{ fontSize: 10 }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis yAxisId="left"  tick={{ fontSize: 11 }} unit="h" />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                    <Tooltip content={<ParetoTooltip />} />
                    <Legend verticalAlign="top" />
                    <Bar yAxisId="left" dataKey="downtimeHours" name="Giờ dừng" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="cumulativePercent"
                      name="Tích lũy %"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#6366f1' }}
                    />
                    <ReferenceLine yAxisId="right" y={80} stroke="#f59e0b" strokeDasharray="6 3"
                      label={{ value: '80%', position: 'insideTopRight', fontSize: 11, fill: '#d97706' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )
            }
          </Card>

          {/* Bảng Pareto */}
          <Card title="Bảng xếp hạng thiết bị gây dừng máy">
            {(pareto?.rows ?? []).length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">Không có dữ liệu</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['#', 'Tài sản', 'Vị trí', 'Planned', 'Unplanned', 'Giờ dừng', 'Tích lũy %', 'Phân loại'].map(h => (
                          <th key={h} className="text-left text-xs font-bold text-gray-600 px-3 py-2">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(pareto?.rows ?? []).map((r, i) => {
                        const isTop80 = r.cumulativePercent <= 80;
                        return (
                          <tr key={r.assetId} className={`hover:bg-blue-50/30 ${isTop80 ? 'bg-red-50/30' : ''}`}>
                            <td className="px-3 py-2 text-gray-500 font-mono">#{i + 1}</td>
                            <td className="px-3 py-2 font-semibold text-gray-900 truncate max-w-[160px]">{r.assetName}</td>
                            <td className="px-3 py-2 text-gray-700">{r.locationName ?? '—'}</td>
                            <td className="px-3 py-2 text-blue-700 font-medium">{r.plannedHours}h</td>
                            <td className="px-3 py-2 text-orange-700 font-medium">{r.unplannedHours}h</td>
                            <td className="px-3 py-2 font-bold text-red-700">{r.downtimeHours}h</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full ${r.cumulativePercent <= 80 ? 'bg-red-500' : 'bg-purple-400'}`}
                                    style={{ width: `${Math.min(r.cumulativePercent, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-gray-700">{r.cumulativePercent}%</span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              {isTop80
                                ? <Badge color="red">Ưu tiên cao</Badge>
                                : <Badge color="gray">Thứ yếu</Badge>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            }
          </Card>

          <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 text-xs text-purple-800">
            <strong>Phân tích 80/20:</strong> Các thiết bị có <strong>Tích lũy % &le; 80%</strong> (vùng đỏ) là
            nhóm 20% máy gây ra 80% tổng thời gian dừng. Ưu tiên phân bổ nguồn lực bảo trì cho nhóm này trước.
          </div>
        </div>
      )}

    </div>
  );
}
