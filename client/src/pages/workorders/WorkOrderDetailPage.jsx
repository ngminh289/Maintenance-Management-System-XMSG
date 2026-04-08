/**
 * WorkOrderDetailPage.jsx — Chi tiết WO: phân công, thực hiện, ảnh hiện trường, báo hoàn thành → chờ nghiệm thu → TC/TP đóng phiếu.
 * Thợ (được giao): nhận việc, tạm dừng/tiếp tục, upload nhiều ảnh, báo hoàn thành (AWAITING_CLOSURE).
 * Trưởng ca / Trưởng phòng: nghiệm thu đóng (COMPLETED), hoặc trả về làm tiếp (IN_PROGRESS).
 */
import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, UserPlus, CheckCircle, Play, Pause, Info, Camera, Trash2, ExternalLink,
} from 'lucide-react';
import { workOrderApi } from '../../api/workOrder.api.js';
import { employeeApi }  from '../../api/employee.api.js';
import { approvalApi }  from '../../api/approval.api.js';
import { Badge }        from '../../components/ui/Badge.jsx';
import { Button }       from '../../components/ui/Button.jsx';
import { Card }         from '../../components/ui/Card.jsx';
import { Modal }        from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import { PageLoader }   from '../../components/ui/Spinner.jsx';
import {
  WO_STATUS_LABEL, WO_STATUS_COLOR, WO_PRIORITY_LABEL, WO_PRIORITY_COLOR,
  fDate, fDateTime,
} from '../../utils/format.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { canDo, LEVEL_TRUONG_CA } from '../../utils/rbac.js';
import toast from 'react-hot-toast';

const ASSIGNEE_MAX_LEVEL = 2;

const API_ORIGIN = (import.meta.env.VITE_API_BASE || 'http://localhost:4000/api').replace(/\/?api\/?$/, '');

function woPhotoSrc(filePath) {
  if (!filePath) return '';
  const p = String(filePath).replace(/^\/+/, '');
  return `${API_ORIGIN.replace(/\/$/, '')}/${p}`;
}

