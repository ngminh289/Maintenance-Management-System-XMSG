/**
 * WorkflowsPage.jsx — Mẫu luồng phê duyệt (Admin).
 *
 * Chức năng sửa mở rộng:
 *   - Sửa Tên + Mô tả: luôn được phép.
 *   - Sửa Loại tài liệu + Bước duyệt (thêm/sửa/xoá): chỉ khi mẫu CHƯA có ApprovalLogs
 *     sử dụng (BE trả `usageCount` / `isUsed`). Nếu đã dùng → khoá UI + hiển thị cảnh báo.
 *   - Tạo mẫu mới: nút "+ Thêm mẫu" mở modal Create.
 * Liên quan: api/workflow.api.js, server services/workflow.service.js (lock logic).
 */
import { useEffect, useState, useCallback } from 'react';
import {
  GitBranch,
  Pencil,
  Trash2,
  RefreshCw,
  Plus,
  AlertTriangle,
  ListChecks,
} from 'lucide-react';
import { workflowApi } from '../../api/workflow.api.js';
import { api } from '../../api/index.js';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { canDo } from '../../utils/rbac.js';
import toast from 'react-hot-toast';

const DOC_TYPES = [
  { value: 'DIGITAL_ASSET', label: 'Tài liệu số' },
  { value: 'WORK_ORDER', label: 'Work Order' },
  { value: 'MAINTENANCE_PLAN', label: 'Kế hoạch bảo trì' },
];
const DOC_LABEL = Object.fromEntries(DOC_TYPES.map((t) => [t.value, t.label]));

