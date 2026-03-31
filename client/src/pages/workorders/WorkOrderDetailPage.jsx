/**
 * WorkOrderDetailPage.jsx — Chi tiết phiếu việc: thông tin, chuyển trạng thái, phân công, phê duyệt.
 * luongpheduyet.rule: Thợ nhận việc → Đang thực hiện → Hoàn thành.
 * Phân công: chỉ Công nhân (L1) + NV Kỹ thuật (L2) — khớp BFD điều phối hiện trường; backend cũng chặn L>2.
 *
 * RBAC UI: Nhận việc (WAITING→IN_PROGRESS) — chỉ người được phân công + WORK_ORDER:UPDATE.
 * Tạm dừng / tiếp tục / hoàn thành — thợ được giao hoặc Trưởng ca (điều phối).
 * Phê duyệt — WORK_ORDER:APPROVE; phân công — WORK_ORDER:ASSIGN.
 * Giờ thực tế: server tính từ WorkStartedAt (Nhận việc) đến Hoàn thành, trừ thời gian PAUSED; có thể ghi đè trong modal.
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, UserPlus, CheckCircle, Play, Pause, XCircle, Info } from 'lucide-react';
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

/** Chỉ lực lượng thực hiện tại máy — không giao WO cho Trưởng ca / Admin / Ban GĐ. */
const ASSIGNEE_MAX_LEVEL = 2;

export function WorkOrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
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
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeHours, setCompleteHours] = useState('');

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
    if (!confirm(`Chuyển trạng thái sang "${WO_STATUS_LABEL[status]}"?`)) return;
    try {
      await workOrderApi.changeStatus(id, status);
      toast.success('Đã cập nhật trạng thái');
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi'); }
  };

  const submitComplete = async () => {
    const raw = completeHours.trim();
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
      toast.success('Đã hoàn thành phiếu');
      setCompleteOpen(false);
      setCompleteHours('');
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi'); }
    finally { setSaving(false); }
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
      // Lấy logId đang PENDING
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
  const canAcceptWork =
    canDo(user, 'WORK_ORDER:UPDATE') && isAssigned;
  const canSuperviseFlow =
    canDo(user, 'WORK_ORDER:UPDATE') && (isAssigned || isTcPlus);
  const canApprove =
    wo.status === 'PENDING_APPROVAL' && canDo(user, 'WORK_ORDER:APPROVE');
  const canAssign = canDo(user, 'WORK_ORDER:ASSIGN');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/work-orders" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={18} /></Link>
          <div>
            <p className="text-xs text-gray-400 font-mono">WO-{String(wo.woId).padStart(4, '0')}</p>
            <h2 className="text-lg font-bold text-gray-900 max-w-xl">{wo.description}</h2>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canAcceptWork && wo.status === 'WAITING'      && <Button size="sm" onClick={() => changeStatus('IN_PROGRESS')}><Play size={13} /> Nhận việc</Button>}
          {canSuperviseFlow && wo.status === 'IN_PROGRESS'  && <Button size="sm" variant="secondary" onClick={() => changeStatus('PAUSED')}><Pause size={13} /> Tạm dừng</Button>}
          {canSuperviseFlow && wo.status === 'PAUSED'       && <Button size="sm" onClick={() => changeStatus('IN_PROGRESS')}><Play size={13} /> Tiếp tục</Button>}
          {canSuperviseFlow && wo.status === 'IN_PROGRESS'  && (
            <Button
              size="sm"
              variant="success"
              onClick={() => {
                const s = wo.suggestedActualHours;
                if (s != null && Number.isFinite(Number(s))) {
                  setCompleteHours(String(s).replace('.', ','));
                } else {
                  setCompleteHours('');
                }
                setCompleteOpen(true);
              }}
            >
              <CheckCircle size={13} /> Hoàn thành
            </Button>
          )}
          {canApprove && <Button size="sm" variant="success" onClick={() => setApproveOpen(true)}><CheckCircle size={13} /> Phê duyệt</Button>}
          {canAssign && (
            <Button size="sm" variant="secondary" onClick={() => setAssignOpen(true)}><UserPlus size={13} /> Phân công</Button>
          )}
        </div>
      </div>

      {wo.status === 'WAITING' && canAssign && !(wo.assignments?.length) && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <Info size={18} className="shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-bold text-amber-900">Chưa phân công người hiện trường</p>
            <p className="mt-1 leading-relaxed">
              Bấm <strong>Phân công</strong> và chọn <strong>Công nhân</strong> hoặc <strong>Nhân viên Kỹ thuật</strong>.
              Người được giao sẽ thấy phiếu trong <strong>Phiếu việc</strong> và nhận thông báo, rồi bấm <strong>Nhận việc</strong> khi bắt đầu.
            </p>
            <Link
              to={`/checklists?assetId=${wo.assetId}`}
              className="inline-block mt-2 text-sm font-semibold text-amber-900 underline hover:no-underline"
            >
              Xem tài liệu / checklist theo tài sản (mã #{wo.assetId})
            </Link>
          </div>
        </div>
      )}

      {wo.status === 'WAITING' && isAssigned && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
          <span className="font-semibold">Bạn được phân công phiếu này.</span>{' '}
          Bấm <strong>Nhận việc</strong> khi bắt đầu. Tài liệu hướng dẫn:{' '}
          <Link to={`/checklists?assetId=${wo.assetId}`} className="font-bold text-blue-800 underline">
            Checklist / QR — tài sản #{wo.assetId}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Info */}
        <Card title="Thông tin phiếu" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            {[
              ['Tài sản',      wo.assetName],
              ['Vị trí',       wo.locationName],
              ['Loại thiết bị', wo.assetTypeName],
              ['Ngày dự kiến', fDate(wo.plannedDate)],
              ['Ngày thực tế', fDate(wo.actualDate)],
              ['Giờ ước tính', wo.estimatedHours ? `${wo.estimatedHours}h` : '—'],
              ['Giờ thực tế',  wo.actualHours    ? `${wo.actualHours}h`    : '—'],
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

        {/* Assignments */}
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

      {/* Approval history */}
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
                  {a.comment && <p className="font-medium text-gray-700 text-xs mt-1">"{a.comment}"</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Assign modal */}
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Phân công nhân viên" size="sm">
        <div className="space-y-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            Chỉ hiển thị <strong>Công nhân</strong> và <strong>Nhân viên Kỹ thuật</strong> (thực hiện tại hiện trường).
            Trưởng ca phân công, không tự ghi tên mình vào phiếu trừ trường hợp đặc biệt có quy trình riêng.
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

      {/* Hoàn thành — gửi ActualHours (tùy chọn; để trống = không ghi DB) */}
      <Modal open={completeOpen} onClose={() => setCompleteOpen(false)} title="Hoàn thành phiếu" size="sm">
        <div className="space-y-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            Hệ thống <strong>tự tính</strong> từ lúc <strong>Nhận việc</strong> đến bây giờ (đã trừ thời gian <strong>Tạm dừng</strong>). Ô bên dưới đã điền gợi ý — có thể sửa để ghi đè, hoặc xóa hết để lưu theo số tự động lúc bấm xác nhận.
          </p>
          <Input
            label="Giờ thực tế (tùy chọn)"
            type="text"
            inputMode="decimal"
            placeholder="VD: 2 hoặc 0,5"
            value={completeHours}
            onChange={(e) => setCompleteHours(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCompleteOpen(false)}>Hủy</Button>
            <Button variant="success" onClick={submitComplete} loading={saving}>Xác nhận hoàn thành</Button>
          </div>
        </div>
      </Modal>

      {/* Approve modal */}
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
