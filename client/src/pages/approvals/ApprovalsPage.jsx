/**
 * ApprovalsPage.jsx — Danh sách yêu cầu phê duyệt đang chờ của người dùng hiện tại.
 * luongpheduyet.rule: PENDING_APPROVAL → WAITING → IN_PROGRESS → COMPLETED/CANCELLED.
 * Hiển thị context đầy đủ: loại tài nguyên, mô tả, tên tài sản, người gửi, cấp duyệt.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck, CheckCircle, XCircle, RefreshCw,
  Wrench, FileText, Calendar, ChevronRight,
} from 'lucide-react';
import { approvalApi } from '../../api/approval.api.js';
import { Badge }       from '../../components/ui/Badge.jsx';
import { Button }      from '../../components/ui/Button.jsx';
import { Modal }       from '../../components/ui/Modal.jsx';
import { Select, Textarea } from '../../components/ui/Input.jsx';
import { EmptyState }  from '../../components/ui/EmptyState.jsx';
import { PageLoader }  from '../../components/ui/Spinner.jsx';
import { fDateTime }   from '../../utils/format.js';
import toast from 'react-hot-toast';

const RESOURCE_CONFIG = {
  WORK_ORDER:       { label: 'Phiếu việc',       icon: Wrench,    color: 'blue'   },
  DIGITAL_ASSET:    { label: 'Tài liệu số',       icon: FileText,  color: 'purple' },
  MAINTENANCE_PLAN: { label: 'Kế hoạch bảo trì', icon: Calendar,  color: 'green'  },
};

const ACTION_LABEL = {
  APPROVED:        'Duyệt',
  REJECTED:        'Từ chối',
  REQUEST_CHANGES: 'Yêu cầu chỉnh sửa',
};

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
    if ((action === 'REJECTED' || action === 'REQUEST_CHANGES') && !comment.trim()) {
      toast.error('Vui lòng nhập lý do khi từ chối hoặc yêu cầu chỉnh sửa'); return;
    }
    setSaving(true);
    try {
      await approvalApi.action(selected.logId, { action, comment });
      toast.success(
        action === 'APPROVED'        ? 'Đã phê duyệt!'
        : action === 'REJECTED'      ? 'Đã từ chối'
        : 'Đã gửi yêu cầu chỉnh sửa'
      );
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
        <p className="text-sm font-semibold text-gray-700">
          {items.length} yêu cầu đang chờ phê duyệt
        </p>
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
              {items.map(item => {
                const cfg  = RESOURCE_CONFIG[item.resourceType] ?? { label: item.resourceType, icon: ShieldCheck, color: 'gray' };
                const Icon = cfg.icon;
                return (
                  <div key={item.logId} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                    {/* Icon loại tài nguyên */}
                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                      cfg.color === 'blue'   ? 'bg-blue-50'   :
                      cfg.color === 'purple' ? 'bg-purple-50' :
                      cfg.color === 'green'  ? 'bg-green-50'  : 'bg-gray-50'
                    }`}>
                      <Icon size={18} className={
                        cfg.color === 'blue'   ? 'text-blue-600'   :
                        cfg.color === 'purple' ? 'text-purple-600' :
                        cfg.color === 'green'  ? 'text-green-600'  : 'text-gray-500'
                      } />
                    </div>

                    {/* Nội dung chính */}
                    <div className="flex-1 min-w-0">
                      {/* Dòng 1: Badge loại + Badge cấp duyệt */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <Badge color={cfg.color}>{cfg.label}</Badge>
                        <Badge color="yellow">Cấp {item.currentLevel}/{item.totalLevels}</Badge>
                        <span className="font-mono text-xs font-bold text-gray-500">#{item.resourceId}</span>
                      </div>

                      {/* Dòng 2: Mô tả tài nguyên */}
                      {item.resourceDescription && (
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {item.resourceDescription}
                        </p>
                      )}

                      {/* Dòng 3: Tên tài sản + người gửi + thời gian */}
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                        {item.resourceAssetName && (
                          <span className="text-xs text-gray-600 font-medium">
                            Tài sản: <strong>{item.resourceAssetName}</strong>
                          </span>
                        )}
                        {item.submitterName && (
                          <span className="text-xs text-gray-500">
                            Người gửi: <strong>{item.submitterName}</strong>
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{fDateTime(item.actionDate)}</span>
                      </div>
                    </div>

                    {/* Nút xử lý */}
                    <Button
                      size="sm" variant="secondary"
                      onClick={() => { setSelected(item); setAction('APPROVED'); setComment(''); }}
                      className="flex-shrink-0"
                    >
                      Xử lý <ChevronRight size={12} />
                    </Button>
                  </div>
                );
              })}
            </div>
          )
      }

      {/* Modal xử lý phê duyệt */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Xử lý phê duyệt" size="sm">
        {selected && (
          <div className="space-y-4">
            {/* Thông tin tài nguyên */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Loại</span>
                <strong className="text-gray-900">{RESOURCE_CONFIG[selected.resourceType]?.label ?? selected.resourceType}</strong>
              </div>
              {selected.resourceDescription && (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">Mô tả</span>
                  <strong className="text-gray-900 text-right text-xs leading-relaxed">{selected.resourceDescription}</strong>
                </div>
              )}
              {selected.resourceAssetName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Tài sản</span>
                  <strong className="text-gray-900">{selected.resourceAssetName}</strong>
                </div>
              )}
              {selected.submitterName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Người gửi</span>
                  <strong className="text-gray-900">{selected.submitterName}</strong>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Cấp duyệt</span>
                <strong className="text-gray-900">{selected.currentLevel} / {selected.totalLevels}</strong>
              </div>
            </div>

            <Select label="Hành động" value={action} onChange={e => setAction(e.target.value)}>
              <option value="APPROVED">✓  Duyệt</option>
              <option value="REJECTED">✗  Từ chối</option>
              <option value="REQUEST_CHANGES">↩  Yêu cầu chỉnh sửa</option>
            </Select>

            <Textarea
              label={`Ghi chú${action !== 'APPROVED' ? ' *' : ''}`}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={
                action === 'APPROVED'
                  ? 'Ghi chú khi duyệt (tuỳ chọn)'
                  : action === 'REJECTED'
                  ? 'Lý do từ chối (bắt buộc)'
                  : 'Nội dung cần chỉnh sửa (bắt buộc)'
              }
              rows={3}
            />

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setSelected(null)}>Hủy</Button>
              <Button
                variant={action === 'APPROVED' ? 'success' : action === 'REJECTED' ? 'danger' : 'primary'}
                onClick={handleAction}
                loading={saving}
              >
                {action === 'APPROVED'
                  ? <><CheckCircle size={14} /> Duyệt</>
                  : action === 'REJECTED'
                  ? <><XCircle size={14} /> Từ chối</>
                  : <><RefreshCw size={14} /> Yêu cầu sửa</>
                }
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
