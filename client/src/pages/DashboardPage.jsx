/**
 * DashboardPage.jsx — Dashboard thay đổi nội dung theo role người dùng.
 *   - operational (Trưởng ca / Trưởng phòng): tổng quan vận hành đầy đủ
 *   - director  (Ban Giám đốc)              : KPI cấp cao + báo cáo (không menu Phê duyệt — chỉ R)
 *   - admin     (Quản trị hệ thống)         : quản lý hệ thống + nhân sự
 *   - field     (KTV / Công nhân / CVKTS)   : công việc được giao + checklist
 * Dùng getDashboardType() từ utils/rbac.js.
 */
import { useEffect, useState } from 'react';
import { Link }                from 'react-router-dom';
import {
  Cpu, Wrench, ShieldCheck, AlertTriangle,
  CheckCircle, XCircle, Clock, QrCode,
  Users, FileText, BarChart2, CalendarClock,
  ArrowRight, Calendar, ClipboardList, GitBranch,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { statsApi }     from '../api/stats.api.js';
import { workOrderApi } from '../api/workOrder.api.js';
import { checklistApi } from '../api/checklist.api.js';
import { employeeApi }  from '../api/employee.api.js';
import { StatCard }     from '../components/ui/Card.jsx';
import { Badge }        from '../components/ui/Badge.jsx';
import { PageLoader }   from '../components/ui/Spinner.jsx';
import { useAuth }      from '../contexts/AuthContext.jsx';
import { getDashboardType, TRUONG_CA_SUMMARY } from '../utils/rbac.js';
import { fDate, WO_STATUS_LABEL, WO_STATUS_COLOR, WO_PRIORITY_COLOR, WO_PRIORITY_LABEL } from '../utils/format.js';

// ─── OPERATIONAL DASHBOARD (Trưởng ca / Trưởng phòng) ─────────────────────────
function OperationalDashboard() {
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
      {/* Trưởng ca: nhiệm vụ + lối tắt luồng phê duyệt / điều phối (rule/truongca.rule) */}
      <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/60 p-4 sm:p-5 shadow-sm">
        <p className="text-sm font-bold text-blue-950">{TRUONG_CA_SUMMARY.title}</p>
        <p className="text-xs text-blue-900/85 mt-1.5 max-w-2xl">
          {TRUONG_CA_SUMMARY.tagline}
        </p>
        {TRUONG_CA_SUMMARY.flows?.length > 0 && (
          <ul className="mt-3 text-xs text-blue-900/80 space-y-1 list-disc list-inside border-t border-blue-100/80 pt-3">
            {TRUONG_CA_SUMMARY.flows.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 mt-4">
          {[
            { to: '/approvals', label: 'Phê duyệt', icon: ShieldCheck, className: 'bg-amber-100 text-amber-900 border-amber-200 hover:bg-amber-200/80' },
            { to: '/work-orders', label: 'Phiếu việc', icon: Wrench, className: 'bg-white text-blue-900 border-blue-200 hover:bg-blue-50' },
            { to: '/schedules', label: 'Lịch bảo trì', icon: ClipboardList, className: 'bg-white text-blue-900 border-blue-200 hover:bg-blue-50' },
            { to: '/checklists', label: 'Checklist', icon: CheckCircle, className: 'bg-white text-blue-900 border-blue-200 hover:bg-blue-50' },
            { to: '/reports', label: 'Báo cáo', icon: BarChart2, className: 'bg-white text-blue-900 border-blue-200 hover:bg-blue-50' },
          ].map(({ to, label, icon: Icon, className }) => (
            <Link
              key={to}
              to={to}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${className}`}
            >
              <Icon size={14} />
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Tổng tài sản"   value={a.total}  icon={Cpu}           color="blue"   sub={`${a.available ?? 0} sẵn sàng`} />
        <StatCard label="Cảnh báo/Hỏng"  value={(a.caution ?? 0) + (a.broken ?? 0)} icon={AlertTriangle} color="red" sub={`${a.monitoring ?? 0} đang theo dõi`} />
        <StatCard label="Phiếu đang mở"  value={(wo.pendingApproval ?? 0) + (wo.waiting ?? 0) + (wo.inProgress ?? 0) + (wo.awaitingClosure ?? 0)} icon={Wrench} color="orange" sub={`${wo.completed ?? 0} hoàn thành`} />
        <StatCard label="Chờ phê duyệt"  value={summary?.pendingApprovals} icon={ShieldCheck} color="yellow" sub="Phiếu + tài liệu" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Chờ duyệt',      value: wo.pendingApproval, color: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
          { label: 'Chờ thực hiện',  value: wo.waiting,         color: 'bg-blue-50 border-blue-200 text-blue-800' },
          { label: 'Đang thực hiện', value: wo.inProgress,      color: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
          { label: 'Chờ nghiệm thu', value: wo.awaitingClosure, color: 'bg-violet-50 border-violet-200 text-violet-900' },
          { label: 'Hoàn thành',     value: wo.completed,       color: 'bg-green-50 border-green-200 text-green-800' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl border p-4 text-center ${color}`}>
            <p className="text-2xl font-bold">{value ?? 0}</p>
            <p className="text-xs font-semibold mt-1 opacity-80">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                  <Bar dataKey="ok"      name="OK"      fill="#16a34a" radius={[3,3,0,0]} />
                  <Bar dataKey="warning" name="Cảnh báo" fill="#d97706" radius={[3,3,0,0]} />
                  <Bar dataKey="ng"      name="NG"      fill="#dc2626" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </div>

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

// ─── DIRECTOR DASHBOARD (Ban Giám đốc) ───────────────────────────────────────
function DirectorDashboard() {
  const [summary, setSummary] = useState(null);
  const [trend,   setTrend]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([statsApi.summary(), statsApi.checklistTrend()])
      .then(([s, t]) => { setSummary(s.data.data); setTrend(t.data.data ?? []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;
  const a  = summary?.assets     ?? {};
  const wo = summary?.workOrders ?? {};

  const assetPieData = [
    { name: 'Sẵn sàng',    value: a.available  ?? 0, color: '#16a34a' },
    { name: 'Theo dõi',    value: a.monitoring ?? 0, color: '#2563eb' },
    { name: 'Cần chú ý',   value: a.caution    ?? 0, color: '#d97706' },
    { name: 'Bảo trì',     value: a.maintenance ?? 0, color: '#7c3aed' },
    { name: 'Hỏng',        value: a.broken     ?? 0, color: '#dc2626' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
        <p className="text-sm font-semibold text-purple-800">
          Bảng tổng hợp KPI — Hệ thống bảo trì thiết bị Xi măng Sông Gianh
        </p>
        <p className="text-xs text-purple-700/90 mt-2">
          Tổng quan KPI và báo cáo giám sát.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Tổng tài sản"   value={a.total}             icon={Cpu}          color="blue"   sub={`${a.available ?? 0} đang vận hành`} />
        <StatCard label="Thiết bị cần xử lý" value={(a.caution ?? 0) + (a.broken ?? 0) + (a.maintenance ?? 0)} icon={AlertTriangle} color="red" sub="Cảnh báo + Hỏng + BT" />
        <StatCard label="Phiếu hoàn thành" value={wo.completed ?? 0} icon={CheckCircle}  color="green"  sub="Tổng lũy kế" />
        <StatCard label="Đang chờ duyệt"   value={summary?.pendingApprovals ?? 0} icon={Clock} color="yellow" sub="Phiếu + tài liệu" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-4 text-sm">Phân bổ trạng thái tài sản</h3>
          {assetPieData.length === 0
            ? <p className="text-sm text-gray-500 text-center py-10">Chưa có dữ liệu</p>
            : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={assetPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {assetPieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-4 text-sm">Xu hướng kiểm tra 30 ngày qua</h3>
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
                  <Bar dataKey="ok"      name="OK"      fill="#16a34a" radius={[3,3,0,0]} />
                  <Bar dataKey="warning" name="Cảnh báo" fill="#d97706" radius={[3,3,0,0]} />
                  <Bar dataKey="ng"      name="NG"      fill="#dc2626" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm">Xem báo cáo chi tiết</h3>
          <Link to="/reports" className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline">
            Báo cáo đầy đủ <ArrowRight size={14} />
          </Link>
        </div>
        <p className="text-sm text-gray-500 mt-2">Truy cập trang Thống kê & Báo cáo để xem chi tiết downtime, hiệu suất và tuân thủ kế hoạch bảo trì.</p>
      </div>
    </div>
  );
}

// ─── ADMIN DASHBOARD (Quản trị hệ thống) ─────────────────────────────────────
function AdminDashboard() {
  const [employees, setEmployees] = useState([]);
  const [summary,   setSummary]   = useState(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([employeeApi.getAll({ limit: 10, page: 1 }), statsApi.summary()])
      .then(([e, s]) => {
        setEmployees(e.data.data?.items ?? []);
        setSummary(s.data.data);
      }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;
  const a = summary?.assets ?? {};

  return (
    <div className="space-y-6">
      <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
        <p className="text-sm font-semibold text-red-800">
          Bảng quản trị hệ thống — Quản lý tài khoản, phân quyền và cấu hình
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Tổng tài sản"      value={a.total ?? 0}               icon={Cpu}       color="blue"   sub="READ only" />
        <StatCard label="Tài sản có vấn đề" value={(a.caution ?? 0) + (a.broken ?? 0)} icon={AlertTriangle} color="red" sub="Cảnh báo + Hỏng" />
        <StatCard label="Nhân viên đang dùng" value={employees.filter(e => e.isActive).length} icon={Users} color="green" sub="Tài khoản active" />
        <StatCard label="Chờ phê duyệt"     value={summary?.pendingApprovals ?? 0} icon={ShieldCheck} color="yellow" sub="Toàn hệ thống" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h3 className="font-bold text-gray-900 text-sm">Nhân viên gần đây</h3>
            <Link to="/employees" className="text-xs font-semibold text-blue-600 hover:underline">
              Quản lý nhân sự →
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {employees.slice(0, 6).map(emp => (
              <div key={emp.employeeId} className="flex items-center gap-3 px-5 py-3">
                <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {emp.fullName?.[0] ?? 'E'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{emp.fullName}</p>
                  <p className="text-xs text-gray-500 truncate">{emp.positionName} — {emp.departmentName}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${emp.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {emp.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
            {employees.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">Chưa có nhân viên nào</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
          <h3 className="font-bold text-gray-900 text-sm mb-4">Hành động quản trị nhanh</h3>
          {[
            { to: '/employees', icon: Users, label: 'Quản lý nhân sự & phân quyền' },
            { to: '/workflows', icon: GitBranch, label: 'Mẫu luồng phê duyệt (BFD 4.1)' },
            { to: '/assets', icon: Cpu, label: 'Xem danh sách tài sản (chỉ đọc)' },
            { to: '/work-orders', icon: Wrench, label: 'Phiếu việc — tạo phiếu chờ duyệt' },
            { to: '/documents', icon: FileText, label: 'Kho tài liệu — gửi duyệt bản nháp' },
            { to: '/schedules', icon: ClipboardList, label: 'Lịch bảo trì — gửi duyệt (NV KT + Admin)' },
          ].map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <Icon size={17} className="text-gray-600" />
              <span className="text-sm font-semibold text-gray-800">{label}</span>
              <ArrowRight size={14} className="text-gray-500 ml-auto" />
            </Link>
          ))}
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            <p className="font-semibold">BFD 4.1 — Khởi tạo luồng phê duyệt:</p>
            <p className="mt-1">
              Admin có thể cấu hình mẫu luồng, tạo phiếu chờ duyệt, gửi lịch/tài liệu vào duyệt; không thay Trưởng ca thực hiện bước duyệt trên hàng chờ.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FIELD DASHBOARD (KTV / Công nhân / CVKTS) ───────────────────────────────
function FieldDashboard() {
  const { user }          = useAuth();
  const [myWOs, setMyWOs] = useState([]);
  const [recentChecklists, setRecentChecklists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      workOrderApi.getAll({ assignedTo: user?.sub, limit: 5, page: 1 }),
      checklistApi.getResults ? checklistApi.getResults({ limit: 5 }) : Promise.resolve({ data: { data: [] } }),
    ]).then(([wo, cl]) => {
      setMyWOs(wo.data.data?.items ?? []);
      setRecentChecklists(Array.isArray(cl.data.data) ? cl.data.data : cl.data.data?.items ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <PageLoader />;

  const positionName = user?.positionName ?? '';
  // Nhân viên Kỹ thuật (Level 2) có thêm quyền tạo tài liệu và lịch bảo trì
  const isKyThuat = (user?.positionLevel ?? 0) >= 2 && (user?.positionLevel ?? 0) < 3;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-base font-bold text-white flex-shrink-0">
          {user?.fullName?.[0] ?? 'U'}
        </div>
        <div>
          <p className="font-bold text-blue-900">Xin chào, {user?.fullName}!</p>
          <p className="text-sm text-blue-700">{user?.positionName} — {user?.departmentName}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4">
        <Link to="/checklists" className="flex flex-col items-center gap-2 p-5 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors text-center">
          <QrCode size={28} className="text-green-600" />
          <span className="text-sm font-bold text-green-800">Quét QR / Checklist</span>
          <span className="text-xs text-green-600">Bắt đầu kiểm tra tại hiện trường</span>
        </Link>

        {isKyThuat ? (
          <Link to="/documents" className="flex flex-col items-center gap-2 p-5 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors text-center">
            <FileText size={28} className="text-purple-600" />
            <span className="text-sm font-bold text-purple-800">Kho tài liệu số</span>
            <span className="text-xs text-purple-600">Upload & quản lý tài liệu</span>
          </Link>
        ) : (
          <Link to="/work-orders" className="flex flex-col items-center gap-2 p-5 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100 transition-colors text-center">
            <Wrench size={28} className="text-orange-600" />
            <span className="text-sm font-bold text-orange-800">Phiếu việc của tôi</span>
            <span className="text-xs text-orange-600">Xem công việc được giao</span>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Phiếu việc được giao */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Wrench size={15} className="text-orange-500" /> Phiếu việc được giao
            </h3>
            <Link to="/work-orders" className="text-xs font-semibold text-blue-600 hover:underline">Xem tất cả →</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {myWOs.length === 0 && (
              <div className="py-10 text-center">
                <CheckCircle size={28} className="text-green-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Không có phiếu việc đang mở</p>
              </div>
            )}
            {myWOs.map(wo => (
              <div key={wo.woId} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <Link to={`/work-orders/${wo.woId}`} className="font-mono text-xs font-bold text-blue-700 hover:underline">
                    WO-{String(wo.woId).padStart(4, '0')}
                  </Link>
                  <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">{wo.assetName}</p>
                  <p className="text-xs text-gray-500">{fDate(wo.plannedDate)}</p>
                </div>
                <div className="flex flex-col gap-1 items-end flex-shrink-0">
                  <Badge color={WO_PRIORITY_COLOR[wo.priority]}>{WO_PRIORITY_LABEL[wo.priority] ?? wo.priority}</Badge>
                  <Badge color={WO_STATUS_COLOR[wo.status]}>{WO_STATUS_LABEL[wo.status] ?? wo.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lịch sử checklist + shortcuts */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <CalendarClock size={15} className="text-blue-500" /> Các trang tôi có quyền
          </h3>
          <div className="space-y-2">
            {[
              { to: '/assets',      icon: Cpu,          label: 'Xem tài sản thiết bị',     desc: 'Thông tin & lịch sử bảo trì' },
              { to: '/checklists',  icon: CheckCircle,  label: 'Quét QR / Checklist',       desc: 'Xem thiết bị; gửi phiếu: CN hoặc Trưởng phòng' },
              { to: '/documents',   icon: FileText,     label: 'Kho tài liệu',              desc: 'SOP, bản vẽ, hướng dẫn' },
              ...(isKyThuat ? [
                { to: '/schedules', icon: Calendar,     label: 'Lịch bảo trì',             desc: 'Soạn lịch, gửi Trưởng ca duyệt' },
                { to: '/work-orders', icon: Wrench,     label: 'Phiếu việc',               desc: 'Tạo / theo dõi (duyệt do Trưởng ca)' },
              ] : []),
            ].map(({ to, icon: Icon, label, desc }) => (
              <Link key={to} to={to}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-colors group">
                <Icon size={16} className="text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
                <ArrowRight size={13} className="text-gray-300 group-hover:text-blue-400" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────
export function DashboardPage() {
  const { user } = useAuth();
  const type     = getDashboardType(user);

  if      (type === 'supervisor') return <OperationalDashboard />;
  else if (type === 'director')   return <DirectorDashboard />;
  else if (type === 'admin')      return <AdminDashboard />;
  else                             return <FieldDashboard />;
}
