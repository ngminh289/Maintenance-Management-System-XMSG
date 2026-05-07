/**
 * AssetForm.jsx — Form thêm / chỉnh sửa tài sản đầy đủ + upload ảnh.
 * Sections: Thông tin cơ bản | Thông tin kỹ thuật | Thời gian & trạng thái | Ảnh thiết bị
 * Loại tài sản: chỉ hiển thị loại CON (leaf) từ cây 2 cấp (migration 048).
 * Dây chuyền: load từ API /production-lines (migration 048, thay ENUM cứng).
 * Liên quan: asset.model.js, asset.validator.js, asset.api.js, AssetDetailPage.jsx
 * Quyền upload ảnh: chỉ role có ASSET:UPDATE (truyền vào qua prop canUploadPhoto).
 */
import { useRef, useState, useEffect } from 'react';
import { ImagePlus, X, Upload } from 'lucide-react';
import { assetApi }          from '../../api/asset.api.js';
import { assetTypeApi }      from '../../api/assetType.api.js';
import { productionLineApi } from '../../api/productionLine.api.js';
import { Button }   from '../../components/ui/Button.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { toDateInputValue } from '../../utils/format.js';

const STATUS_OPTIONS = [
  { value: 'AVAILABLE',      label: 'Hoạt động bình thường' },
  { value: 'MONITORING',     label: 'Đang giám sát' },
  { value: 'CAUTION',        label: 'Cần chú ý' },
  { value: 'MAINTENANCE',    label: 'Đang bảo trì' },
  { value: 'BROKEN',         label: 'Hỏng hóc' },
  { value: 'DECOMMISSIONED', label: 'Ngưng hoạt động' },
];

const CURRENT_YEAR = new Date().getFullYear();
const PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp';
const MAX_PHOTOS   = 10;

function SectionTitle({ children }) {
  return (
    <div className="col-span-full">
      <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-100 pb-1.5 mb-0.5">
        {children}
      </h4>
    </div>
  );
}

