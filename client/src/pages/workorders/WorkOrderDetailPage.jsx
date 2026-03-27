/**
 * WorkOrderDetailPage.jsx — Chi tiết phiếu việc: thông tin, chuyển trạng thái, phân công, phê duyệt.
 * luongpheduyet.rule: Thợ nhận việc → Đang thực hiện → Hoàn thành.
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, UserPlus, CheckCircle, Play, Pause, XCircle } from 'lucide-react';
import { workOrderApi } from '../../api/workOrder.api.js';
import { employeeApi }  from '../../api/employee.api.js';
import { approvalApi }  from '../../api/approval.api.js';
import { Badge }        from '../../components/ui/Badge.jsx';
import { Button }       from '../../components/ui/Button.jsx';
import { Card }         from '../../components/ui/Card.jsx';
import { Modal }        from '../../components/ui/Modal.jsx';
import { Select, Textarea } from '../../components/ui/Input.jsx';
import { PageLoader }   from '../../components/ui/Spinner.jsx';
import {
  WO_STATUS_LABEL, WO_STATUS_COLOR, WO_PRIORITY_LABEL, WO_PRIORITY_COLOR,
  fDate, fDateTime,
} from '../../utils/format.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import toast from 'react-hot-toast';

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
    employeeApi.getAll({ limit: 200 }).then(r => setEmployees(r.data.data?.items ?? [])).catch(() => {});
  }, [id]);

  const changeStatus = async (status) => {
    if (!confirm(`Chuyển trạng thái sang "${WO_STATUS_LABEL[status]}"?`)) return;
    try {
      await workOrderApi.changeStatus(id, status);
      toast.success('Đã cập nhật trạng thái');
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

  const canApprove = wo.status === 'PENDING_APPROVAL' && (user?.positionLevel ?? 0) >= 2;

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
          {wo.status === 'WAITING'      && <Button size="sm" onClick={() => changeStatus('IN_PROGRESS')}><Play size={13} /> Nhận việc</Button>}
          {wo.status === 'IN_PROGRESS'  && <Button size="sm" variant="secondary" onClick={() => changeStatus('PAUSED')}><Pause size={13} /> Tạm dừng</Button>}
          {wo.status === 'PAUSED'       && <Button size="sm" onClick={() => changeStatus('IN_PROGRESS')}><Play size={13} /> Tiếp tục</Button>}
          {wo.status === 'IN_PROGRESS'  && <Button size="sm" variant="success" onClick={() => changeStatus('COMPLETED')}><CheckCircle size={13} /> Hoàn thành</Button>}
          {canApprove && <Button size="sm" variant="success" onClick={() => setApproveOpen(true)}><CheckCircle size={13} /> Phê duyệt</Button>}
          {(user?.positionLevel ?? 0) >= 2 && wo.status !== 'COMPLETED' && wo.status !== 'CANCELLED' && (
            <Button size="sm" variant="secondary" onClick={() => setAssignOpen(true)}><UserPlus size={13} /> Phân công</Button>
          )}
        </div>
      </div>

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
          <Select label="Nhân viên" value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}>
            <option value="">— Chọn nhân viên —</option>
            {employees.map(e => <option key={e.employeeId} value={e.employeeId}>{e.fullName} — {e.positionName}</option>)}
          </Select>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setAssignOpen(false)}>Hủy</Button>
            <Button onClick={handleAssign} loading={saving}>Phân công</Button>
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
