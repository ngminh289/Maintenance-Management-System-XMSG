/**
 * ReportsPage.jsx — Báo cáo tổng hợp: hiệu suất tài sản, checklist, tài nguyên số.
 * BFD 6.1 Báo cáo hiệu suất & tình trạng tài sản.
 * BFD 6.2 Checklist: xu hướng 30 ngày; báo cáo nghiệp vụ chi tiết tại /reports/operations (TP + Ban GĐ).
 * BFD 6.3 Báo cáo sử dụng tài nguyên số.
 * RBAC: REPORT:EXPORT; CSV xu hướng checklist.
 * Liên quan: api/stats.api.js, components/ui/*, utils/rbac.js.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { statsApi }   from '../../api/stats.api.js';
import { Card }       from '../../components/ui/Card.jsx';
import { Badge }      from '../../components/ui/Badge.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { fDate }      from '../../utils/format.js';
import { BarChart2, FileText, CheckSquare, AlertTriangle, Clock, Download, Printer, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { canDo, canAccessChecklistOperationsReport } from '../../utils/rbac.js';
import toast from 'react-hot-toast';

/** Chuyển array objects thành CSV blob và trigger download */
function downloadCSV(data, filename) {
  if (!data?.length) { toast.error('Không có dữ liệu để xuất'); return; }
  const headers = Object.keys(data[0]);
  const rows    = data.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','));
  const csv     = [headers.join(','), ...rows].join('\r\n');
  const blob    = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM cho Excel
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const TABS = [
  { key: 'assets',   label: 'Tài sản & WO',      icon: BarChart2 },
  { key: 'checklist',label: 'Checklist',          icon: CheckSquare },
  { key: 'digital',  label: 'Tài nguyên số',      icon: FileText },
];

