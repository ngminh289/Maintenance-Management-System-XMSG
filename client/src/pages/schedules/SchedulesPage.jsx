/**
 * SchedulesPage.jsx — Lịch bảo trì: danh sách + tạo + tạo WO từ lịch.
 * project.rule 2.1: "Lập lịch bảo trì (định kỳ, dự đoán, khắc phục)".
 */
import { useEffect, useState, useCallback } from 'react';
import { Plus, Play, Calendar } from 'lucide-react';
import { scheduleApi } from '../../api/schedule.api.js';
import { assetApi }    from '../../api/asset.api.js';
import { Button }  from '../../components/ui/Button.jsx';
import { Badge }   from '../../components/ui/Badge.jsx';
import { Modal }   from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { fDate }   from '../../utils/format.js';
import toast from 'react-hot-toast';

const TYPE_COLOR = { PREVENTIVE: 'blue', PREDICTIVE: 'yellow', CORRECTIVE: 'red' };
const TYPE_LABEL = { PREVENTIVE: 'Định kỳ', PREDICTIVE: 'Dự đoán', CORRECTIVE: 'Khắc phục' };

export function SchedulesPage() {
  const [schedules, setSchedules] = useState([]);
  const [assets,    setAssets]    = useState([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [page,      setPage]      = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form,       setForm]       = useState({
    maintenanceType: 'PREVENTIVE',
    frequencyValue:  30,
    frequencyUnit:   'DAYS',
  });
  const [saving,     setSaving]     = useState(false);
  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await scheduleApi.getAll({ page, limit: LIMIT });
      setSchedules(res.data.data?.items ?? []);
      setTotal(res.data.data?.total ?? 0);
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => {
    load();
    assetApi.getAll({ limit: 200 }).then(r => setAssets(r.data.data?.items ?? [])).catch(() => {});
  }, [load]);

  const handleGenerateWO = async (id) => {
    try {
      const res = await scheduleApi.generateWO(id);
      toast.success(`Đã tạo WO-${String(res.data.data?.workOrderId ?? 0).padStart(4, '0')} từ lịch bảo trì`);
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi tạo phiếu'); }
  };

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.assetId || !form.scheduleName || !form.startDate) {
      toast.error('Vui lòng điền đầy đủ: Tài sản, Tên lịch, Ngày bắt đầu'); return;
    }
    if (!form.description?.trim()) {
      toast.error('Vui lòng nhập mô tả công việc'); return;
    }
    setSaving(true);
    try {
      await scheduleApi.create({
        ...form,
        frequencyValue: Number(form.frequencyValue || 30),
        frequencyUnit:  (form.frequencyUnit || 'DAYS').toUpperCase(),
      });
      toast.success('Đã tạo lịch bảo trì');
      setCreateOpen(false);
      setForm({});
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi tạo lịch'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => { setForm({ maintenanceType: 'PREVENTIVE', frequencyValue: 30, frequencyUnit: 'DAYS' }); setCreateOpen(true); }}>
          <Plus size={15} /> Thêm lịch bảo trì
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? <PageLoader />
          : schedules.length === 0 ? <EmptyState icon={Calendar} title="Chưa có lịch bảo trì" />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Tên lịch', 'Tài sản', 'Loại bảo trì', 'Tần suất', 'Ngày bắt đầu', 'Ngày kết thúc', ''].map(h => (
                      <th key={h} className="text-left text-xs font-bold text-gray-700 uppercase tracking-wide px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {schedules.map(s => (
                    <tr key={s.scheduleId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{s.scheduleName}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{s.assetName}</td>
                      <td className="px-4 py-3">
                        <Badge color={TYPE_COLOR[s.maintenanceType] ?? 'gray'}>{TYPE_LABEL[s.maintenanceType] ?? s.maintenanceType}</Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{s.frequencyValue} {s.frequencyUnit}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{fDate(s.startDate)}</td>
                      <td className="px-4 py-3 font-medium text-gray-700">{fDate(s.endDate) || '—'}</td>
                      <td className="px-4 py-3">
                        <Button size="xs" variant="secondary" onClick={() => handleGenerateWO(s.scheduleId)}>
                          <Play size={11} /> Tạo WO
                        </Button>
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Thêm lịch bảo trì" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Tên lịch *" value={form.scheduleName ?? ''} onChange={e => setF('scheduleName', e.target.value)} placeholder="VD: PM máy lọc bụi tháng 1" />
            <Select label="Tài sản *" value={form.assetId ?? ''} onChange={e => setF('assetId', e.target.value)}>
              <option value="">— Chọn tài sản —</option>
              {assets.map(a => <option key={a.assetId} value={a.assetId}>{a.assetName}</option>)}
            </Select>
            <Select label="Loại bảo trì" value={form.maintenanceType} onChange={e => setF('maintenanceType', e.target.value)}>
              <option value="PREVENTIVE">Định kỳ (Preventive)</option>
              <option value="PREDICTIVE">Dự đoán (Predictive)</option>
              <option value="CORRECTIVE">Khắc phục (Corrective)</option>
            </Select>
            <div className="flex gap-2">
              <Input label="Tần suất" type="number" min={1} value={form.frequencyValue} onChange={e => setF('frequencyValue', e.target.value)} />
              <Select label="Đơn vị" value={form.frequencyUnit} onChange={e => setF('frequencyUnit', e.target.value)}>
                <option value="DAYS">Ngày</option>
                <option value="WEEKS">Tuần</option>
                <option value="MONTHS">Tháng</option>
                <option value="HOURS">Giờ chạy</option>
              </Select>
            </div>
            <Input label="Ngày bắt đầu *" type="date" value={form.startDate ?? ''} onChange={e => setF('startDate', e.target.value)} />
            <Input label="Ngày kết thúc"  type="date" value={form.endDate   ?? ''} onChange={e => setF('endDate',   e.target.value)} />
          </div>
          <Textarea label="Mô tả công việc *" value={form.description ?? ''} onChange={e => setF('description', e.target.value)} placeholder="Mô tả nội dung bảo trì cần thực hiện..." />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button type="submit" loading={saving}>Thêm lịch</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