export function WorkflowsPage() {
  const { user } = useAuth();
  const canEdit = canDo(user, 'WORKFLOW:UPDATE');
  const canCreate = canDo(user, 'WORKFLOW:CREATE');
  const canDelete = canDo(user, 'WORKFLOW:DELETE');

  const [list, setList] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modal sửa metadata (tên / mô tả / loại tài liệu).
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ workflowName: '', description: '', documentType: '' });
  const [saving, setSaving] = useState(false);

  // Modal tạo mẫu mới.
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    workflowName: '',
    description: '',
    documentType: DOC_TYPES[0].value,
    totalLevels: 1,
  });
  const [creating, setCreating] = useState(false);

  // Form thêm bước duyệt.
  const [newStep, setNewStep] = useState({ stepLevel: '', positionId: '' });
  const [addingStep, setAddingStep] = useState(false);

  // Sửa bước inline.
  const [editStepId, setEditStepId] = useState(null);
  const [editStepForm, setEditStepForm] = useState({ stepLevel: '', positionId: '' });
  const [savingStep, setSavingStep] = useState(false);

  // Confirm xoá.
  const [deleteWfConfirm, setDeleteWfConfirm] = useState(false);
  const [deleteStepTarget, setDeleteStepTarget] = useState(null);
  const [deletingStep, setDeletingStep] = useState(false);

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

  useEffect(() => {
    api.get('/positions')
      .then((r) => setPositions(Array.isArray(r.data.data) ? r.data.data : []))
      .catch(() => setPositions([]));
  }, []);

  const refreshDetail = useCallback(async (workflowId) => {
    if (!workflowId) return;
    setDetailLoading(true);
    try {
      const res = await workflowApi.getById(workflowId);
      setDetail(res.data.data);
    } catch {
      toast.error('Không tải chi tiết workflow');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openDetail = async (wf) => {
    setDetail({ workflowId: wf.workflowId });
    setEditStepId(null);
    setNewStep({ stepLevel: '', positionId: '' });
    await refreshDetail(wf.workflowId);
  };

  const openEdit = () => {
    if (!detail) return;
    setEditForm({
      workflowName: detail.workflowName ?? '',
      description: detail.description ?? '',
      documentType: detail.documentType ?? '',
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!detail) return;
    setSaving(true);
    try {
      await workflowApi.update(detail.workflowId, {
        workflowName: editForm.workflowName.trim(),
        description: editForm.description.trim() || null,
        // Chỉ gửi documentType khi user thật sự đổi (để BE không kiểm tra
        // khoá usage không cần thiết).
        ...(editForm.documentType && editForm.documentType !== detail.documentType
          ? { documentType: editForm.documentType }
          : {}),
      });
      toast.success('Đã cập nhật mẫu luồng');
      setEditOpen(false);
      await loadList();
      await refreshDetail(detail.workflowId);
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Lỗi cập nhật');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await workflowApi.create({
        workflowName: createForm.workflowName.trim(),
        description: createForm.description.trim() || null,
        documentType: createForm.documentType,
        totalLevels: Number(createForm.totalLevels) || 1,
      });
      toast.success('Đã tạo mẫu luồng');
      const newId = res.data.data?.workflowId;
      setCreateOpen(false);
      setCreateForm({
        workflowName: '',
        description: '',
        documentType: DOC_TYPES[0].value,
        totalLevels: 1,
      });
      await loadList();
      if (newId) await openDetail({ workflowId: newId });
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Không tạo được mẫu');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteWorkflow = async () => {
    if (!detail) return;
    try {
      await workflowApi.remove(detail.workflowId);
      toast.success('Đã xóa workflow');
      setDeleteWfConfirm(false);
      setDetail(null);
      loadList();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Không xóa được mẫu');
    }
  };

  const handleAddStep = async (e) => {
    e.preventDefault();
    if (!detail) return;
    setAddingStep(true);
    try {
      await workflowApi.addStep(detail.workflowId, {
        stepLevel: Number(newStep.stepLevel),
        positionId: Number(newStep.positionId),
      });
      toast.success('Đã thêm bước duyệt');
      setNewStep({ stepLevel: '', positionId: '' });
      await refreshDetail(detail.workflowId);
      await loadList();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Không thêm được bước');
    } finally {
      setAddingStep(false);
    }
  };

  const startEditStep = (step) => {
    setEditStepId(step.stepId);
    setEditStepForm({
      stepLevel: String(step.stepLevel),
      positionId: String(step.positionId),
    });
  };

  const handleSaveStep = async (stepId) => {
    if (!detail) return;
    setSavingStep(true);
    try {
      await workflowApi.updateStep(detail.workflowId, stepId, {
        stepLevel: Number(editStepForm.stepLevel),
        positionId: Number(editStepForm.positionId),
      });
      toast.success('Đã cập nhật bước');
      setEditStepId(null);
      await refreshDetail(detail.workflowId);
      await loadList();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Không cập nhật được bước');
    } finally {
      setSavingStep(false);
    }
  };

  const handleDeleteStep = async () => {
    if (!detail || !deleteStepTarget) return;
    setDeletingStep(true);
    try {
      await workflowApi.removeStep(detail.workflowId, deleteStepTarget.stepId);
      toast.success('Đã xoá bước');
      setDeleteStepTarget(null);
      await refreshDetail(detail.workflowId);
      await loadList();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Không xoá được bước');
    } finally {
      setDeletingStep(false);
    }
  };

  if (loading) return <PageLoader />;

  const isUsed = !!detail?.isUsed;
  const canEditStructural = canEdit && !isUsed;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <GitBranch size={20} className="text-blue-600" />
            Mẫu luồng phê duyệt
          </h2>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Quản trị mẫu luồng phê duyệt — sửa tên/mô tả; cấu trúc bước duyệt chỉ
            sửa được khi mẫu chưa phát sinh đơn duyệt nào.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={loadList}>
            <RefreshCw size={14} /> Tải lại
          </Button>
          {canCreate && (
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> Thêm mẫu
            </Button>
          )}
        </div>
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
            {detail && !detailLoading && (canEdit || canDelete) && (
              <div className="flex gap-1">
                {canEdit && (
                  <button
                    type="button"
                    onClick={openEdit}
                    className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600"
                    title="Sửa tên / mô tả / loại tài liệu"
                  >
                    <Pencil size={14} />
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setDeleteWfConfirm(true)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-40 disabled:hover:bg-transparent"
                    disabled={isUsed}
                    title={isUsed ? 'Mẫu đã có đơn duyệt sử dụng — không thể xoá' : 'Xoá mẫu'}
                  >
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
                {isUsed && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                    <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Mẫu đã có <strong>{detail.usageCount}</strong> đơn duyệt sử dụng — chỉ sửa
                      được tên & mô tả. Để đổi cấu trúc, hãy tạo mẫu mới.
                    </p>
                  </div>
                )}

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
                  <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                    <ListChecks size={13} /> Bước duyệt
                  </p>
                  <div className="space-y-2">
                    {(detail.steps ?? []).length === 0 ? (
                      <p className="text-sm text-amber-600">Chưa có bước duyệt — thêm ít nhất 1 bước.</p>
                    ) : (
                      detail.steps.map((s) => {
                        const isEditingThis = editStepId === s.stepId;
                        return (
                          <div
                            key={s.stepId}
                            className="rounded-lg bg-gray-50 px-3 py-2 flex items-center gap-2 text-sm"
                          >
                            {isEditingThis ? (
                              <>
                                <Input
                                  type="number"
                                  min="1"
                                  value={editStepForm.stepLevel}
                                  onChange={(e) =>
                                    setEditStepForm((p) => ({ ...p, stepLevel: e.target.value }))
                                  }
                                  className="w-20"
                                />
                                <Select
                                  value={editStepForm.positionId}
                                  onChange={(e) =>
                                    setEditStepForm((p) => ({ ...p, positionId: e.target.value }))
                                  }
                                  className="flex-1"
                                >
                                  <option value="">— Chọn chức vụ —</option>
                                  {positions.map((p) => (
                                    <option key={p.positionId} value={p.positionId}>
                                      {p.positionName} (Level {p.level})
                                    </option>
                                  ))}
                                </Select>
                                <Button
                                  type="button"
                                  size="sm"
                                  loading={savingStep}
                                  onClick={() => handleSaveStep(s.stepId)}
                                  disabled={!editStepForm.stepLevel || !editStepForm.positionId}
                                >
                                  Lưu
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setEditStepId(null)}
                                >
                                  Huỷ
                                </Button>
                              </>
                            ) : (
                              <>
                                <span className="font-mono text-xs text-gray-500 w-8 shrink-0">
                                  #{s.stepLevel}
                                </span>
                                <span className="font-medium text-gray-800 flex-1">
                                  {s.positionName}
                                </span>
                                <span className="text-xs text-gray-500">Level {s.positionLevel}</span>
                                {canEditStructural && (
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      className="p-1 rounded hover:bg-gray-200 text-gray-600"
                                      title="Sửa bước"
                                      onClick={() => startEditStep(s)}
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      className="p-1 rounded hover:bg-red-50 text-red-500"
                                      title="Xoá bước"
                                      onClick={() => setDeleteStepTarget(s)}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {canEditStructural && (
                    <form
                      onSubmit={handleAddStep}
                      className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-gray-300 p-3"
                    >
                      <Input
                        label="Cấp"
                        type="number"
                        min="1"
                        value={newStep.stepLevel}
                        onChange={(e) => setNewStep((p) => ({ ...p, stepLevel: e.target.value }))}
                        className="w-24"
                        placeholder={String(((detail.steps ?? []).length || 0) + 1)}
                      />
                      <div className="flex-1 min-w-[200px]">
                        <Select
                          label="Chức vụ duyệt"
                          value={newStep.positionId}
                          onChange={(e) =>
                            setNewStep((p) => ({ ...p, positionId: e.target.value }))
                          }
                        >
                          <option value="">— Chọn chức vụ —</option>
                          {positions.map((p) => (
                            <option key={p.positionId} value={p.positionId}>
                              {p.positionName} (Level {p.level})
                            </option>
                          ))}
                        </Select>
                      </div>
                      <Button
                        type="submit"
                        size="sm"
                        loading={addingStep}
                        disabled={!newStep.stepLevel || !newStep.positionId}
                      >
                        <Plus size={13} /> Thêm bước
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal sửa metadata */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Sửa mẫu luồng" size="md">
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Input
            label="Tên workflow"
            value={editForm.workflowName}
            onChange={(e) => setEditForm((p) => ({ ...p, workflowName: e.target.value }))}
            required
          />
          <Select
            label="Loại tài liệu"
            value={editForm.documentType}
            onChange={(e) => setEditForm((p) => ({ ...p, documentType: e.target.value }))}
            disabled={isUsed}
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
          {isUsed && (
            <p className="text-xs text-amber-700">
              Mẫu đã có đơn duyệt sử dụng — không đổi được loại tài liệu.
            </p>
          )}
          <Textarea
            label="Mô tả"
            value={editForm.description}
            onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>Hủy</Button>
            <Button type="submit" loading={saving}>Lưu</Button>
          </div>
        </form>
      </Modal>

      {/* Modal tạo mẫu mới */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Thêm mẫu luồng" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Tên workflow"
            value={createForm.workflowName}
            onChange={(e) => setCreateForm((p) => ({ ...p, workflowName: e.target.value }))}
            placeholder="VD: Phê duyệt Tài liệu mở rộng"
            required
          />
          <Select
            label="Loại tài liệu"
            value={createForm.documentType}
            onChange={(e) => setCreateForm((p) => ({ ...p, documentType: e.target.value }))}
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
          <Input
            label="Tổng số cấp duyệt"
            type="number"
            min="1"
            value={createForm.totalLevels}
            onChange={(e) => setCreateForm((p) => ({ ...p, totalLevels: e.target.value }))}
          />
          <Textarea
            label="Mô tả"
            value={createForm.description}
            onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
            rows={3}
          />
          <p className="text-xs text-gray-500">
            Sau khi tạo, bạn sẽ chuyển sang chi tiết để thêm các bước duyệt cụ thể.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button type="submit" loading={creating}>Tạo</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteWfConfirm}
        title="Xoá mẫu luồng"
        message={
          detail
            ? `Xoá mẫu "${detail.workflowName}"? Mẫu phải chưa được dùng trong bất kỳ đơn duyệt nào.`
            : ''
        }
        confirmLabel="Xoá"
        cancelLabel="Huỷ"
        variant="danger"
        onConfirm={handleDeleteWorkflow}
        onCancel={() => setDeleteWfConfirm(false)}
      />

      <ConfirmDialog
        open={!!deleteStepTarget}
        title="Xoá bước duyệt"
        message={
          deleteStepTarget
            ? `Xoá bước #${deleteStepTarget.stepLevel} (${deleteStepTarget.positionName})?`
            : ''
        }
        confirmLabel="Xoá"
        cancelLabel="Huỷ"
        variant="danger"
        loading={deletingStep}
        onConfirm={handleDeleteStep}
        onCancel={() => setDeleteStepTarget(null)}
      />
    </div>
  );
}