const ASSET_STATUS_COLOR = {
  available: '#22c55e', caution: '#f59e0b', maintenance: '#3b82f6',
  broken: '#ef4444', decommissioned: '#9ca3af',
};
const PIE_COLORS = ['#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#9ca3af'];
export function ReportsPage() {
  const { user } = useAuth();
  const canExport = canDo(user, 'REPORT:EXPORT');
  const canChecklistOpsReport = canAccessChecklistOperationsReport(user);
  const [tab,       setTab]       = useState('assets');
  const [summary,   setSummary]   = useState(null);
  const [clTrend,   setClTrend]   = useState([]);
  const [topFaulty, setTopFaulty] = useState([]);
  const [woData,    setWoData]    = useState([]);
  const [daReport,  setDaReport]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [s, cl, tf, wo, da] = await Promise.all([
          statsApi.summary(),
          statsApi.checklistTrend(),
          statsApi.topFaulty(10),
          statsApi.woCompletion(),
          statsApi.digitalAssets(),
        ]);
        setSummary(s.data.data);
        setClTrend(cl.data.data ?? []);
        setTopFaulty(tf.data.data ?? []);
        setWoData(wo.data.data ?? []);
        setDaReport(da.data.data);
      } catch { toast.error('Không tải được dữ liệu báo cáo'); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <PageLoader />;

  // ── Dữ liệu PieChart tài sản ───────────────────────────────────────────────
  const assetPie = summary ? [
    { name: 'Bình thường',  value: Number(summary.assets?.available     || 0) },
    { name: 'Theo dõi',     value: Number(summary.assets?.caution       || 0) },
    { name: 'Bảo trì',      value: Number(summary.assets?.maintenance   || 0) },
    { name: 'Hỏng',         value: Number(summary.assets?.broken        || 0) },
    { name: 'Ngừng dùng',   value: Number(summary.assets?.decommissioned|| 0) },
  ].filter(d => d.value > 0) : [];

  const clTrendFormatted = clTrend.map(r => ({
    ...r,
    date: fDate(r.date),
    ok: Number(r.ok), warning: Number(r.warning), ng: Number(r.ng),
  }));

  const woFormatted = woData.map(r => ({
    week: fDate(r.weekStart),
    completed: Number(r.completed),
  }));

  return (
    <div className="space-y-5">
      {/* Tabs + nút xuất */}
      <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors
              ${tab === key ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-800'}`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* Nút xuất dữ liệu */}
      <div className="flex gap-2">
        {canExport && tab === 'assets' && (
          <button
            type="button"
            onClick={() => downloadCSV(topFaulty.map(a => ({
              'Tài sản':      a.assetName,
              'Vị trí':       a.location ?? '',
              'NG':           a.ngCount,
              'Cảnh báo':     a.warningCount,
              'Tổng kiểm tra': a.totalChecks,
            })), 'bao-cao-tai-san.csv')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Download size={14} /> Xuất CSV
          </button>
        )}
        {canExport && tab === 'checklist' && (
          <button
            type="button"
            onClick={() => downloadCSV(clTrendFormatted.map(r => ({
              'Ngày': r.date,
              'OK':   r.ok,
              'Cảnh báo': r.warning,
              'NG':   r.ng,
            })), 'bao-cao-checklist.csv')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Download size={14} /> CSV xu hướng
          </button>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <Printer size={14} /> In
        </button>
      </div>
      </div>

      {/* ── Tab 6.1: Tài sản & Work Orders ────────────────────────────────── */}
      {tab === 'assets' && (
        <div className="space-y-5">
          {/* KPI Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Tổng tài sản',       value: summary.assets?.total,       color: 'text-gray-900' },
                { label: 'WO đang xử lý',       value: summary.workOrders?.inProgress, color: 'text-blue-700' },
                { label: 'Tài sản hỏng',        value: summary.assets?.broken,      color: 'text-red-600' },
                { label: 'Chờ phê duyệt',       value: summary.pendingApprovals,    color: 'text-amber-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                  <p className={`text-3xl font-bold mt-1 ${color}`}>{value ?? 0}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Pie tình trạng tài sản */}
            <Card title="Phân bố tình trạng tài sản">
              {assetPie.length === 0
                ? <p className="text-sm text-gray-400 text-center py-6">Chưa có dữ liệu</p>
                : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={assetPie} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {assetPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )
              }
            </Card>

            {/* WO hoàn thành theo tuần */}
            <Card title="Work Orders hoàn thành (12 tuần)">
              {woFormatted.length === 0
                ? <p className="text-sm text-gray-400 text-center py-6">Chưa có dữ liệu</p>
                : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={woFormatted}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="completed" fill="#3b82f6" radius={[4, 4, 0, 0]} name="WO hoàn thành" />
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
            </Card>
          </div>

          {/* Top tài sản hay hỏng */}
          <Card title="Top 10 tài sản có sự cố nhiều nhất (90 ngày)" icon={AlertTriangle}>
            {topFaulty.length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">Không có sự cố trong 90 ngày qua</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Tài sản', 'Vị trí', 'NG', 'Cảnh báo', 'Tổng kiểm tra'].map(h => (
                          <th key={h} className="text-left text-xs font-bold text-gray-700 px-4 py-2.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {topFaulty.map((a, i) => (
                        <tr key={a.assetId} className="hover:bg-blue-50/30">
                          <td className="px-4 py-2.5 font-semibold text-gray-900">
                            <span className="text-gray-400 mr-2">#{i + 1}</span>{a.assetName}
                          </td>
                          <td className="px-4 py-2.5 text-gray-700">{a.location ?? '—'}</td>
                          <td className="px-4 py-2.5">
                            <Badge color={a.ngCount > 0 ? 'red' : 'gray'}>{a.ngCount}</Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge color={a.warningCount > 0 ? 'yellow' : 'gray'}>{a.warningCount}</Badge>
                          </td>
                          <td className="px-4 py-2.5 font-medium text-gray-800">{a.totalChecks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </Card>
        </div>
      )}

      {/* ── Tab 6.2: Checklist ──────────────────────────────────────────────── */}
      {tab === 'checklist' && (
        <div className="space-y-5">
          {canChecklistOpsReport ? (
            <Link
              to="/reports/operations"
              className="group flex items-center justify-between gap-4 rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50 via-white to-violet-50/80 px-5 py-4 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all"
            >
              <div>
                <p className="font-bold text-indigo-950">Báo cáo nghiệp vụ và vận hành</p>
                <p className="text-sm text-indigo-900/85 mt-1 leading-relaxed">
                  Tỷ lệ checklist định kỳ (slot), thời gian giữa các bước phê duyệt, xu hướng NG theo thiết bị — xem
                  theo từng tab, có xuất CSV và bảng chi tiết.
                </p>
              </div>
              <span className="flex items-center gap-1 text-sm font-semibold text-indigo-600 shrink-0">
                Mở trang <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          ) : (
            <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold text-amber-900">Báo cáo nghiệp vụ</p>
              <p className="mt-1 leading-relaxed">
                Mục <strong>Báo cáo nghiệp vụ và vận hành</strong> trên menu chỉ dành cho{' '}
                <strong>Trưởng phòng</strong> và <strong>Ban Giám đốc</strong>. Bạn vẫn xem được tổng hợp checklist
                30 ngày bên dưới.
              </p>
            </div>
          )}

          {summary && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'OK (30 ngày)',      value: summary.checklistsLast30Days?.ok,      color: 'text-green-700' },
                { label: 'Cảnh báo (30 ngày)',value: summary.checklistsLast30Days?.warning, color: 'text-amber-600' },
                { label: 'NG (30 ngày)',       value: summary.checklistsLast30Days?.ng,      color: 'text-red-600'  },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                  <p className={`text-3xl font-bold mt-1 ${color}`}>{value ?? 0}</p>
                </div>
              ))}
            </div>
          )}

          <Card title="Xu hướng kiểm tra OK / WARNING / NG (30 ngày)">
            {clTrendFormatted.length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">Chưa có dữ liệu checklist</p>
              : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={clTrendFormatted}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="ok"      stroke="#22c55e" strokeWidth={2} name="OK"       dot={false} />
                    <Line type="monotone" dataKey="warning" stroke="#f59e0b" strokeWidth={2} name="WARNING"  dot={false} />
                    <Line type="monotone" dataKey="ng"      stroke="#ef4444" strokeWidth={2} name="NG"       dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )
            }
          </Card>
        </div>
      )}

      {/* ── Tab 6.3: Tài nguyên số ──────────────────────────────────────────── */}
      {tab === 'digital' && daReport && (
        <div className="space-y-5">
          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Tổng tài liệu',  value: daReport.statusSummary?.total,    color: 'text-gray-900' },
              { label: 'Đã duyệt',        value: daReport.statusSummary?.approved, color: 'text-green-700' },
              { label: 'Chờ duyệt',       value: daReport.statusSummary?.pending,  color: 'text-amber-600' },
              { label: 'Bản nháp',        value: daReport.statusSummary?.draft,    color: 'text-gray-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                <p className={`text-3xl font-bold mt-1 ${color}`}>{value ?? 0}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Upload theo tháng */}
            <Card title="Tài liệu upload theo tháng (6 tháng)">
              {daReport.uploadTrend?.length === 0
                ? <p className="text-sm text-gray-400 text-center py-6">Chưa có dữ liệu</p>
                : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={daReport.uploadTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Tài liệu" />
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
            </Card>

            {/* Tài liệu nhiều phiên bản */}
            <Card title="Tài liệu có nhiều phiên bản nhất">
              {daReport.mostVersioned?.length === 0
                ? <p className="text-sm text-gray-400 text-center py-6">Chưa có dữ liệu</p>
                : (
                  <div className="space-y-2">
                    {daReport.mostVersioned.map(d => (
                      <div key={d.digitalAssetId} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{d.fileName}</p>
                          <p className="text-xs text-gray-500">{d.assetName ?? '—'}</p>
                        </div>
                        <Badge color="blue">v{d.currentVersion}</Badge>
                      </div>
                    ))}
                  </div>
                )
              }
            </Card>
          </div>

          {/* Tài liệu cũ cần cập nhật */}
          <Card title="Tài liệu đã duyệt cũ hơn 180 ngày — cần xem xét cập nhật" icon={Clock}>
            {daReport.staleDocuments?.length === 0
              ? <p className="text-sm text-green-600 text-center py-6">✓ Tất cả tài liệu đã được cập nhật gần đây</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Tài liệu', 'Tài sản', 'Phiên bản', 'Upload lần cuối', 'Số ngày'].map(h => (
                          <th key={h} className="text-left text-xs font-bold text-gray-700 px-4 py-2.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {daReport.staleDocuments.map(d => (
                        <tr key={d.digitalAssetId} className="hover:bg-amber-50/40">
                          <td className="px-4 py-2.5 font-semibold text-gray-900 max-w-[200px] truncate">{d.fileName}</td>
                          <td className="px-4 py-2.5 text-gray-700">{d.assetName ?? '—'}</td>
                          <td className="px-4 py-2.5"><Badge color="gray">v{d.currentVersion}</Badge></td>
                          <td className="px-4 py-2.5 text-gray-700">{fDate(d.uploadDate)}</td>
                          <td className="px-4 py-2.5">
                            <Badge color={d.daysSinceUpload > 365 ? 'red' : 'yellow'}>
                              {d.daysSinceUpload} ngày
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
        </div>
      )}
    </div>
  );
}
