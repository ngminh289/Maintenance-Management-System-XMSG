/**
 * WorkOrderForm.jsx — Form tạo / chỉnh sửa phiếu việc.
 */
import { useState } from 'react';
import { workOrderApi } from '../../api/workOrder.api.js';
import { Button } from '../../components/ui/Button.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';

export function WorkOrderForm({ wo, assets = [], onSuccess, onCancel }) {
  const isEdit = !!wo;
  const [form, setForm] = useState({
    assetId:        wo?.assetId        ?? '',
    description:    wo?.description    ?? '',
    plannedDate:    wo?.plannedDate    ?? '',
    estimatedHours: wo?.estimatedHours ?? '',
    requiresShutdown: Boolean(wo?.requiresShutdown),
    priority:       wo?.priority       ?? 'MEDIUM',
    woSource:       wo?.woSource       ?? 'MANUAL',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.assetId || !form.plannedDate) { setError('Tài sản và ngày dự kiến là bắt buộc'); return; }
    setLoading(true);
    try {
      if (isEdit) await workOrderApi.update(wo.woId, form);
      else        await workOrderApi.create(form);
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Lỗi lưu dữ liệu');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select label="Tài sản *" value={form.assetId} onChange={e => set('assetId', e.target.value)}>
          <option value="">— Chọn tài sản —</option>
          {assets.map(a => <option key={a.assetId} value={a.assetId}>{a.assetName}</option>)}
        </Select>
        <Input label="Ngày dự kiến *" type="date" value={form.plannedDate} onChange={e => set('plannedDate', e.target.value)} />
        <Select label="Ưu tiên" value={form.priority} onChange={e => set('priority', e.target.value)}>
          <option value="LOW">Thấp</option>
          <option value="MEDIUM">Trung bình</option>
          <option value="HIGH">Cao</option>
          <option value="EMERGENCY">Khẩn cấp</option>
        </Select>
        <Select label="Nguồn tạo" value={form.woSource} onChange={e => set('woSource', e.target.value)}>
          <option value="MANUAL">Thủ công</option>
          <option value="SCHEDULE">Từ lịch bảo trì</option>
          <option value="PREDICTIVE">Bảo trì dự báo</option>
          <option value="CORRECTIVE">Khắc phục sự cố</option>
        </Select>
        <Input label="Giờ ước tính" type="number" min={0} value={form.estimatedHours} onChange={e => set('estimatedHours', e.target.value)} placeholder="VD: 4" />
      </div>
      <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={Boolean(form.requiresShutdown)}
          onChange={e => set('requiresShutdown', e.target.checked)}
        />
        Bảo trì cần dừng máy (tính downtime planned)
      </label>
      <Textarea label="Mô tả công việc" value={form.description} onChange={e => set('description', e.target.value)} />

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Hủy</Button>
        <Button type="submit" loading={loading}>{isEdit ? 'Cập nhật' : 'Tạo phiếu'}</Button>
      </div>
    </form>
  );
}
