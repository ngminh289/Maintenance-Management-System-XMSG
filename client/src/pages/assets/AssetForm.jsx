/**
 * AssetForm.jsx — Form thêm / chỉnh sửa tài sản.
 */
import { useState } from 'react';
import { assetApi } from '../../api/asset.api.js';
import { Button }   from '../../components/ui/Button.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';

export function AssetForm({ asset, types = [], locations = [], onSuccess, onCancel }) {
  const isEdit = !!asset;
  const [form, setForm] = useState({
    assetName:       asset?.assetName        ?? '',
    assetTypeId:     asset?.assetTypeId      ?? '',
    locationId:      asset?.locationId       ?? '',
    manufacturer:    asset?.manufacturer     ?? '',
    serialNumber:    asset?.serialNumber     ?? '',
    commissionDate:  asset?.commissionDate   ?? '',
    description:     asset?.description      ?? '',
    status:          asset?.status           ?? 'AVAILABLE',
  });
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState({});

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.assetName.trim()) e.assetName = 'Bắt buộc';
    if (!form.assetTypeId)      e.assetTypeId = 'Bắt buộc';
    if (!form.locationId)       e.locationId  = 'Bắt buộc';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (isEdit) {
        await assetApi.update(asset.assetId, form);
      } else {
        await assetApi.create(form);
      }
      onSuccess?.();
    } catch (err) {
      setErrors({ _: err.response?.data?.message ?? 'Lỗi lưu dữ liệu' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Tên thiết bị *" value={form.assetName} onChange={e => set('assetName', e.target.value)} error={errors.assetName} />
        <Select label="Loại tài sản *" value={form.assetTypeId} onChange={e => set('assetTypeId', e.target.value)} error={errors.assetTypeId}>
          <option value="">— Chọn loại —</option>
          {types.map(t => <option key={t.assetTypeId} value={t.assetTypeId}>{t.typeName}</option>)}
        </Select>
        <Select label="Vị trí *" value={form.locationId} onChange={e => set('locationId', e.target.value)} error={errors.locationId}>
          <option value="">— Chọn vị trí —</option>
          {locations.map(l => <option key={l.locationId} value={l.locationId}>{l.locationName}</option>)}
        </Select>
        <Input label="Nhà sản xuất" value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} />
        <Input label="Số Serial" value={form.serialNumber} onChange={e => set('serialNumber', e.target.value)} />
        <Input label="Ngày đưa vào sử dụng" type="date" value={form.commissionDate} onChange={e => set('commissionDate', e.target.value)} />
        {isEdit && (
          <Select label="Trạng thái" value={form.status} onChange={e => set('status', e.target.value)}>
            {['AVAILABLE','MONITORING','CAUTION','MAINTENANCE','BROKEN'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        )}
      </div>
      <Textarea label="Mô tả" value={form.description} onChange={e => set('description', e.target.value)} />

      {errors._ && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{errors._}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Hủy</Button>
        <Button type="submit" loading={loading}>{isEdit ? 'Cập nhật' : 'Thêm tài sản'}</Button>
      </div>
    </form>
  );
}
