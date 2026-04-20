/**
 * AdminPage.jsx — Quản trị hệ thống: Loại tài sản + Vị trí.
 * Dùng trong: App.jsx (route /admin, RoleGuard routeKey="admin-settings").
 * Liên quan: api/assetType.api.js, api/location.api.js.
 * Phân quyền: Admin (Level ≥ 4) toàn quyền; Level ≥ 2 có thể tạo/sửa.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth }         from '../../contexts/AuthContext.jsx';
import { assetTypeApi }    from '../../api/assetType.api.js';
import { locationApi }     from '../../api/location.api.js';
import { Button }          from '../../components/ui/Button.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import { Modal }           from '../../components/ui/Modal.jsx';
import { Badge }           from '../../components/ui/Badge.jsx';
import toast               from 'react-hot-toast';
import { Plus, Pencil, Trash2, Cpu, MapPin, ChevronRight, Timer } from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'types',     label: 'Loại tài sản',  icon: Cpu    },
  { key: 'locations', label: 'Vị trí',         icon: MapPin },
];

const EMPTY_TYPE = { typeName: '', description: '', defaultPMInterval: '' };
const EMPTY_LOC  = { locationName: '', parentLocationId: '', description: '' };

// ─── AssetTypesTab ────────────────────────────────────────────────────────────
function AssetTypesTab({ user }) {
  const [types,    setTypes]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [open,     setOpen]     = useState(false);
  const [editing,  setEditing]  = useState(null); // null = create
  const [form,     setForm]     = useState(EMPTY_TYPE);
  const [saving,   setSaving]   = useState(false);

  const level     = user?.positionLevel ?? 0;
  const canWrite  = level >= 2;
  const canDelete = level >= 3;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await assetTypeApi.getAll();
      setTypes(res.data.data ?? []);
    } catch { toast.error('Không tải được loại tài sản'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_TYPE); setOpen(true); };
  const openEdit   = (t) => { setEditing(t); setForm({ typeName: t.typeName, description: t.description ?? '', defaultPMInterval: t.defaultPMInterval ?? '' }); setOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.typeName.trim()) { toast.error('Tên loại không được để trống'); return; }
    setSaving(true);
    try {
      const payload = {
        typeName:            form.typeName.trim(),
        description:         form.description.trim() || null,
        defaultPMInterval:   form.defaultPMInterval ? Number(form.defaultPMInterval) : null,
      };
      if (editing) {
        await assetTypeApi.update(editing.assetTypeId, payload);
        toast.success('Đã cập nhật loại tài sản');
      } else {
        await assetTypeApi.create(payload);
        toast.success('Đã thêm loại tài sản');
      }
      setOpen(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`Xóa loại tài sản "${t.typeName}"?\nKhông thể xóa nếu còn tài sản thuộc loại này.`)) return;
    try {
      await assetTypeApi.remove(t.assetTypeId);
      toast.success('Đã xóa');
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi'); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{types.length} loại</p>
        {canWrite && (
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} /> Thêm loại
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-10 text-center text-gray-400 text-sm">Đang tải...</div>
      ) : types.length === 0 ? (
        <div className="py-10 text-center text-gray-400 text-sm">Chưa có loại tài sản nào</div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Tên loại', 'Mô tả', 'Chu kỳ PM (giờ)', ''].map(h => (
                  <th key={h} className="text-left text-xs font-bold text-gray-600 px-4 py-3 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {types.map(t => (
                <tr key={t.assetTypeId} className="hover:bg-blue-50/30">
                  <td className="px-4 py-3 font-semibold text-gray-800">{t.typeName}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{t.description ?? '—'}</td>
                  <td className="px-4 py-3">
                    {t.defaultPMInterval
                      ? <span className="flex items-center gap-1 text-blue-700"><Timer size={13} />{t.defaultPMInterval.toLocaleString()} giờ</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canWrite && (
                        <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors" title="Sửa">
                          <Pencil size={14} />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(t)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors" title="Xóa">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Sửa loại tài sản' : 'Thêm loại tài sản'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Tên loại *"
            value={form.typeName}
            onChange={e => setForm(p => ({ ...p, typeName: e.target.value }))}
            placeholder="VD: Máy bơm, Băng tải..."
            required
          />
          <Input
            label="Chu kỳ bảo trì định kỳ (giờ)"
            type="number"
            min={0}
            value={form.defaultPMInterval}
            onChange={e => setForm(p => ({ ...p, defaultPMInterval: e.target.value }))}
            placeholder="VD: 500"
          />
          <Textarea
            label="Mô tả"
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Mô tả ngắn về loại tài sản..."
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="submit" loading={saving}>{editing ? 'Lưu thay đổi' : 'Thêm mới'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── LocationsTab ─────────────────────────────────────────────────────────────
function LocationsTab({ user }) {
  const [locations, setLocations] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [open,      setOpen]      = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(EMPTY_LOC);
  const [saving,    setSaving]    = useState(false);

  const level     = user?.positionLevel ?? 0;
  const canWrite  = level >= 2;
  const canDelete = level >= 3;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await locationApi.getAll();
      setLocations(res.data.data ?? []);
    } catch { toast.error('Không tải được vị trí'); }
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
      if (editing) {
        await locationApi.update(editing.locationId, payload);
        toast.success('Đã cập nhật vị trí');
      } else {
        await locationApi.create(payload);
        toast.success('Đã thêm vị trí');
      }
      setOpen(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (l) => {
    if (!window.confirm(`Xóa vị trí "${l.locationName}"?\nKhông thể xóa nếu còn vị trí con hoặc tài sản trong vị trí này.`)) return;
    try {
      await locationApi.remove(l.locationId);
      toast.success('Đã xóa');
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi'); }
  };

  // Nhóm hiển thị: show parent → children dạng cây đơn giản
  const parentMap = {};
  locations.forEach(l => { parentMap[l.locationId] = l; });
  const roots    = locations.filter(l => !l.parentLocationId);
  const childOf  = (pid) => locations.filter(l => l.parentLocationId === pid);

  const renderRow = (l, depth = 0) => [
    <tr key={l.locationId} className="hover:bg-blue-50/30">
      <td className="px-4 py-3">
        <span style={{ paddingLeft: depth * 20 }} className="flex items-center gap-1.5">
          {depth > 0 && <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />}
          <span className="font-medium text-gray-800">{l.locationName}</span>
        </span>
      </td>
      <td className="px-4 py-3 text-gray-500 text-sm">{l.parentLocationName ?? '—'}</td>
      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{l.description ?? '—'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {canWrite && (
            <button onClick={() => openEdit(l)} className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors" title="Sửa">
              <Pencil size={14} />
            </button>
          )}
          {canDelete && (
            <button onClick={() => handleDelete(l)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors" title="Xóa">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>,
    ...childOf(l.locationId).flatMap(child => renderRow(child, depth + 1)),
  ];

  // Fallback: nếu không có cây cấu trúc, flatten
  const hasParent = locations.some(l => l.parentLocationId);
  const rows = hasParent
    ? roots.flatMap(r => renderRow(r, 0))
    : locations.map(l => renderRow(l, 0)).flat();

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{locations.length} vị trí</p>
        {canWrite && (
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} /> Thêm vị trí
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-10 text-center text-gray-400 text-sm">Đang tải...</div>
      ) : locations.length === 0 ? (
        <div className="py-10 text-center text-gray-400 text-sm">Chưa có vị trí nào</div>
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
            <tbody className="divide-y divide-gray-100">{rows}</tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Sửa vị trí' : 'Thêm vị trí'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Tên vị trí *"
            value={form.locationName}
            onChange={e => setForm(p => ({ ...p, locationName: e.target.value }))}
            placeholder="VD: Phân xưởng A, Tầng 1..."
            required
          />
          <Select
            label="Vị trí cha (nếu có)"
            value={form.parentLocationId}
            onChange={e => setForm(p => ({ ...p, parentLocationId: e.target.value }))}
          >
            <option value="">— Không có —</option>
            {locations
              .filter(l => !editing || l.locationId !== editing.locationId)
              .map(l => (
                <option key={l.locationId} value={l.locationId}>{l.locationName}</option>
              ))}
          </Select>
          <Textarea
            label="Mô tả"
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Mô tả vị trí..."
          />
          <div className="flex justify-end gap-2 pt-2">
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
  const [tab, setTab] = useState('types');
  const active = TABS.find(t => t.key === tab);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cấu hình hệ thống</h1>
        <p className="text-sm text-gray-500 mt-1">Quản lý danh mục dùng chung trong toàn bộ hệ thống</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
          {active && <active.icon size={18} className="text-blue-600" />}
          <h2 className="text-base font-bold text-gray-800">{active?.label}</h2>
        </div>
        {tab === 'types'     && <AssetTypesTab  user={user} />}
        {tab === 'locations' && <LocationsTab   user={user} />}
      </div>
    </div>
  );
}