export function AssetForm({ asset, locations = [], canUploadPhoto = false, onSuccess, onCancel }) {
  const isEdit = !!asset;
  const fileInputRef = useRef(null);

  const [leafTypes,       setLeafTypes]       = useState([]);
  const [productionLines, setProductionLines] = useState([]);

  useEffect(() => {
    assetTypeApi.getLeaves().then(r => setLeafTypes(r.data.data ?? [])).catch(() => {});
    productionLineApi.getAll().then(r => setProductionLines(r.data.data ?? [])).catch(() => {});
  }, []);

  const [form, setForm] = useState({
    assetName:         asset?.assetName         ?? '',
    assetTypeId:       asset?.assetTypeId        ?? '',
    locationId:        asset?.locationId         ?? '',
    status:            asset?.status             ?? 'AVAILABLE',
    manufacturer:      asset?.manufacturer       ?? '',
    serialNumber:      asset?.serialNumber       ?? '',
    model:             asset?.model              ?? '',
    yearOfManufacture: asset?.yearOfManufacture  ?? '',
    technicalSpecs:    asset?.technicalSpecs     ?? '',
    purchaseDate:      toDateInputValue(asset?.purchaseDate),
    commissionDate:    toDateInputValue(asset?.commissionDate),
    warrantyDate:      toDateInputValue(asset?.warrantyDate),
    decommissionDate:  toDateInputValue(asset?.decommissionDate),
    description:       asset?.description        ?? '',
    productionLine:    asset?.productionLineId   ?? '',
  });

  const [selectedPhotos, setSelectedPhotos] = useState([]); // File[]
  const [previews,       setPreviews]       = useState([]); // { url, name }[]
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState({});
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  // Xử lý chọn file ảnh
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const total = selectedPhotos.length + files.length;
    if (total > MAX_PHOTOS) {
      setErrors(p => ({ ...p, photos: `Tối đa ${MAX_PHOTOS} ảnh mỗi lần` }));
      return;
    }
    setErrors(p => { const n = { ...p }; delete n.photos; return n; });

    setSelectedPhotos(p => [...p, ...files]);
    setPreviews(p => [
      ...p,
      ...files.map(f => ({ url: URL.createObjectURL(f), name: f.name })),
    ]);
    e.target.value = '';
  };

  const removePreview = (idx) => {
    URL.revokeObjectURL(previews[idx].url);
    setSelectedPhotos(p => p.filter((_, i) => i !== idx));
    setPreviews(p => p.filter((_, i) => i !== idx));
  };

  const validate = () => {
    const e = {};
    if (!form.assetName.trim()) e.assetName   = 'Bắt buộc';
    if (!form.assetTypeId)      e.assetTypeId = 'Bắt buộc';
    if (!form.locationId)       e.locationId  = 'Bắt buộc';

    if (form.yearOfManufacture) {
      const y = Number(form.yearOfManufacture);
      if (!Number.isInteger(y) || y < 1900 || y > CURRENT_YEAR + 1) {
        e.yearOfManufacture = `Năm hợp lệ: 1900 – ${CURRENT_YEAR}`;
      }
    }
    const dateFields = [
      ['purchaseDate',     'Ngày mua'],
      ['commissionDate',   'Ngày đưa vào sử dụng'],
      ['warrantyDate',     'Hạn bảo hành'],
      ['decommissionDate', 'Ngày ngưng hoạt động'],
    ];
    for (const [key, label] of dateFields) {
      if (form[key] && isNaN(Date.parse(form[key]))) e[key] = `${label} không hợp lệ`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const performSave = async () => {
    setLoading(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]),
      );

      let savedId;
      if (isEdit) {
        const res = await assetApi.update(asset.assetId, payload);
        savedId = res.data.data.assetId;
      } else {
        const res = await assetApi.create(payload);
        savedId = res.data.data.assetId;
      }

      if (selectedPhotos.length > 0 && savedId) {
        const fd = new FormData();
        selectedPhotos.forEach(f => fd.append('photos', f));
        await assetApi.uploadPhotos(savedId, fd);
      }

      setConfirmSaveOpen(false);
      onSuccess?.();
    } catch (err) {
      setConfirmSaveOpen(false);
      setErrors({ _: err.response?.data?.message ?? 'Lỗi lưu dữ liệu' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (isEdit) {
      setConfirmSaveOpen(true);
      return;
    }
    void performSave();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Thông tin cơ bản ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SectionTitle>Thông tin cơ bản</SectionTitle>

        <Input
          label="Tên thiết bị *"
          value={form.assetName}
          onChange={e => set('assetName', e.target.value)}
          error={errors.assetName}
          placeholder="Ví dụ: Máy nén khí AIRC-001"
        />
        <Select
          label="Loại tài sản *"
          value={form.assetTypeId}
          onChange={e => set('assetTypeId', e.target.value)}
          error={errors.assetTypeId}
        >
          <option value="">— Chọn loại —</option>
          {leafTypes.map(t => (
            <option key={t.assetTypeId} value={t.assetTypeId}>
              {t.parentTypeName ? `${t.parentTypeName} › ${t.typeName}` : t.typeName}
            </option>
          ))}
        </Select>
        <Select
          label="Vị trí *"
          value={form.locationId}
          onChange={e => set('locationId', e.target.value)}
          error={errors.locationId}
        >
          <option value="">— Chọn vị trí —</option>
          {locations.map((l) => (
            <option key={l.locationId} value={l.locationId}>
              {l.parentLocationName ? `${l.parentLocationName} › ${l.locationName}` : l.locationName}
            </option>
          ))}
        </Select>
        <Select
          label="Trạng thái"
          value={form.status}
          onChange={e => set('status', e.target.value)}
        >
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
      </div>

      {/* ── Thông tin kỹ thuật ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SectionTitle>Thông tin kỹ thuật</SectionTitle>

        <Input
          label="Nhà sản xuất"
          value={form.manufacturer}
          onChange={e => set('manufacturer', e.target.value)}
          placeholder="Ví dụ: HITACHI"
        />
        <Input
          label="Model"
          value={form.model}
          onChange={e => set('model', e.target.value)}
          placeholder="Ví dụ: HRY0219"
        />
        <Input
          label="Số serial"
          value={form.serialNumber}
          onChange={e => set('serialNumber', e.target.value)}
          placeholder="Ví dụ: HRY2396008"
        />
        <Input
          label="Năm sản xuất"
          type="number"
          min={1900}
          max={CURRENT_YEAR + 1}
          value={form.yearOfManufacture}
          onChange={e => set('yearOfManufacture', e.target.value)}
          error={errors.yearOfManufacture}
          placeholder={String(CURRENT_YEAR)}
        />
        <div className="col-span-full">
          <Textarea
            label="Đặc tính kỹ thuật"
            value={form.technicalSpecs}
            onChange={e => set('technicalSpecs', e.target.value)}
            placeholder="Ví dụ: Công suất 4200 m³/h, Trọng lượng 2670 kg..."
            rows={3}
          />
        </div>
      </div>

      {/* ── Thời gian ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SectionTitle>Thời gian</SectionTitle>

        <Input
          label="Ngày mua"
          type="date"
          value={form.purchaseDate}
          onChange={e => set('purchaseDate', e.target.value)}
          error={errors.purchaseDate}
        />
        <Input
          label="Hạn bảo hành"
          type="date"
          value={form.warrantyDate}
          onChange={e => set('warrantyDate', e.target.value)}
          error={errors.warrantyDate}
        />
        <Input
          label="Ngày đưa vào sử dụng"
          type="date"
          value={form.commissionDate}
          onChange={e => set('commissionDate', e.target.value)}
          error={errors.commissionDate}
        />
        <Input
          label="Ngày ngưng hoạt động"
          type="date"
          value={form.decommissionDate}
          onChange={e => set('decommissionDate', e.target.value)}
          error={errors.decommissionDate}
        />
      </div>

      {/* ── Dây chuyền ── */}
      <Select
        label="Phân loại sử dụng"
        value={form.productionLine}
        onChange={e => set('productionLine', e.target.value)}
      >
        <option value="">— Chưa phân loại —</option>
        {productionLines.map(l => (
          <option key={l.lineId} value={l.lineId}>{l.lineName}</option>
        ))}
      </Select>

      {/* ── Mô tả ── */}
      <Textarea
        label="Mô tả / ghi chú thêm"
        value={form.description}
        onChange={e => set('description', e.target.value)}
        placeholder="Ghi chú thêm về thiết bị..."
      />

      {/* ── Ảnh thiết bị (chỉ hiện nếu có quyền) ── */}
      {canUploadPhoto && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-100 pb-1.5 mb-3">
            Ảnh thiết bị
          </h4>

          {previews.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
              {previews.map((pv, idx) => (
                <div key={pv.url} className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square bg-gray-50">
                  <img src={pv.url} alt={pv.name} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePreview(idx)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={PHOTO_ACCEPT}
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={selectedPhotos.length >= MAX_PHOTOS}
            className="flex items-center gap-2 px-3 py-2 text-sm border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-full justify-center"
          >
            <ImagePlus size={16} />
            {selectedPhotos.length === 0
              ? 'Chọn ảnh (JPG/PNG/WEBP, tối đa 10 ảnh)'
              : `Thêm ảnh (${selectedPhotos.length}/${MAX_PHOTOS} đã chọn)`}
          </button>
          {errors.photos && <p className="text-xs text-red-600 mt-1">{errors.photos}</p>}
        </div>
      )}

      {errors._ && (
        <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{errors._}</p>
      )}

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Hủy</Button>
        <Button type="submit" loading={loading && !confirmSaveOpen}>
          {loading && !confirmSaveOpen
            ? (selectedPhotos.length > 0 ? <><Upload size={14} /> Đang lưu...</> : 'Đang lưu...')
            : (isEdit ? 'Lưu' : 'Thêm tài sản')}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmSaveOpen}
        title="Xác nhận lưu chỉnh sửa"
        message="Bạn có muốn lưu chi tiết chỉnh sửa không?"
        confirmLabel="Lưu"
        cancelLabel="Không"
        loading={loading}
        onConfirm={() => { void performSave(); }}
        onCancel={() => setConfirmSaveOpen(false)}
      />
    </form>
  );
}
