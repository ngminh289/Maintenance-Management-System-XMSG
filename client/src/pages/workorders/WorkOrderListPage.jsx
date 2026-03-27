/**
 * WorkOrderListPage.jsx — Danh sách phiếu việc.
 */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { workOrderApi } from '../../api/workOrder.api.js';
import { assetApi }     from '../../api/asset.api.js';
import { Button }   from '../../components/ui/Button.jsx';
import { Badge }    from '../../components/ui/Badge.jsx';
import { Select }   from '../../components/ui/Input.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { Modal }    from '../../components/ui/Modal.jsx';
import { WO_STATUS_LABEL, WO_STATUS_COLOR, WO_PRIORITY_LABEL, WO_PRIORITY_COLOR, fDate } from '../../utils/format.js';
import { WorkOrderForm } from './WorkOrderForm.jsx';
import toast from 'react-hot-toast';

const STATUS_TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
  { key: 'WAITING',          label: 'Chờ thực hiện' },
  { key: 'IN_PROGRESS',      label: 'Đang thực hiện' },
  { key: 'COMPLETED',        label: 'Hoàn thành' },
  { key: 'CANCELLED',        label: 'Đã hủy' },
];

export function WorkOrderListPage() {
  const [orders,  setOrders]  = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const [status,  setStatus]  = useState('');
  const [priority, setPriority] = useState('');
  const [assets,  setAssets]  = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workOrderApi.getAll({ page, limit: LIMIT, ...(status && { status }), ...(priority && { priority }) });
      setOrders(res.data.data?.items ?? []);
      setTotal(res.data.data?.total  ?? 0);
    } finally { setLoading(false); }
  }, [page, status, priority]);

  useEffect(() => {
    assetApi.getAll({ limit: 200 }).then(r => setAssets(r.data.data?.items ?? [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 bg-white rounded-xl border border-gray-200 p-1.5 shadow-sm">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setStatus(tab.key); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors
              ${status === tab.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 flex-wrap items-center">
        <Select value={priority} onChange={e => { setPriority(e.target.value); setPage(1); }} className="w-40">
          <option value="">Mọi ưu tiên</option>
          {Object.entries(WO_PRIORITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <div className="flex-1" />
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={15} /> Tạo phiếu việc
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading
          ? <PageLoader />
          : orders.length === 0
            ? <EmptyState title="Không có phiếu việc" />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-300">
                    <tr>
                      {['Mã WO', 'Tài sản', 'Vị trí', 'Ngày dự kiến', 'Ưu tiên', 'Nguồn', 'Trạng thái', ''].map(h => (
                        <th key={h} className="text-left text-xs font-bold text-gray-700 uppercase tracking-wide px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.map(wo => (
                      <tr key={wo.woId} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <Link to={`/work-orders/${wo.woId}`} className="font-mono text-sm font-bold text-blue-700 hover:underline">
                            WO-{String(wo.woId).padStart(4, '0')}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900 max-w-[160px] truncate">{wo.assetName}</td>
                        <td className="px-4 py-3 font-medium text-gray-700 max-w-[120px] truncate">{wo.locationName}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{fDate(wo.plannedDate)}</td>
                        <td className="px-4 py-3"><Badge color={WO_PRIORITY_COLOR[wo.priority]}>{WO_PRIORITY_LABEL[wo.priority] ?? wo.priority}</Badge></td>
                        <td className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">{wo.woSource}</td>
                        <td className="px-4 py-3"><Badge color={WO_STATUS_COLOR[wo.status]}>{WO_STATUS_LABEL[wo.status] ?? wo.status}</Badge></td>
                        <td className="px-4 py-3">
                          <Link to={`/work-orders/${wo.woId}`} className="text-sm font-semibold text-blue-600 hover:underline">Chi tiết →</Link>
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo phiếu việc mới" size="lg">
        <WorkOrderForm
          assets={assets}
          onSuccess={() => { setCreateOpen(false); load(); toast.success('Đã tạo phiếu việc'); }}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>
    </div>
  );
}
