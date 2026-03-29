/**
 * SchedulesPage.jsx — Lịch bảo trì: danh sách + tạo + sửa + xóa + tạo WO từ lịch.
 * project.rule 2.1: "Lập lịch bảo trì (định kỳ, dự đoán, khắc phục)".
 * Hỗ trợ:
 *   - HOURS   : dự báo dựa trên giờ chạy (AssetCounters)
 *   - DAYS/WEEKS/MONTHS/YEARS: theo ngày — NextDueDate tự động tính, WO tự tạo khi đến hạn
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Play, Calendar, Clock,
  AlertTriangle, CheckCircle, Pencil, Trash2, Send,
} from 'lucide-react';
import { scheduleApi } from '../../api/schedule.api.js';
import { assetApi }    from '../../api/asset.api.js';
import { Button }      from '../../components/ui/Button.jsx';
import { Badge }       from '../../components/ui/Badge.jsx';
import { Modal }       from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import { Pagination }  from '../../components/ui/Pagination.jsx';
import { EmptyState }  from '../../components/ui/EmptyState.jsx';
import { PageLoader }  from '../../components/ui/Spinner.jsx';
import { fDate }       from '../../utils/format.js';
import toast from 'react-hot-toast';

const TYPE_COLOR   = { PREVENTIVE: 'blue', PREDICTIVE: 'yellow', CORRECTIVE: 'red' };
const TYPE_LABEL   = { PREVENTIVE: 'Định kỳ', PREDICTIVE: 'Dự đoán', CORRECTIVE: 'Khắc phục' };
const UNIT_LABEL   = { HOURS: 'giờ', DAYS: 'ngày', WEEKS: 'tuần', MONTHS: 'tháng', YEARS: 'năm' };
const STATUS_COLOR = { DRAFT: 'gray', PENDING: 'yellow', IN_PROGRESS: 'blue', COMPLETED: 'green', OVERDUE: 'red', CANCELLED: 'gray' };
const STATUS_LABEL = { DRAFT: 'Bản nháp', PENDING: 'Chờ TH', IN_PROGRESS: 'Đang TH', COMPLETED: 'Hoàn thành', OVERDUE: 'Quá hạn', CANCELLED: 'Hủy' };

const EMPTY_FORM = { maintenanceType: 'PREVENTIVE', frequencyValue: 30, frequencyUnit: 'DAYS' };

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr) - new Date(new Date().toDateString())) / 86400000);
}

function DueDateChip({ nextDueDate, frequencyUnit, status }) {
  if (frequencyUnit === 'HOURS') {
    return <span className="text-xs text-gray-400 italic">Theo giờ chạy</span>;
  }
  if (!nextDueDate) return <span className="text-xs text-gray-400">—</span>;

  const days = daysUntil(nextDueDate);

  if (status === 'OVERDUE' || days < 0) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 rounded-full px-2 py-0.5">
          <AlertTriangle size={10} /> Quá hạn {Math.abs(days)} ngày
        </span>
        <span className="text-xs text-red-500 font-medium">{fDate(nextDueDate)}</span>
      </div>
    );
  }
  if (days <= 7) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
          <Clock size={10} /> Còn {days} ngày
        </span>
        <span className="text-xs text-amber-600 font-medium">{fDate(nextDueDate)}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 rounded-full px-2 py-0.5">
        <CheckCircle size={10} /> Còn {days} ngày
      </span>
      <span className="text-xs text-green-600 font-medium">{fDate(nextDueDate)}</span>
    </div>
  );
}

// ── Form component dùng chung cho cả Tạo và Sửa ────────────────────────────
function ScheduleForm({ form, setF, assets }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Tên lịch *"
          value={form.scheduleName ?? ''}
          onChange={e => setF('scheduleName', e.target.value)}
          placeholder="VD: PM máy lọc bụi tháng 1"
        />
        <Select label="Tài sản *" value={form.assetId ?? ''} onChange={e => setF('assetId', e.target.value)}>
          <option value="">— Chọn tài sản —</option>
          {assets.map(a => <option key={a.assetId} value={a.assetId}>{a.assetName}</option>)}
        </Select>
        <Select label="Loại bảo trì" value={form.maintenanceType} onChange={e => setF('maintenanceType', e.target.value)}>
          <option value="PREVENTIVE">Định kỳ (Preventive)</option>
          <option value="PREDICTIVE">Dự đoán (Predictive)</option>
          <option value="CORRECTIVE">Khắc phục (Corrective)</option>
        </Select>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input label="Tần suất" type="number" min={1} value={form.frequencyValue ?? 30} onChange={e => setF('frequencyValue', e.target.value)} />
          </div>
          <div className="flex-1">
            <Select label="Đơn vị" value={form.frequencyUnit ?? 'DAYS'} onChange={e => setF('frequencyUnit', e.target.value)}>
              <option value="DAYS">Ngày</option>
              <option value="WEEKS">Tuần</option>
              <option value="MONTHS">Tháng</option>
              <option value="HOURS">Giờ chạy</option>
            </Select>
          </div>
        </div>
        <Input label="Ngày bắt đầu *" type="date" value={form.startDate ?? ''} onChange={e => setF('startDate', e.target.value)} />
        <Input label="Ngày kết thúc"  type="date" value={form.endDate   ?? ''} onChange={e => setF('endDate',   e.target.value)} />
      </div>
      <Textarea
        label="Mô tả công việc *"
        value={form.description ?? ''}
        onChange={e => setF('description', e.target.value)}
        placeholder="Mô tả nội dung bảo trì cần thực hiện..."
      />
      {form.frequencyUnit !== 'HOURS' && form.startDate && (
        <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
          Ngày đến hạn đầu tiên: <strong>{fDate(form.startDate)}</strong> + {form.frequencyValue} {UNIT_LABEL[form.frequencyUnit] ?? form.frequencyUnit}. Sau khi tạo/hoàn thành WO, hệ thống tự tính chu kỳ tiếp theo.
        </p>
      )}
      {form.frequencyUnit === 'HOURS' && (
        <p className="text-xs text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2">
          Lịch theo giờ chạy — hệ thống dự báo ngày PM dựa vào đồng hồ tích lũy và trung bình giờ/ngày của tài sản.
        </p>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export function SchedulesPage() {
  const [schedules,  setSchedules]  = useState([]);
  const [assets,     setAssets]     = useState([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem,   setEditItem]   = useState(null);  // lịch đang sửa
  const [deleteItem, setDeleteItem] = useState(null);  // lịch đang xóa
  const [form,       setForm]       = useState(EMPTY_FORM);
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
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi tạo phiếu'); }
  };

  const handleSubmit = async (id) => {
    try {
      await scheduleApi.submit(id);
      toast.success('Đã gửi lịch bảo trì vào luồng phê duyệt');
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi gửi phê duyệt'); }
  };

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const validateForm = (f) => {
    if (!f.assetId || !f.scheduleName?.trim() || !f.startDate) {
      toast.error('Vui lòng điền đầy đủ: Tài sản, Tên lịch, Ngày bắt đầu'); return false;
    }
    if (!f.description?.trim()) {
      toast.error('Vui lòng nhập mô tả công việc'); return false;
    }
    return true;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;
    setSaving(true);
    try {
      await scheduleApi.create({
        ...form,
        frequencyValue: Number(form.frequencyValue || 30),
        frequencyUnit:  (form.frequencyUnit || 'DAYS').toUpperCase(),
      });
      toast.success('Đã tạo lịch bảo trì');
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi tạo lịch'); }
    finally { setSaving(false); }
  };

  const openEdit = (s) => {
    setForm({
      assetId:         String(s.assetId ?? ''),
      scheduleName:    s.scheduleName ?? '',
      maintenanceType: s.maintenanceType ?? 'PREVENTIVE',
      description:     s.description ?? '',
      frequencyValue:  s.frequencyValue ?? 30,
      frequencyUnit:   s.frequencyUnit ?? 'DAYS',
      startDate:       s.startDate ? s.startDate.split('T')[0] : '',
      endDate:         s.endDate   ? s.endDate.split('T')[0]   : '',
    });
    setEditItem(s);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;
    setSaving(true);
    try {
      await scheduleApi.update(editItem.scheduleId, {
        ...form,
        frequencyValue: Number(form.frequencyValue || 30),
        frequencyUnit:  (form.frequencyUnit || 'DAYS').toUpperCase(),
      });
      toast.success('Đã cập nhật lịch bảo trì');
      setEditItem(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi cập nhật'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setSaving(true);
    try {
      await scheduleApi.remove(deleteItem.scheduleId);
      toast.success('Đã xóa lịch bảo trì');
      setDeleteItem(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi xóa'); }
    finally { setSaving(false); }
  };

  const overdueCount = schedules.filter(s => s.frequencyUnit !== 'HOURS' && daysUntil(s.nextDueDate) < 0).length;
  const warningCount = schedules.filter(s => {
    const d = daysUntil(s.nextDueDate);
    return s.frequencyUnit !== 'HOURS' && d !== null && d >= 0 && d <= 7;
  }).length;

  return (
    <div className="space-y-5">
      {/* Banner cảnh báo */}
      {(overdueCount > 0 || warningCount > 0) && (
        <div className="flex gap-3 flex-wrap">
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              <AlertTriangle size={16} className="text-red-600 shrink-0" />
              <span className="text-sm font-bold text-red-700">{overdueCount} lịch quá hạn — hệ thống đã tự tạo WO</span>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
              <Clock size={16} className="text-amber-600 shrink-0" />
              <span className="text-sm font-bold text-amber-700">{warningCount} lịch sắp đến hạn (≤ 7 ngày)</span>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true); }}>
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
                    {['Tên lịch', 'Tài sản', 'Loại', 'Trạng thái', 'Tần suất', 'Ngày bắt đầu', 'Ngày đến hạn', 'Ngày TH cuối', ''].map(h => (
                      <th key={h} className="text-left text-xs font-bold text-gray-700 uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {schedules.map(s => {
                    const days = s.frequencyUnit !== 'HOURS' ? daysUntil(s.nextDueDate) : null;
                    const isOverdue = days !== null && days < 0;
                    const isWarning = days !== null && days >= 0 && days <= 7;
                    return (
                      <tr key={s.scheduleId} className={`hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-red-50/40' : isWarning ? 'bg-amber-50/40' : ''}`}>
                        <td className="px-4 py-3 font-semibold text-gray-900">{s.scheduleName}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{s.assetName}</td>
                        <td className="px-4 py-3">
                          <Badge color={TYPE_COLOR[s.maintenanceType] ?? 'gray'}>{TYPE_LABEL[s.maintenanceType] ?? s.maintenanceType}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge color={STATUS_COLOR[s.status] ?? 'gray'}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                          {s.frequencyValue} {UNIT_LABEL[s.frequencyUnit] ?? s.frequencyUnit}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{fDate(s.startDate)}</td>
                        <td className="px-4 py-3">
                          <DueDateChip nextDueDate={s.nextDueDate} frequencyUnit={s.frequencyUnit} status={s.status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {fDate(s.lastExecutedDate) || <span className="text-gray-400 italic text-xs">Chưa TH</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {/* Gửi phê duyệt — chỉ hiện khi DRAFT */}
                            {s.status === 'DRAFT' && (
                              <Button size="xs" variant="secondary" onClick={() => handleSubmit(s.scheduleId)} title="Gửi phê duyệt">
                                <Send size={11} /> Gửi
                              </Button>
                            )}
                            {/* Tạo WO thủ công — chỉ khi PENDING */}
                            {s.status === 'PENDING' && (
                              <Button size="xs" variant="secondary" onClick={() => handleGenerateWO(s.scheduleId)} title="Tạo WO thủ công">
                                <Play size={11} /> WO
                              </Button>
                            )}
                            <button onClick={() => openEdit(s)} title="Sửa lịch"
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-colors">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => setDeleteItem(s)} title="Xóa lịch"
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / LIMIT)} onChange={setPage} />

      {/* Modal Tạo mới */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Thêm lịch bảo trì" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <ScheduleForm form={form} setF={setF} assets={assets} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button type="submit" loading={saving}>Thêm lịch</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Sửa */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Sửa lịch bảo trì" size="lg">
        <form onSubmit={handleEdit} className="space-y-4">
          <ScheduleForm form={form} setF={setF} assets={assets} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditItem(null)}>Hủy</Button>
            <Button type="submit" loading={saving}>Lưu thay đổi</Button>
          </div>
        </form>
      </Modal>

      {/* Modal xác nhận Xóa */}
      <Modal open={!!deleteItem} onClose={() => setDeleteItem(null)} title="Xác nhận xóa" size="sm">
        {deleteItem && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Bạn có chắc muốn xóa lịch bảo trì <strong>"{deleteItem.scheduleName}"</strong>
              {' '}của tài sản <strong>{deleteItem.assetName}</strong>?
            </p>
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDeleteItem(null)}>Hủy</Button>
              <Button variant="danger" onClick={handleDelete} loading={saving}>
                <Trash2 size={14} /> Xóa lịch
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
