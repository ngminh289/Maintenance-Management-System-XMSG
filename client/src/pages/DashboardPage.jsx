/**
 * DashboardPage.jsx — Dashboard tổng quan: stats, biểu đồ, top faulty, WO gần đây.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cpu, Wrench, ShieldCheck, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { statsApi }     from '../api/stats.api.js';
import { workOrderApi } from '../api/workOrder.api.js';
import { StatCard }     from '../components/ui/Card.jsx';
import { Badge }        from '../components/ui/Badge.jsx';
import { PageLoader }   from '../components/ui/Spinner.jsx';
import { fDate, WO_STATUS_LABEL, WO_STATUS_COLOR, WO_PRIORITY_COLOR, WO_PRIORITY_LABEL } from '../utils/format.js';

export function DashboardPage() {
  const [summary,  setSummary]  = useState(null);
  const [trend,    setTrend]    = useState([]);
  const [faulty,   setFaulty]   = useState([]);
  const [recentWO, setRecentWO] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      statsApi.summary(),
      statsApi.checklistTrend(),
      statsApi.topFaulty(),
      workOrderApi.getAll({ limit: 8, page: 1 }),
    ]).then(([s, t, f, wo]) => {
      setSummary(s.data.data);
      setTrend(t.data.data ?? []);
      setFaulty(f.data.data ?? []);
      setRecentWO(wo.data.data?.items ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const a  = summary?.assets     ?? {};
  const wo = summary?.workOrders ?? {};

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Tổng tài sản"          value={a.total}  icon={Cpu}         color="blue"   sub={`${a.available ?? 0} sẵn sàng`} />
        <StatCard label="Cảnh báo / Hỏng"        value={(a.caution ?? 0) + (a.broken ?? 0)} icon={AlertTriangle} color="red" sub={`${a.monitoring ?? 0} đang theo dõi`} />
        <StatCard label="Phiếu đang mở"          value={(wo.pendingApproval ?? 0) + (wo.waiting ?? 0) + (wo.inProgress ?? 0)} icon={Wrench} color="orange" sub={`${wo.completed ?? 0} hoàn thành`} />
        <StatCard label="Chờ phê duyệt"          value={summary?.pendingApprovals} icon={ShieldCheck} color="yellow" sub="Phiếu + tài liệu" />
      </div>

      {/* WO status row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Chờ duyệt',      value: wo.pendingApproval, color: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
          { label: 'Chờ thực hiện',  value: wo.waiting,         color: 'bg-blue-50 border-blue-200 text-blue-800' },
          { label: 'Đang thực hiện', value: wo.inProgress,      color: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
          { label: 'Hoàn thành',     value: wo.completed,       color: 'bg-green-50 border-green-200 text-green-800' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl border p-4 text-center ${color}`}>
            <p className="text-2xl font-bold">{value ?? 0}</p>
            <p className="text-xs font-semibold mt-1 opacity-80">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Checklist trend */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-4 text-sm">Kết quả Checklist 30 ngày qua</h3>
          {trend.length === 0
            ? <p className="text-sm text-gray-500 text-center py-10">Chưa có dữ liệu</p>
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trend} barSize={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={d => d?.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <Tooltip labelFormatter={l => fDate(l)} contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
                  <Bar dataKey="ok"      name="OK"       fill="#16a34a" radius={[3,3,0,0]} />
                  <Bar dataKey="warning" name="Cảnh báo"  fill="#d97706" radius={[3,3,0,0]} />
                  <Bar dataKey="ng"      name="NG"       fill="#dc2626" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </div>

        {/* Top faulty assets */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 text-sm">Top tài sản hay hỏng (90 ngày)</h3>
            <Link to="/assets" className="text-xs font-semibold text-blue-600 hover:underline">Xem tất cả →</Link>
          </div>
          {faulty.length === 0
            ? <p className="text-sm text-gray-500 text-center py-10">Không có dữ liệu</p>
            : (
              <div className="space-y-3">
                {faulty.slice(0, 5).map((f) => (
                  <div key={f.assetId} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{f.assetName}</p>
                      <p className="text-xs font-medium text-gray-500 truncate">{f.location}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Badge color="red"><XCircle size={10} /> {f.ngCount} NG</Badge>
                      <Badge color="yellow"><AlertTriangle size={10} /> {f.warningCount}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* Recent Work Orders */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-900 text-sm">Phiếu việc gần đây</h3>
          <Link to="/work-orders" className="text-xs font-semibold text-blue-600 hover:underline">Xem tất cả →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Mã WO', 'Tài sản', 'Vị trí', 'Ngày dự kiến', 'Ưu tiên', 'Trạng thái'].map(h => (
                  <th key={h} className="text-left text-xs font-bold text-gray-700 uppercase tracking-wide px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentWO.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-500 text-sm">Chưa có phiếu việc</td></tr>
              )}
              {recentWO.map(wo => (
                <tr key={wo.woId} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-5 py-3">
                    <Link to={`/work-orders/${wo.woId}`} className="font-mono text-sm font-bold text-blue-700 hover:underline">
                      WO-{String(wo.woId).padStart(4, '0')}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-semibold text-gray-900">{wo.assetName}</td>
                  <td className="px-5 py-3 font-medium text-gray-700">{wo.locationName}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{fDate(wo.plannedDate)}</td>
                  <td className="px-5 py-3"><Badge color={WO_PRIORITY_COLOR[wo.priority]}>{WO_PRIORITY_LABEL[wo.priority] ?? wo.priority}</Badge></td>
                  <td className="px-5 py-3"><Badge color={WO_STATUS_COLOR[wo.status]}>{WO_STATUS_LABEL[wo.status] ?? wo.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
