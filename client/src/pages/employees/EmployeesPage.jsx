/**
 * EmployeesPage.jsx — Quản lý nhân viên: danh sách, thêm, vô hiệu hóa.
 * project.rule 1.2: "Đăng ký nhân viên: hồ sơ (mã, tên, chức vụ, phòng ban, username, password, email)".
 */
import { useEffect, useState, useCallback } from 'react';
import { Plus, UserCheck, UserX, Search } from 'lucide-react';
import { employeeApi } from '../../api/employee.api.js';
import { Button }   from '../../components/ui/Button.jsx';
import { Badge }    from '../../components/ui/Badge.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import { Modal }    from '../../components/ui/Modal.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { Textarea }  from '../../components/ui/Input.jsx';
import { useAuth }   from '../../contexts/AuthContext.jsx';
import toast from 'react-hot-toast';

export function EmployeesPage() {
  const { user: me } = useAuth();
  const [employees,    setEmployees]    = useState([]);
  const [departments,  setDepartments]  = useState([]);
  const [positions,    setPositions]    = useState([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [page,         setPage]         = useState(1);
  const [search,       setSearch]       = useState('');
  const [createOpen,   setCreateOpen]   = useState(false);
  const [form,         setForm]         = useState({});
  const [saving,       setSaving]       = useState(false);
  const [errors,       setErrors]       = useState({});
  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await employeeApi.getAll({ page, limit: LIMIT, ...(search && { search }) });
      setEmployees(res.data.data?.items ?? []);
      setTotal(res.data.data?.total ?? 0);
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => {
    Promise.all([employeeApi.getDepartments(), employeeApi.getPositions()]).then(([d, p]) => {
      setDepartments(d.data.data ?? []);
      setPositions(p.data.data   ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (emp) => {
    if (emp.employeeId === me?.employeeId) { toast.error('Không thể vô hiệu hóa chính mình'); return; }
    try {
      if (emp.isActive) await employeeApi.deactivate(emp.employeeId);
      else              await employeeApi.activate(emp.employeeId);
      toast.success(emp.isActive ? 'Đã vô hiệu hóa' : 'Đã kích hoạt lại');
      load();
    } catch { toast.error('Lỗi cập nhật'); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.fullName)       errs.fullName     = 'Bắt buộc';
    if (!form.username)       errs.username     = 'Bắt buộc';
    if (!form.email)          errs.email        = 'Bắt buộc';
    if (!form.password)       errs.password     = 'Bắt buộc';
    if (!form.positionId)     errs.positionId   = 'Bắt buộc';
    if (!form.departmentId)   errs.departmentId = 'Bắt buộc';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await employeeApi.create(form);
      toast.success('Đã thêm nhân viên');
      setCreateOpen(false);
      setForm({});
      load();
    } catch (err) {
      setErrors({ _: err.response?.data?.message ?? 'Lỗi tạo nhân viên' });
    } finally { setSaving(false); }
  };

  const setF = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: undefined })); };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Tìm tên, email, username..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
        {(me?.positionLevel ?? 0) >= 2 && (
          <Button onClick={() => { setForm({}); setErrors({}); setCreateOpen(true); }}>
            <Plus size={15} /> Thêm nhân viên
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? <PageLoader />
          : employees.length === 0 ? <EmptyState title="Không có nhân viên" />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                      {['Nhân viên', 'Chức vụ', 'Phòng ban', 'Email', 'Trạng thái', ''].map(h => (
                      <th key={h} className="text-left text-xs font-bold text-gray-700 uppercase tracking-wide px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.map(emp => (
                    <tr key={emp.employeeId} className={`hover:bg-gray-50 transition-colors ${!emp.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">
                            {emp.fullName?.[0] ?? '?'}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{emp.fullName}</p>
                            <p className="text-xs font-medium text-gray-500">@{emp.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{emp.positionName}</td>
                      <td className="px-4 py-3 font-medium text-gray-700">{emp.departmentName}</td>
                      <td className="px-4 py-3 text-gray-700">{emp.email}</td>
                      <td className="px-4 py-3">
                        <Badge color={emp.isActive ? 'green' : 'gray'}>
                          {emp.isActive ? 'Đang hoạt động' : 'Vô hiệu'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {(me?.positionLevel ?? 0) >= 3 && emp.employeeId !== me?.employeeId && (
                          <button
                            onClick={() => handleToggle(emp)}
                            className={`p-1.5 rounded-lg transition-colors ${emp.isActive ? 'hover:bg-red-50 text-red-400' : 'hover:bg-green-50 text-green-500'}`}
                          >
                            {emp.isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / LIMIT)} onChange={setPage} />

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Thêm nhân viên mới" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Họ tên *"      value={form.fullName ?? ''} onChange={e => setF('fullName', e.target.value)} error={errors.fullName} />
            <Input label="Tên đăng nhập *" value={form.username ?? ''} onChange={e => setF('username', e.target.value)} error={errors.username} />
            <Input label="Email *"       value={form.email    ?? ''} onChange={e => setF('email',    e.target.value)} error={errors.email} type="email" />
            <Input label="Mật khẩu *"   value={form.password ?? ''} onChange={e => setF('password', e.target.value)} error={errors.password} type="password" />
            <Input label="Số điện thoại" value={form.phone    ?? ''} onChange={e => setF('phone',    e.target.value)} />
            <Select label="Chức vụ *" value={form.positionId ?? ''} onChange={e => setF('positionId', e.target.value)} error={errors.positionId}>
              <option value="">— Chọn chức vụ —</option>
              {positions.map(p => <option key={p.positionId} value={p.positionId}>{p.positionName}</option>)}
            </Select>
            <Select label="Phòng ban *" value={form.departmentId ?? ''} onChange={e => setF('departmentId', e.target.value)} error={errors.departmentId}>
              <option value="">— Chọn phòng ban —</option>
              {departments.map(d => <option key={d.departmentId} value={d.departmentId}>{d.departmentName}</option>)}
            </Select>
          </div>
          {errors._ && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{errors._}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button type="submit" loading={saving}>Thêm nhân viên</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