export function WorkOrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [wo,        setWo]        = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [assignOpen,   setAssignOpen]   = useState(false);
  const [approveOpen,  setApproveOpen]  = useState(false);
  const [selectedEmp,  setSelectedEmp]  = useState('');
  const [approveAction, setApproveAction] = useState('APPROVED');
  const [comment,   setComment]   = useState('');
  const [saving,    setSaving]    = useState(false);
  const [awaitingOpen, setAwaitingOpen] = useState(false);
  const [awaitingHours, setAwaitingHours] = useState('');
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeHours, setCloseHours] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);

  const load = async () => {
    try {
      const [wr, ar] = await Promise.all([
        workOrderApi.getById(id),
        approvalApi.getHistory(id, 'WORK_ORDER').catch(() => ({ data: { data: [] } })),
      ]);
      setWo(wr.data.data);
      setApprovals(ar.data.data ?? []);
    } catch { toast.error('Không tải được phiếu việc'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    employeeApi.getAll({ limit: 200 })
      .then((r) => {
        const items = r.data.data?.items ?? [];
        setEmployees(
          items.filter(
            (e) => e.isActive !== false && (e.positionLevel ?? 99) <= ASSIGNEE_MAX_LEVEL,
          ),
        );
      })
      .catch(() => {});
  }, [id]);

  const changeStatus = async (status) => {
    if (!confirm(`Chuyển sang «${WO_STATUS_LABEL[status] ?? status}»?`)) return;
    try {
      await workOrderApi.changeStatus(id, status);
      toast.success('Đã cập nhật');
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi'); }
  };

  const submitAwaitingClosure = async () => {
    const raw = awaitingHours.trim();
    let actualHours;
    if (raw !== '') {
      const n = Number(raw.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) {
        toast.error('Giờ thực tế không hợp lệ');
        return;
      }
      actualHours = n;
    }
    setSaving(true);
    try {
      await workOrderApi.changeStatus(id, 'AWAITING_CLOSURE', raw === '' ? {} : { actualHours });
      toast.success('Đã gửi chờ nghiệm thu');
      setAwaitingOpen(false);
      setAwaitingHours('');
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi'); }
    finally { setSaving(false); }
  };

  const submitCloseWorkOrder = async () => {
    const raw = closeHours.trim();
    let actualHours;
    if (raw !== '') {
      const n = Number(raw.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) {
        toast.error('Giờ thực tế không hợp lệ');
        return;
      }
      actualHours = n;
    }
    setSaving(true);
    try {
      await workOrderApi.changeStatus(id, 'COMPLETED', raw === '' ? {} : { actualHours });
      toast.success('Đã đóng phiếu');
      setCloseOpen(false);
      setCloseHours('');
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi'); }
    finally { setSaving(false); }
  };

  const onPickPhotos = async (e) => {
    const files = e.target?.files;
    if (!files?.length) return;
    const fd = new FormData();
    for (let i = 0; i < files.length; i += 1) fd.append('photos', files[i]);
    setPhotoBusy(true);
    try {
      await workOrderApi.uploadPhotos(id, fd);
      toast.success(`Đã tải ${files.length} ảnh`);
      e.target.value = '';
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi upload'); }
    finally { setPhotoBusy(false); }
  };

  const removePhoto = async (photoId) => {
    if (!confirm('Xóa ảnh này?')) return;
    try {
      await workOrderApi.deletePhoto(id, photoId);
      toast.success('Đã xóa');
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi'); }
  };

  const handleAssign = async () => {
    if (!selectedEmp) return;
    setSaving(true);
    try {
      await workOrderApi.assign(id, Number(selectedEmp));
      toast.success('Đã phân công');
      setAssignOpen(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi phân công'); }
    finally { setSaving(false); }
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      const pendingLog = approvals.find(a => a.status === 'PENDING');
      if (!pendingLog) { toast.error('Không có yêu cầu duyệt nào đang chờ'); return; }
      await approvalApi.action(pendingLog.logId, { action: approveAction, comment });
      toast.success('Đã xử lý phê duyệt');
      setApproveOpen(false);
      setComment('');
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi phê duyệt'); }
    finally { setSaving(false); }
  };

  if (loading) return <PageLoader />;
  if (!wo)     return <div className="text-center py-20 text-gray-400">Không tìm thấy phiếu việc</div>;

  const isAssigned = wo.assignments?.some(
    (a) => Number(a.employeeId) === Number(user?.employeeId),
  );
  const isTcPlus = (user?.positionLevel ?? 0) >= LEVEL_TRUONG_CA;
  const canUpdate = canDo(user, 'WORK_ORDER:UPDATE');
  const canAcceptWork = canUpdate && isAssigned;
  const canSuperviseFlow = canUpdate && (isAssigned || isTcPlus);
  const canReportAwaiting = canUpdate && isAssigned && wo.status === 'IN_PROGRESS';
  const canUploadPhotos = canUpdate && (isAssigned || isTcPlus)
    && ['IN_PROGRESS', 'AWAITING_CLOSURE'].includes(wo.status);
  const canCloseAfterReview = canUpdate && isTcPlus && wo.status === 'AWAITING_CLOSURE';
  const canReopenFromAwaiting = canUpdate && isTcPlus && wo.status === 'AWAITING_CLOSURE';
  const canApprove =
    wo.status === 'PENDING_APPROVAL' && canDo(user, 'WORK_ORDER:APPROVE');
  const canAssign = canDo(user, 'WORK_ORDER:ASSIGN');

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/work-orders" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={18} /></Link>
          <div>
            <p className="text-xs text-gray-400 font-mono">WO-{String(wo.woId).padStart(4, '0')}</p>
            <h2 className="text-lg font-bold text-gray-900 max-w-xl">{wo.description}</h2>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canAcceptWork && wo.status === 'WAITING' && (
            <Button size="sm" onClick={() => changeStatus('IN_PROGRESS')}><Play size={13} /> Nhận việc</Button>
          )}
          {canSuperviseFlow && wo.status === 'IN_PROGRESS' && (
            <Button size="sm" variant="secondary" onClick={() => changeStatus('PAUSED')}><Pause size={13} /> Tạm dừng</Button>
          )}
          {canSuperviseFlow && wo.status === 'PAUSED' && (
            <Button size="sm" onClick={() => changeStatus('IN_PROGRESS')}><Play size={13} /> Tiếp tục</Button>
          )}
          {canReportAwaiting && (
            <Button
              size="sm"
              variant="success"
              onClick={() => {
                const s = wo.suggestedActualHours;
                if (s != null && Number.isFinite(Number(s))) {
                  setAwaitingHours(String(s).replace('.', ','));
                } else {
                  setAwaitingHours('');
                }
                setAwaitingOpen(true);
              }}
            >
              <CheckCircle size={13} /> Báo hoàn thành
            </Button>
          )}
          {canReopenFromAwaiting && (
            <Button size="sm" variant="secondary" onClick={() => changeStatus('IN_PROGRESS')}>
              Làm tiếp
            </Button>
          )}
          {canCloseAfterReview && (
            <Button
              size="sm"
              variant="success"
              onClick={() => {
                const h = wo.actualHours ?? wo.suggestedActualHours;
                if (h != null && Number.isFinite(Number(h))) {
                  setCloseHours(String(h).replace('.', ','));
                } else {
                  setCloseHours('');
                }
                setCloseOpen(true);
              }}
            >
              <CheckCircle size={13} /> Đóng phiếu
            </Button>
          )}
          {canApprove && (
            <Button size="sm" variant="success" onClick={() => setApproveOpen(true)}><CheckCircle size={13} /> Phê duyệt</Button>
          )}
          {canAssign && (
            <Button size="sm" variant="secondary" onClick={() => setAssignOpen(true)}><UserPlus size={13} /> Phân công</Button>
          )}
        </div>
      </div>

      {wo.status === 'AWAITING_CLOSURE' && isTcPlus && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-sm text-violet-950">
          <span className="font-semibold">Chờ nghiệm thu.</span>{' '}
          Xem ảnh hiện trường bên dưới, sau đó <strong>Đóng phiếu</strong> hoặc <strong>Làm tiếp</strong> nếu cần bổ sung.
        </div>
      )}

      {wo.status === 'WAITING' && canAssign && !(wo.assignments?.length) && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <Info size={18} className="shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-bold text-amber-900">Chưa phân công người hiện trường</p>
            <p className="mt-1 leading-relaxed">
              Bấm <strong>Phân công</strong> và chọn <strong>Công nhân</strong> hoặc <strong>Nhân viên Kỹ thuật</strong>.
            </p>
            <Link
              to={`/checklists?assetId=${wo.assetId}`}
              className="inline-block mt-2 text-sm font-semibold text-amber-900 underline hover:no-underline"
            >
              Checklist / QR — tài sản #{wo.assetId}
            </Link>
          </div>
        </div>
      )}

      {wo.status === 'WAITING' && isAssigned && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
          <span className="font-semibold">Bạn được phân công.</span>{' '}
          <Link to={`/checklists?assetId=${wo.assetId}`} className="font-bold text-blue-800 underline">
            Tài liệu / QR — #{wo.assetId}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Thông tin phiếu" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            {[
              ['Tài sản',      wo.assetName],
              ['Vị trí',       wo.locationName],
              ['Loại thiết bị', wo.assetTypeName],
              ['Ngày dự kiến', fDate(wo.plannedDate)],
              ['Ngày thực tế', fDate(wo.actualDate)],
              ['Giờ ước tính', wo.estimatedHours ? `${wo.estimatedHours}h` : '—'],
              ['Giờ thực tế',  wo.actualHours != null && wo.actualHours !== '' ? `${wo.actualHours}h` : '—'],
              ['Nguồn',        wo.woSource],
            ].map(([l, v]) => (
              <div key={l}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{l}</p>
                <p className="font-semibold text-gray-900 mt-1">{v ?? '—'}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <Badge color={WO_STATUS_COLOR[wo.status]}>{WO_STATUS_LABEL[wo.status]}</Badge>
            <Badge color={WO_PRIORITY_COLOR[wo.priority]}>{WO_PRIORITY_LABEL[wo.priority]}</Badge>
          </div>
        </Card>

        <Card title="Nhân viên phụ trách">
          {wo.assignments?.length > 0
            ? (
              <ul className="space-y-2">
                {wo.assignments.map(a => (
                  <li key={a.employeeId} className="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
                      {a.fullName?.[0] ?? '?'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{a.fullName}</p>
                      <p className="text-xs font-medium text-gray-600">{a.positionName}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )
            : <p className="text-sm text-gray-400">Chưa phân công</p>
          }
        </Card>
      </div>

      {['IN_PROGRESS', 'AWAITING_CLOSURE'].includes(wo.status) && (
        <Card title="Ảnh hiện trường">
          {canUploadPhotos && (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                multiple
                className="hidden"
                onChange={onPickPhotos}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={photoBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera size={14} /> Thêm ảnh
              </Button>
              <span className="text-xs text-gray-500">JPG / PNG / WEBP, tối đa 15 ảnh/lần, mỗi file ≤ 10MB</span>
            </div>
          )}
          {!wo.photos?.length && (
            <p className="text-sm text-gray-400">Chưa có ảnh.</p>
          )}
          {wo.photos?.length > 0 && (
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {wo.photos.map((p) => {
                const src = woPhotoSrc(p.filePath);
                const own = p.uploadedBy != null && Number(p.uploadedBy) === Number(user?.employeeId);
                const canDel = canUploadPhotos && (own || isTcPlus);
                return (
                  <li key={p.photoId} className="relative group rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                    <a href={src} target="_blank" rel="noopener noreferrer" className="block aspect-square">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </a>
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-white/90 text-gray-700 shadow"
                        title="Mở"
                      >
                        <ExternalLink size={14} />
                      </a>
                      {canDel && (
                        <button
                          type="button"
                          className="p-1.5 rounded-lg bg-white/90 text-red-600 shadow"
                          title="Xóa"
                          onClick={() => removePhoto(p.photoId)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 px-2 py-1 truncate">
                      {p.uploadedByName ?? '—'} · {p.createdAt ? fDateTime(p.createdAt) : ''}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {approvals.length > 0 && (
        <Card title="Lịch sử phê duyệt">
          <div className="space-y-3">
            {approvals.map(a => (
              <div key={a.logId} className="flex items-start gap-3 text-sm bg-gray-50 rounded-xl px-4 py-3">
                <Badge color={
                  a.status === 'APPROVED' ? 'green' : a.status === 'REJECTED' ? 'red' : a.status === 'REQUEST_CHANGES' ? 'orange' : 'yellow'
                }>
                  Cấp {a.currentLevel}
                </Badge>
                <div>
                  <p className="font-semibold text-gray-900">{a.approverName ?? 'Chờ phê duyệt'} · <span className="font-normal text-gray-600">{fDateTime(a.actionDate)}</span></p>
                  {a.comment && <p className="font-medium text-gray-700 text-xs mt-1">&quot;{a.comment}&quot;</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Phân công nhân viên" size="sm">
        <div className="space-y-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            Công nhân / NV Kỹ thuật thực hiện tại hiện trường.
          </p>
          <Select label="Nhân viên thực hiện" value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}>
            <option value="">— Chọn nhân viên —</option>
            {employees.map(e => <option key={e.employeeId} value={e.employeeId}>{e.fullName} — {e.positionName}</option>)}
          </Select>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setAssignOpen(false)}>Hủy</Button>
            <Button onClick={handleAssign} loading={saving}>Phân công</Button>
          </div>
        </div>
      </Modal>

      <Modal open={awaitingOpen} onClose={() => setAwaitingOpen(false)} title="Báo hoàn thành (chờ nghiệm thu)" size="sm">
        <div className="space-y-4">
          <p className="text-xs text-gray-600">
            Trưởng ca / Trưởng phòng sẽ xem ảnh hiện trường và <strong>đóng phiếu</strong>. Giờ làm gợi ý đến thời điểm báo cáo (đã trừ tạm dừng).
          </p>
          <Input
            label="Giờ thực tế (tuỳ chọn)"
            type="text"
            inputMode="decimal"
            placeholder="Để trống = tự tính"
            value={awaitingHours}
            onChange={(e) => setAwaitingHours(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setAwaitingOpen(false)}>Hủy</Button>
            <Button variant="success" onClick={submitAwaitingClosure} loading={saving}>Gửi</Button>
          </div>
        </div>
      </Modal>

      <Modal open={closeOpen} onClose={() => setCloseOpen(false)} title="Nghiệm thu — đóng phiếu" size="sm">
        <div className="space-y-4">
          <p className="text-xs text-gray-600">
            Xác nhận đã kiểm tra (ảnh / hiện trường). Có thể chỉnh lại giờ thực tế trước khi đóng.
          </p>
          <Input
            label="Giờ thực tế (tuỳ chọn)"
            type="text"
            inputMode="decimal"
            placeholder="Để trống = giữ theo báo cáo thợ"
            value={closeHours}
            onChange={(e) => setCloseHours(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCloseOpen(false)}>Hủy</Button>
            <Button variant="success" onClick={submitCloseWorkOrder} loading={saving}>Đóng phiếu</Button>
          </div>
        </div>
      </Modal>

      <Modal open={approveOpen} onClose={() => setApproveOpen(false)} title="Xử lý phê duyệt" size="sm">
        <div className="space-y-4">
          <Select label="Hành động" value={approveAction} onChange={e => setApproveAction(e.target.value)}>
            <option value="APPROVED">Duyệt</option>
            <option value="REJECTED">Từ chối</option>
            <option value="REQUEST_CHANGES">Yêu cầu chỉnh sửa</option>
          </Select>
          <Textarea label="Ghi chú" value={comment} onChange={e => setComment(e.target.value)} placeholder="Nhập lý do (bắt buộc khi từ chối)" />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setApproveOpen(false)}>Hủy</Button>
            <Button
              variant={approveAction === 'APPROVED' ? 'success' : approveAction === 'REJECTED' ? 'danger' : 'primary'}
              onClick={handleApprove} loading={saving}
            >
              {approveAction === 'APPROVED' ? 'Duyệt' : approveAction === 'REJECTED' ? 'Từ chối' : 'Yêu cầu sửa'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
