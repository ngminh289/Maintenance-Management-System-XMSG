/**
 * ApprovalsPage.jsx — Danh sách yêu cầu phê duyệt đang chờ của người dùng hiện tại.
 * luongpheduyet.rule: "SELECT * FROM ApprovalLogs WHERE Status = 'PENDING'".
 */
import { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { approvalApi } from '../../api/approval.api.js';
import { Badge }       from '../../components/ui/Badge.jsx';
import { Button }      from '../../components/ui/Button.jsx';
import { Modal }       from '../../components/ui/Modal.jsx';
import { Select, Textarea } from '../../components/ui/Input.jsx';
import { EmptyState }  from '../../components/ui/EmptyState.jsx';
import { PageLoader }  from '../../components/ui/Spinner.jsx';
import { fDateTime }   from '../../utils/format.js';
import toast from 'react-hot-toast';

const RESOURCE_TYPE_LABEL = { WORK_ORDER: 'Phiếu việc', DIGITAL_ASSET: 'Tài liệu số', MAINTENANCE_PLAN: 'Kế hoạch bảo trì' };

export function ApprovalsPage() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [action,   setAction]   = useState('APPROVED');
  const [comment,  setComment]  = useState('');
  const [saving,   setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await approvalApi.getPending();
      setItems(res.data.data?.items ?? res.data.data ?? []);
    } catch { toast.error('Lỗi tải danh sách phê duyệt'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await approvalApi.action(selected.logId, { action, comment });
      toast.success(action === 'APPROVED' ? 'Đã phê duyệt!' : action === 'REJECTED' ? 'Đã từ chối' : 'Đã gửi yêu cầu chỉnh sửa');
      setSelected(null);
      setComment('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Lỗi xử lý');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{items.length} yêu cầu đang chờ phê duyệt</p>
        <Button variant="secondary" size="sm" onClick={load}>
          <RefreshCw size={13} /> Làm mới
        </Button>
      </div>

      {loading
        ? <PageLoader />
        : items.length === 0
          ? <EmptyState icon={ShieldCheck} title="Không có yêu cầu phê duyệt" description="Tất cả đã được xử lý" />
          : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
              {items.map(item => (
                <div key={item.logId} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="p-2.5 bg-yellow-50 rounded-xl flex-shrink-0">
                    <ShieldCheck size={18} className="text-yellow-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge color="yellow">{RESOURCE_TYPE_LABEL[item.resourceType] ?? item.resourceType}</Badge>
                      <Badge color="blue">Cấp {item.currentLevel}</Badge>
                      <span className="font-mono text-xs text-gray-500">ID: {item.resourceId}</span>
                    </div>
                    <p className="text-xs font-medium text-gray-500 mt-1">{fDateTime(item.actionDate)}</p>
                    {item.description && <p className="text-sm font-medium text-gray-800 mt-1.5">{item.description}</p>}
                  </div>
                  <Button
                    size="sm" variant="secondary"
                    onClick={() => { setSelected(item); setAction('APPROVED'); setComment(''); }}
                  >
                    Xử lý
                  </Button>
                </div>
              ))}
            </div>
          )
      }

      {/* Action modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Xử lý phê duyệt" size="sm">
        {selected && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
              <p><span className="text-gray-500">Loại:</span> <strong>{RESOURCE_TYPE_LABEL[selected.resourceType]}</strong></p>
              <p><span className="text-gray-500">ID tài nguyên:</span> <strong>{selected.resourceId}</strong></p>
              <p><span className="text-gray-500">Cấp phê duyệt:</span> <strong>{selected.currentLevel}</strong></p>
            </div>
            <Select label="Hành động" value={action} onChange={e => setAction(e.target.value)}>
              <option value="APPROVED">Duyệt</option>
              <option value="REJECTED">Từ chối</option>
              <option value="REQUEST_CHANGES">Yêu cầu chỉnh sửa</option>
            </Select>
            <Textarea
              label="Ghi chú / Lý do"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Nhập lý do (bắt buộc khi từ chối)"
            />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setSelected(null)}>Hủy</Button>
              <Button
                variant={action === 'APPROVED' ? 'success' : action === 'REJECTED' ? 'danger' : 'primary'}
                onClick={handleAction} loading={saving}
              >
                {action === 'APPROVED' ? <><CheckCircle size={14} /> Duyệt</> : action === 'REJECTED' ? <><XCircle size={14} /> Từ chối</> : <><RefreshCw size={14} /> Yêu cầu sửa</>}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
