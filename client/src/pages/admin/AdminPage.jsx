/**
 * AdminPage.jsx — Quản trị hệ thống: Loại tài sản (cây 2 cấp) + Vị trí + Dây chuyền.
 * Dùng trong: App.jsx (route /admin, RoleGuard routeKey="admin-settings").
 * Liên quan: api/assetType.api.js, api/location.api.js, api/productionLine.api.js.
 * Phân quyền dựa trên positionLevel (server guard: Level ≥ 2 write, ≥ 3 delete).
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth }            from '../../contexts/AuthContext.jsx';
import { assetTypeApi }       from '../../api/assetType.api.js';
import { locationApi }        from '../../api/location.api.js';
import { productionLineApi }  from '../../api/productionLine.api.js';
import { Button }             from '../../components/ui/Button.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import { Modal }              from '../../components/ui/Modal.jsx';
import toast                  from 'react-hot-toast';
import {
  Plus, Pencil, Trash2, Cpu, MapPin, Factory,
  ChevronRight, Timer, FolderTree,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'types',     label: 'Loại tài sản',  icon: Cpu     },
  { key: 'locations', label: 'Vị trí',         icon: MapPin  },
  { key: 'lines',     label: 'Dây chuyền',     icon: Factory },
];

const PM_UNITS = [
  { value: 'HOURS',  label: 'Giờ chạy' },
  { value: 'DAYS',   label: 'Ngày' },
  { value: 'WEEKS',  label: 'Tuần' },
  { value: 'MONTHS', label: 'Tháng' },
  { value: 'YEARS',  label: 'Năm' },
];

const EMPTY_TYPE = { typeName: '', parentTypeId: '', defaultPMValue: '', defaultPMUnit: 'DAYS', description: '' };
const EMPTY_LOC  = { locationName: '', parentLocationId: '', description: '' };
const EMPTY_LINE = { lineName: '', description: '' };

// ─── AssetTypesTab ────────────────────────────────────────────────────────────
function AssetTypesTab({ level }) {
  const [types,   setTypes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [open,    setOpen]    = useState(false);
  const [editing, setEditing] = useState(null);
  const [form,    setForm]    = useState(EMPTY_TYPE);
  const [saving,  setSaving]  = useState(false);

  const canWrite  = level >= 2;
  const canDelete = level >= 3;

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await assetTypeApi.getAll(); setTypes(r.data.data ?? []); }
    catch { toast.error('Không tải được loại tài sản'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const parents = types.filter(t => t.parentTypeId == null);
  const childrenOf = (pid) => types.filter(t => t.parentTypeId === pid);
  const isParent = (t) => t.parentTypeId == null;

  const openCreate = (parentTypeId = null) => {
    setEditing(null);
    setForm({ ...EMPTY_TYPE, parentTypeId: parentTypeId ?? '' });
    setOpen(true);
  };
  const openEdit = (t) => {
    setEditing(t);
    setForm({
      typeName:      t.typeName,
      parentTypeId:  t.parentTypeId ?? '',
      defaultPMValue: t.defaultPMValue ?? '',
      defaultPMUnit:  t.defaultPMUnit  ?? 'DAYS',
      description:   t.description ?? '',
    });
    setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.typeName.trim()) { toast.error('Tên loại không được để trống'); return; }
    setSaving(true);
    try {
      const isChild = !!form.parentTypeId;
      const payload = {
        typeName:     form.typeName.trim(),
        parentTypeId: form.parentTypeId ? Number(form.parentTypeId) : null,
        description:  form.description.trim() || null,
        defaultPMValue: (isChild && form.defaultPMValue) ? Number(form.defaultPMValue) : null,
        defaultPMUnit:  (isChild && form.defaultPMValue) ? form.defaultPMUnit : null,
      };
      if (editing) {
        await assetTypeApi.update(editing.assetTypeId, payload);
        toast.success('Đã cập nhật');
      } else {
        await assetTypeApi.create(payload);
        toast.success('Đã thêm');
      }
      setOpen(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (t) => {
    const msg = isParent(t)
      ? `Xóa loại cha "${t.typeName}"? Tất cả loại con bên dưới cũng phải được xóa trước.`
      : `Xóa loại con "${t.typeName}"?`;
    if (!window.confirm(msg)) return;
    try { await assetTypeApi.remove(t.assetTypeId); toast.success('Đã xóa'); load(); }
    catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi'); }
  };

  const isChild   = !!form.parentTypeId;
  const hasPMValue = !!form.defaultPMValue;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <FolderTree size={14} />
          <span>{parents.length} loại cha, {types.filter(t => t.parentTypeId).length} loại con</span>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => openCreate(null)}>
            <Plus size={14} /> Thêm loại cha
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-10 text-center text-gray-400 text-sm">Đang tải...</div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Tên loại', 'Chu kỳ PM mặc định', 'Mô tả', ''].map(h => (
                  <th key={h} className="text-left text-xs font-bold text-gray-600 px-4 py-3 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {parents.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Chưa có loại tài sản nào</td></tr>
              ) : parents.map(parent => [
                /* ── Loại cha ── */
                <tr key={parent.assetTypeId} className="bg-blue-50/40">
                  <td className="px-4 py-2.5 font-bold text-blue-800">{parent.typeName}</td>
                  <td className="px-4 py-2.5 text-gray-400 italic text-xs">— (nhóm)</td>
                  <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate">{parent.description ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {canWrite && (
                        <>
                          <button title="Thêm loại con" onClick={() => openCreate(parent.assetTypeId)}
                            className="p-1.5 rounded-lg hover:bg-green-100 text-green-600 transition-colors">
                            <Plus size={13} />
                          </button>
                          <button title="Sửa loại cha" onClick={() => openEdit(parent)}
                            className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors">
                            <Pencil size={13} />
                          </button>
                        </>
                      )}
                      {canDelete && (
                        <button title="Xóa loại cha" onClick={() => handleDelete(parent)}
                          className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>,
                /* ── Loại con ── */
                ...childrenOf(parent.assetTypeId).map(child => (
                  <tr key={child.assetTypeId} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1.5 pl-5">
                        <ChevronRight size={12} className="text-gray-400" />
                        <span className="font-medium text-gray-800">{child.typeName}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {child.defaultPMValue
                        ? <span className="flex items-center gap-1 text-blue-700 text-sm">
                            <Timer size={12} />
                            {child.defaultPMValue} {PM_UNITS.find(u => u.value === child.defaultPMUnit)?.label ?? child.defaultPMUnit}
                          </span>
                        : <span className="text-gray-400 text-sm">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate">{child.description ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {canWrite && (
                          <button title="Sửa" onClick={() => openEdit(child)}
                            className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors">
                            <Pencil size={13} />
                          </button>
                        )}
                        {canDelete && (
                          <button title="Xóa" onClick={() => handleDelete(child)}
                            className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      )}

      {/* Form thêm/sửa */}
      <Modal open={open} onClose={() => setOpen(false)}
        title={editing ? `Sửa: ${editing.typeName}` : (form.parentTypeId ? 'Thêm loại con' : 'Thêm loại cha')}
        size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Tên loại *" value={form.typeName}
            onChange={e => setForm(p => ({ ...p, typeName: e.target.value }))}
            placeholder={isChild ? 'VD: Máy bơm cỡ lớn' : 'VD: Máy bơm'}
            required />

          <Select label="Loại cha" value={form.parentTypeId}
            onChange={e => setForm(p => ({ ...p, parentTypeId: e.target.value }))}>
            <option value="">— Không có (loại cha) —</option>
            {parents
              .filter(p => !editing || p.assetTypeId !== editing.assetTypeId)
              .map(p => <option key={p.assetTypeId} value={p.assetTypeId}>{p.typeName}</option>)}
          </Select>

          {isChild && (
            <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Chu kỳ PM mặc định (gợi ý)</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input label="Giá trị" type="number" min={1}
                    value={form.defaultPMValue}
                    onChange={e => setForm(p => ({ ...p, defaultPMValue: e.target.value }))}
                    placeholder="VD: 30" />
                </div>
                <div className="flex-1">
                  <Select label="Đơn vị" value={form.defaultPMUnit}
                    onChange={e => setForm(p => ({ ...p, defaultPMUnit: e.target.value }))}>
                    {PM_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </Select>
                </div>
              </div>
              {hasPMValue && (
                <p className="text-xs text-blue-600">
                  Khi tạo lịch bảo trì cho thiết bị loại này, hệ thống sẽ tự điền gợi ý {form.defaultPMValue} {PM_UNITS.find(u => u.value === form.defaultPMUnit)?.label}.
                </p>
              )}
            </div>
          )}

          <Textarea label="Mô tả" value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Mô tả ngắn..." />

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="submit" loading={saving}>{editing ? 'Lưu thay đổi' : 'Thêm mới'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── LocationsTab ─────────────────────────────────────────────────────────────
function LocationsTab({ level }) {
  const [locations, setLocations] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [open,      setOpen]      = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(EMPTY_LOC);
  const [saving,    setSaving]    = useState(false);

  const canWrite  = level >= 2;
  const canDelete = level >= 3;

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await locationApi.getAll(); setLocations(r.data.data ?? []); }
    catch { toast.error('Không tải được vị trí'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_LOC); setOpen(true); };
  const openEdit   = (l) => {
    setEditing(l);
    setForm({ locationName: l.locationName, parentLocationId: l.parentLocationId ?? '', description: l.description ?? '' });
    setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.locationName.trim()) { toast.error('Tên vị trí không được để trống'); return; }
    setSaving(true);
    try {
      const payload = {
        locationName:     form.locationName.trim(),
        parentLocationId: form.parentLocationId ? Number(form.parentLocationId) : null,
        description:      form.description.trim() || null,
      };
      if (editing) { await locationApi.update(editing.locationId, payload); toast.success('Đã cập nhật'); }
      else         { await locationApi.create(payload); toast.success('Đã thêm'); }
      setOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (l) => {
    if (!window.confirm(`Xóa vị trí "${l.locationName}"?\nKhông thể xóa nếu còn vị trí con hoặc tài sản.`)) return;
    try { await locationApi.remove(l.locationId); toast.success('Đã xóa'); load(); }
    catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi'); }
  };

  const roots   = locations.filter(l => !l.parentLocationId);
  const childOf = (pid) => locations.filter(l => l.parentLocationId === pid);

  const renderRow = (l, depth = 0) => [
    <tr key={l.locationId} className={`hover:bg-gray-50 ${depth === 0 ? 'bg-gray-50/60' : ''}`}>
      <td className="px-4 py-2.5">
        <span style={{ paddingLeft: depth * 18 }} className="flex items-center gap-1.5">
          {depth > 0 && <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />}
          <span className={`${depth === 0 ? 'font-semibold text-gray-800' : 'font-medium text-gray-700'}`}>{l.locationName}</span>
        </span>
      </td>
      <td className="px-4 py-2.5 text-sm text-gray-500">{l.parentLocationName ?? '—'}</td>
      <td className="px-4 py-2.5 text-sm text-gray-500 max-w-xs truncate">{l.description ?? '—'}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-1">
          {canWrite  && <button title="Sửa"  onClick={() => openEdit(l)}    className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600"><Pencil  size={13} /></button>}
          {canDelete && <button title="Xóa"  onClick={() => handleDelete(l)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-500"><Trash2 size={13} /></button>}
        </div>
      </td>
    </tr>,
    ...childOf(l.locationId).flatMap(c => renderRow(c, depth + 1)),
  ];

  const hasTree = locations.some(l => l.parentLocationId);
  const rows    = hasTree ? roots.flatMap(r => renderRow(r, 0)) : locations.map(l => renderRow(l, 0)).flat();

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{locations.length} vị trí</p>
        {canWrite && <Button size="sm" onClick={openCreate}><Plus size={14} /> Thêm vị trí</Button>}
      </div>
      {loading ? (
        <div className="py-10 text-center text-gray-400 text-sm">Đang tải...</div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Tên vị trí', 'Vị trí cha', 'Mô tả', ''].map(h => (
                  <th key={h} className="text-left text-xs font-bold text-gray-600 px-4 py-3 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length ? rows : <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Chưa có vị trí nào</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Sửa vị trí' : 'Thêm vị trí'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Tên vị trí *" value={form.locationName}
            onChange={e => setForm(p => ({ ...p, locationName: e.target.value }))}
            placeholder="VD: Phân xưởng A, Tầng 1..." required />
          <Select label="Vị trí cha (nếu có)" value={form.parentLocationId}
            onChange={e => setForm(p => ({ ...p, parentLocationId: e.target.value }))}>
            <option value="">— Không có —</option>
            {locations.filter(l => !editing || l.locationId !== editing.locationId)
              .map(l => <option key={l.locationId} value={l.locationId}>{l.locationName}</option>)}
          </Select>
          <Textarea label="Mô tả" value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Mô tả vị trí..." />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="submit" loading={saving}>{editing ? 'Lưu thay đổi' : 'Thêm mới'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── ProductionLinesTab ───────────────────────────────────────────────────────
function ProductionLinesTab({ level }) {
  const [lines,   setLines]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [open,    setOpen]    = useState(false);
  const [editing, setEditing] = useState(null);
  const [form,    setForm]    = useState(EMPTY_LINE);
  const [saving,  setSaving]  = useState(false);

  const canWrite  = level >= 2;
  const canDelete = level >= 3;

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await productionLineApi.getAll(); setLines(r.data.data ?? []); }
    catch { toast.error('Không tải được dây chuyền'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_LINE); setOpen(true); };
  const openEdit   = (l) => { setEditing(l); setForm({ lineName: l.lineName, description: l.description ?? '' }); setOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.lineName.trim()) { toast.error('Tên dây chuyền không được để trống'); return; }
    setSaving(true);
    try {
      const payload = { lineName: form.lineName.trim(), description: form.description.trim() || null };
      if (editing) { await productionLineApi.update(editing.lineId, payload); toast.success('Đã cập nhật'); }
      else         { await productionLineApi.create(payload); toast.success('Đã thêm'); }
      setOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (l) => {
    if (!window.confirm(`Xóa "${l.lineName}"?\nKhông thể xóa nếu còn tài sản thuộc dây chuyền này.`)) return;
    try { await productionLineApi.remove(l.lineId); toast.success('Đã xóa'); load(); }
    catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi'); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{lines.length} dây chuyền</p>
        {canWrite && <Button size="sm" onClick={openCreate}><Plus size={14} /> Thêm</Button>}
      </div>
      {loading ? (
        <div className="py-10 text-center text-gray-400 text-sm">Đang tải...</div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Tên dây chuyền / phân loại', 'Mô tả', ''].map(h => (
                  <th key={h} className="text-left text-xs font-bold text-gray-600 px-4 py-3 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.length === 0
                ? <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">Chưa có dây chuyền nào</td></tr>
                : lines.map(l => (
                  <tr key={l.lineId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{l.lineName}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{l.description ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canWrite  && <button title="Sửa"  onClick={() => openEdit(l)}     className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600"><Pencil  size={13} /></button>}
                        {canDelete && <button title="Xóa"  onClick={() => handleDelete(l)}  className="p-1.5 rounded-lg hover:bg-red-100 text-red-500"><Trash2  size={13} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Sửa dây chuyền' : 'Thêm dây chuyền'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Tên *" value={form.lineName}
            onChange={e => setForm(p => ({ ...p, lineName: e.target.value }))}
            placeholder="VD: Dây chuyền 1, Dùng chung..." required />
          <Textarea label="Mô tả" value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Mô tả..." />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="submit" loading={saving}>{editing ? 'Lưu thay đổi' : 'Thêm mới'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── AdminPage (main) ─────────────────────────────────────────────────────────
export function AdminPage() {
  const { user } = useAuth();
  const level    = user?.positionLevel ?? 0;
  const [tab, setTab] = useState('types');
  const active = TABS.find(t => t.key === tab);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cấu hình hệ thống</h1>
        <p className="text-sm text-gray-500 mt-1">Quản lý danh mục dùng chung trong toàn bộ hệ thống</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
          {active && <active.icon size={18} className="text-blue-600" />}
          <h2 className="text-base font-bold text-gray-800">{active?.label}</h2>
        </div>
        {tab === 'types'     && <AssetTypesTab      level={level} />}
        {tab === 'locations' && <LocationsTab       level={level} />}
        {tab === 'lines'     && <ProductionLinesTab level={level} />}
      </div>
    </div>
  );
}
