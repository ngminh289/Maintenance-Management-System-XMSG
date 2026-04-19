/**
 * AssetListPage.jsx — Danh sách tài sản với filter, tạo mới, xem QR.
 * RBAC: ASSET:CREATE (thêm), ASSET:DELETE (loại biên).
 */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, QrCode, AlertTriangle, Filter } from 'lucide-react';
import { assetApi } from '../../api/asset.api.js';
import { Button }   from '../../components/ui/Button.jsx';
import { Badge }    from '../../components/ui/Badge.jsx';
import { Select }   from '../../components/ui/Input.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { Modal }    from '../../components/ui/Modal.jsx';
import { ASSET_STATUS_LABEL, ASSET_STATUS_COLOR, fDate } from '../../utils/format.js';
import { AssetForm } from './AssetForm.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { canDo } from '../../utils/rbac.js';
import toast from 'react-hot-toast';

export function AssetListPage() {
  const { user } = useAuth();
  const [assets,  setAssets]  = useState([]);
  const [types,   setTypes]   = useState([]);
  const [locs,    setLocs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const [filters, setFilters] = useState({ search: '', status: '', assetTypeId: '' });
  const [createOpen, setCreateOpen] = useState(false);
  const [qrAsset,    setQrAsset]    = useState(null);
  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await assetApi.getAll({
        page, limit: LIMIT,
        ...(filters.search     && { search: filters.search }),
        ...(filters.status     && { status: filters.status }),
        ...(filters.assetTypeId && { assetTypeId: filters.assetTypeId }),
      });
      setAssets(res.data.data?.items ?? []);
      setTotal(res.data.data?.total  ?? 0);
    } finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => {
    Promise.all([assetApi.getTypes(), assetApi.getLocations()]).then(([t, l]) => {
      setTypes(t.data.data ?? []);
      setLocs(l.data.data  ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleFilter = (key, val) => { setFilters(p => ({ ...p, [key]: val })); setPage(1); };

  const handleDecommission = async (id, name) => {
    if (!confirm(`Loại biên tài sản "${name}"?`)) return;
    try {
      await assetApi.remove(id);
      toast.success('Đã loại biên tài sản');
      load();
    } catch { toast.error('Lỗi loại biên'); }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            placeholder="Tìm tên, mã tài sản..."
            value={filters.search}
            onChange={e => handleFilter('search', e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400
              focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none bg-white"
          />
        </div>
        <Select value={filters.status} onChange={e => handleFilter('status', e.target.value)} className="w-44">
          <option value="">Tất cả trạng thái</option>
          {Object.entries(ASSET_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Select value={filters.assetTypeId} onChange={e => handleFilter('assetTypeId', e.target.value)} className="w-44">
          <option value="">Tất cả loại</option>
          {types.map(t => <option key={t.assetTypeId} value={t.assetTypeId}>{t.typeName}</option>)}
        </Select>
        {canDo(user, 'ASSET:CREATE') && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={15} /> Thêm tài sản
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading
          ? <PageLoader />
          : assets.length === 0
            ? <EmptyState title="Không tìm thấy tài sản" icon={Filter} />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-300">
                    <tr>
                      {['Mã', 'Tên thiết bị', 'Loại', 'Vị trí', 'Trạng thái', 'Ngày đưa vào SD', ''].map(h => (
                        <th key={h} className="text-left text-xs font-bold text-gray-700 px-4 py-3 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {assets.map(a => (
                      <tr key={a.assetId} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-sm font-bold text-gray-700">#{a.assetId}</td>
                        <td className="px-4 py-3">
                          <Link to={`/assets/${a.assetId}`} className="font-semibold text-blue-700 hover:text-blue-800 hover:underline">
                            {a.assetName}
                          </Link>
                          {a.serialNumber && <p className="text-xs text-gray-500 mt-0.5">S/N: {a.serialNumber}</p>}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-700">{a.typeName}</td>
                        <td className="px-4 py-3 text-gray-700">{a.locationName}</td>
                        <td className="px-4 py-3">
                          <Badge color={ASSET_STATUS_COLOR[a.status]}>
                            {ASSET_STATUS_LABEL[a.status] ?? a.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{fDate(a.commissionDate)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setQrAsset(a)} className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors" title="Xem QR">
                              <QrCode size={16} />
                            </button>
                            {canDo(user, 'ASSET:DELETE') && a.status !== 'DECOMMISSIONED' && (
                              <button type="button" onClick={() => handleDecommission(a.assetId, a.assetName)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors" title="Loại biên">
                                <AlertTriangle size={16} />
                              </button>
                            )}
                          </div>
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Thêm tài sản mới" size="lg">
        <AssetForm
          types={types} locations={locs}
          canUploadPhoto={canDo(user, 'ASSET:UPDATE')}
          onSuccess={() => { setCreateOpen(false); load(); toast.success('Đã thêm tài sản'); }}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      <Modal open={!!qrAsset} onClose={() => setQrAsset(null)} title={`QR Code — ${qrAsset?.assetName}`} size="sm">
        {qrAsset && (
          <div className="flex flex-col items-center gap-4">
            <img src={assetApi.getQRUrl(qrAsset.assetId)} alt="QR" className="w-52 h-52 border border-gray-200 rounded-xl" />
            <p className="text-sm text-gray-600 text-center">Quét mã để mở Checklist trên thiết bị di động.</p>
            <a href={assetApi.getQRUrl(qrAsset.assetId)} download={`qr-asset-${qrAsset.assetId}.png`} className="text-sm font-semibold text-blue-600 hover:underline">
              Tải ảnh QR
            </a>
          </div>
        )}
      </Modal>
    </div>
  );
}
