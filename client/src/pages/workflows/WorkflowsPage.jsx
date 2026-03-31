/**
 * WorkflowsPage.jsx — Quản lý mẫu luồng phê duyệt (WorkflowTemplates).
 * BFD 4.1: Admin C/U mẫu luồng; NV vận hành khởi tạo phiếu qua trang Lịch/WO/Tài liệu.
 * Liên quan: api/workflow.api.js, utils/rbac.js (route workflows, WORKFLOW:*).
 */
import { useEffect, useState, useCallback } from 'react';
import { GitBranch, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { workflowApi } from '../../api/workflow.api.js';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input, Textarea } from '../../components/ui/Input.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { canDo } from '../../utils/rbac.js';
import toast from 'react-hot-toast';

const DOC_LABEL = {
  WORK_ORDER: 'Work Order',
  DIGITAL_ASSET: 'Tài liệu số',
  MAINTENANCE_PLAN: 'Kế hoạch bảo trì',
};

export function WorkflowsPage() {
  const { user } = useAuth();
  const canEdit = canDo(user, 'WORKFLOW:UPDATE');
  const canCreate = canDo(user, 'WORKFLOW:CREATE');
  const canDelete = canDo(user, 'WORKFLOW:DELETE');

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ workflowName: '', description: '' });
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workflowApi.getAll();
      setList(res.data.data ?? []);
    } catch {
      toast.error('Không tải được danh sách workflow');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const openDetail = async (wf) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await workflowApi.getById(wf.workflowId);
      setDetail(res.data.data);
    } catch {
      toast.error('Không tải chi tiết workflow');
    } finally {
      setDetailLoading(false);
    }
  };

  const openEdit = () => {
    if (!detail) return;
    setForm({
      workflowName: detail.workflowName ?? '',
      description: detail.description ?? '',
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!detail) return;
    setSaving(true);
    try {
      await workflowApi.update(detail.workflowId, {
        workflowName: form.workflowName.trim(),
        description: form.description.trim() || null,
      });
      toast.success('Đã cập nhật mẫu luồng');
      setEditOpen(false);
      await loadList();
      await openDetail({ workflowId: detail.workflowId });
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Lỗi cập nhật');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!detail || !canDelete) return;
    if (!window.confirm(`Xóa workflow "${detail.workflowName}"? Có thể lỗi nếu đang được dùng trong ApprovalLogs.`)) return;
    try {
      await workflowApi.remove(detail.workflowId);
      toast.success('Đã xóa workflow');
      setDetail(null);
      loadList();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Không xóa được (có thể đang tham chiếu)');
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <GitBranch size={20} className="text-blue-600" />
            Mẫu luồng phê duyệt
          </h2>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Cấu hình tên/mô tả mẫu (BFD 4.1 — Admin). Bước duyệt gắn chức vụ trong DB; chỉnh sửa bước nâng cao qua API hoặc SQL khi cần.
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={loadList}>
          <RefreshCw size={14} /> Tải lại
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Danh sách</p>
          </div>
          <ul className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
            {list.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-gray-400">Chưa có mẫu workflow</li>
            ) : (
              list.map((w) => (
                <li key={w.workflowId}>
                  <button
                    type="button"
                    onClick={() => openDetail(w)}
                    className={`w-full text-left px-4 py-3 hover:bg-blue-50/50 transition-colors ${
                      detail?.workflowId === w.workflowId ? 'bg-blue-50' : ''
                    }`}
                  >
                    <p className="font-semibold text-gray-900 text-sm">{w.workflowName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {DOC_LABEL[w.documentType] ?? w.documentType} · {w.totalLevels} cấp
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm min-h-[200px]">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Chi tiết</p>
            {detail && (canEdit || canDelete) && (
              <div className="flex gap-1">
                {canEdit && (
                  <button type="button" onClick={openEdit} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600" title="Sửa">
                    <Pencil size={14} />
                  </button>
                )}
                {canDelete && (
                  <button type="button" onClick={handleDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Xóa">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="p-4">
            {detailLoading && <p className="text-sm text-gray-400 text-center py-10">Đang tải...</p>}
            {!detailLoading && !detail && (
              <p className="text-sm text-gray-400 text-center py-10">Chọn một mẫu bên trái</p>
            )}
            {detail && !detailLoading && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500">Tên</p>
                  <p className="font-bold text-gray-900">{detail.workflowName}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500">Loại tài liệu</p>
                  <Badge color="blue">{DOC_LABEL[detail.documentType] ?? detail.documentType}</Badge>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500">Mô tả</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{detail.description || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Bước duyệt</p>
                  <div className="space-y-2">
                    {(detail.steps ?? []).length === 0 ? (
                      <p className="text-sm text-amber-600">Chưa có bước (kiểm tra WorkflowSteps)</p>
                    ) : (
                      detail.steps.map((s) => (
                        <div key={s.stepId} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                          <span className="font-mono text-xs text-gray-400">#{s.stepLevel}</span>
                          <span className="font-medium text-gray-800">{s.positionName}</span>
                          <span className="text-xs text-gray-500">(Level {s.positionLevel})</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!canCreate && (
        <p className="text-xs text-gray-400">Tạo mẫu workflow mới: dùng API POST /workflows hoặc seed/migration khi triển khai.</p>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Sửa mẫu luồng" size="md">
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Input
            label="Tên workflow"
            value={form.workflowName}
            onChange={(e) => setForm((p) => ({ ...p, workflowName: e.target.value }))}
            required
          />
          <Textarea
            label="Mô tả"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>Hủy</Button>
            <Button type="submit" loading={saving}>Lưu</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
