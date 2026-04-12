/**
 * WorkOrderDetailPage.jsx — Chi tiết WO: phân công, thực hiện, ảnh hiện trường, báo hoàn thành → chờ nghiệm thu → TC/TP đóng phiếu.
 * Thợ (được giao): nhận việc, tạm dừng/tiếp tục, upload nhiều ảnh, báo hoàn thành (AWAITING_CLOSURE).
 * Trưởng ca / Trưởng phòng: nghiệm thu đóng (COMPLETED), hoặc trả về làm tiếp (IN_PROGRESS).
 * Thợ báo AWAITING_CLOSURE: ghi chú hiện trường + linh kiện/vật tư (lưu lịch sử bảo trì snapshot); TC xem trước ảnh.
 * Phê duyệt: WO nghiêm trọng (EMERGENCY hoặc CORRECTIVE+HIGH) = 2 bước TC → Trưởng phòng; UI hiển thị tiến trình + phân công tại bước cuối.
 * Sau «Yêu cầu chỉnh sửa» (không còn log PENDING): Sửa phiếu + «Gửi lại phê duyệt» (submit) — lại từ bước 1 TC, WO 2 cấp thì vẫn qua TP.
 * Phân công: ẩn nhân viên đang trong lịch nghỉ (onScheduledLeave).
 * Ghi chú/vật tư (WO): nhập sớm (WAITING…PAUSED) + Lưu nháp; 3 checklist APPROVED gần nhất cùng tài sản (NVKT+ hoặc thợ được giao).
 * Phiếu CORRECTIVE: reset mốc giờ PM (một lần/phiếu, hiển thị thời điểm + người làm).
 */
import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  UserPlus,
  CheckCircle,
  Play,
  Pause,
  Info,
  Camera,
  Trash2,
  ExternalLink,
  ChevronRight,
  TimerReset,
  ClipboardList,
  Send,
  Pencil,
} from "lucide-react";
import { workOrderApi } from "../../api/workOrder.api.js";
import { employeeApi } from "../../api/employee.api.js";
import { assetApi } from "../../api/asset.api.js";
import { approvalApi } from "../../api/approval.api.js";
import { WorkOrderForm } from "./WorkOrderForm.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { Input, Select, Textarea } from "../../components/ui/Input.jsx";
import { PageLoader } from "../../components/ui/Spinner.jsx";
import {
  WO_STATUS_LABEL,
  WO_STATUS_COLOR,
  WO_PRIORITY_LABEL,
  WO_PRIORITY_COLOR,
  fDate,
  fDateTime,
  fNumber,
  CHECKLIST_STATUS_COLOR,
} from "../../utils/format.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { canDo, LEVEL_TRUONG_CA } from "../../utils/rbac.js";
import toast from "react-hot-toast";

const ASSIGNEE_MAX_LEVEL = 2;

const API_ORIGIN = (
  import.meta.env.VITE_API_BASE || "http://localhost:4000/api"
).replace(/\/?api\/?$/, "");

function woPhotoSrc(filePath) {
  if (!filePath) return "";
  const p = String(filePath).replace(/^\/+/, "");
  return `${API_ORIGIN.replace(/\/$/, "")}/${p}`;
}

export function WorkOrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [wo, setWo] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [approvalWorkflowSteps, setApprovalWorkflowSteps] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState("");
  const [approveAction, setApproveAction] = useState("APPROVED");
  const [comment, setComment] = useState("");
  const [approveAssignEmp, setApproveAssignEmp] = useState("");
  const [approveFieldEmployees, setApproveFieldEmployees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [awaitingOpen, setAwaitingOpen] = useState(false);
  const [awaitingHours, setAwaitingHours] = useState("");
  const [closureFieldNotes, setClosureFieldNotes] = useState("");
  const [closurePartsNotes, setClosurePartsNotes] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeHours, setCloseHours] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [editWoOpen, setEditWoOpen] = useState(false);
  const [woEditAssets, setWoEditAssets] = useState([]);

  const load = async () => {
    try {
      const [wr, ar] = await Promise.all([
        workOrderApi.getById(id),
        approvalApi
          .getHistory(id, "WORK_ORDER")
          .catch(() => ({ data: { data: { logs: [], workflowSteps: [] } } })),
      ]);
      setWo(wr.data.data);
      const apPayload = ar.data.data;
      const nextLogs = Array.isArray(apPayload)
        ? apPayload
        : (apPayload?.logs ?? []);
      const steps = Array.isArray(apPayload)
        ? []
        : (apPayload?.workflowSteps ?? []);
      setApprovals(nextLogs);
      setApprovalWorkflowSteps(steps);
    } catch {
      toast.error("Không tải được phiếu việc");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    employeeApi
      .getAll({ limit: 200 })
      .then((r) => {
        const items = r.data.data?.items ?? [];
        setEmployees(
          items.filter(
            (e) =>
              e.isActive !== false &&
              (e.positionLevel ?? 99) <= ASSIGNEE_MAX_LEVEL,
          ),
        );
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!wo) return;
    setClosureFieldNotes(wo.closureFieldNotes ?? "");
    setClosurePartsNotes(wo.closurePartsNotes ?? "");
  }, [wo?.woId, wo?.closureFieldNotes, wo?.closurePartsNotes]);

  const pendingApprovalLog = approvals.find((a) => a.status === "PENDING");
  const needsResubmitApproval =
    wo?.status === "PENDING_APPROVAL" && !pendingApprovalLog;
  const canResubmitApproval =
    needsResubmitApproval && canDo(user, "WORK_ORDER:CREATE");
  const canEditPendingResubmit =
    needsResubmitApproval && canDo(user, "WORK_ORDER:UPDATE");
  const isWoFinalApprovalStep =
    wo?.status === "PENDING_APPROVAL" &&
    pendingApprovalLog &&
    Number(pendingApprovalLog.currentLevel) ===
      Number(pendingApprovalLog.totalLevels);

  useEffect(() => {
    if (!approveOpen || !isWoFinalApprovalStep) {
      setApproveFieldEmployees([]);
      return;
    }
    employeeApi
      .getAll({ limit: 200 })
      .then((r) => {
        const items = r.data.data?.items ?? [];
        setApproveFieldEmployees(
          items.filter(
            (e) =>
              e.isActive !== false &&
              (e.positionLevel ?? 99) <= ASSIGNEE_MAX_LEVEL,
          ),
        );
      })
      .catch(() => setApproveFieldEmployees([]));
  }, [approveOpen, isWoFinalApprovalStep, id]);

  useEffect(() => {
    if (!editWoOpen) return;
    assetApi
      .getAll({ limit: 200 })
      .then((r) => setWoEditAssets(r.data.data?.items ?? []))
      .catch(() => setWoEditAssets([]));
  }, [editWoOpen]);

  const handleResubmitApproval = async () => {
    if (!wo) return;
    if (
      !window.confirm(
        "Gửi lại phê duyệt từ bước 1 (Trưởng ca)? Phiếu 2 cấp sẽ lần lượt qua Trưởng ca rồi Trưởng phòng.",
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await approvalApi.submit({
        resourceType: "WORK_ORDER",
        resourceId: Number(wo.woId),
        woSource: wo.woSource,
        woPriority: wo.priority,
      });
      toast.success(
        "Đã gửi lại phê duyệt — Trưởng ca xử lý trước; phiếu khẩn 2 cấp sau đó tới Trưởng phòng.",
      );
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Không gửi lại được phê duyệt");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status) => {
    if (!confirm(`Chuyển sang «${WO_STATUS_LABEL[status] ?? status}»?`)) return;
    try {
      await workOrderApi.changeStatus(id, status);
      toast.success("Đã cập nhật");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi");
    }
  };

  const submitAwaitingClosure = async () => {
    if (!closureFieldNotes.trim()) {
      toast.error("Vui lòng nhập ghi chú hiện trường / việc đã làm");
      return;
    }
    const raw = awaitingHours.trim();
    let actualHours;
    if (raw !== "") {
      const n = Number(raw.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Giờ thực tế không hợp lệ");
        return;
      }
      actualHours = n;
    }
    setSaving(true);
    try {
      await workOrderApi.changeStatus(id, "AWAITING_CLOSURE", {
        ...(raw === "" ? {} : { actualHours }),
        ...(closureFieldNotes.trim() && {
          closureFieldNotes: closureFieldNotes.trim(),
        }),
        ...(closurePartsNotes.trim() && {
          closurePartsNotes: closurePartsNotes.trim(),
        }),
      });
      toast.success("Đã gửi chờ nghiệm thu");
      setAwaitingOpen(false);
      setAwaitingHours("");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi");
    } finally {
      setSaving(false);
    }
  };

  const submitCloseWorkOrder = async () => {
    const raw = closeHours.trim();
    let actualHours;
    if (raw !== "") {
      const n = Number(raw.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Giờ thực tế không hợp lệ");
        return;
      }
      actualHours = n;
    }
    setSaving(true);
    try {
      await workOrderApi.changeStatus(
        id,
        "COMPLETED",
        raw === "" ? {} : { actualHours },
      );
      toast.success("Đã đóng phiếu");
      setCloseOpen(false);
      setCloseHours("");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi");
    } finally {
      setSaving(false);
    }
  };

  const saveClosureDraft = async () => {
    setSaving(true);
    try {
      await workOrderApi.saveClosureNotes(id, {
        closureFieldNotes: closureFieldNotes,
        closurePartsNotes: closurePartsNotes,
      });
      toast.success("Đã lưu nháp ghi chú / vật tư");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi");
    } finally {
      setSaving(false);
    }
  };

  const resetRuntimeBaseline = async () => {
    if (
      !confirm(
        "Cập nhật mốc “sau bảo trì” theo tổng giờ chạy hiện tại của máy? Lịch bảo trì theo giờ sẽ tính lại từ mốc này.",
      )
    )
      return;
    setSaving(true);
    try {
      await workOrderApi.resetRuntimeBaseline(id);
      toast.success("Đã cập nhật mốc giờ chạy cho dự báo");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi");
    } finally {
      setSaving(false);
    }
  };

  const onPickPhotos = async (e) => {
    const files = e.target?.files;
    if (!files?.length) return;
    const fd = new FormData();
    for (let i = 0; i < files.length; i += 1) fd.append("photos", files[i]);
    setPhotoBusy(true);
    try {
      await workOrderApi.uploadPhotos(id, fd);
      toast.success(`Đã tải ${files.length} ảnh`);
      e.target.value = "";
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi upload");
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async (photoId) => {
    if (!confirm("Xóa ảnh này?")) return;
    try {
      await workOrderApi.deletePhoto(id, photoId);
      toast.success("Đã xóa");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi");
    }
  };

  const handleAssign = async () => {
    if (!selectedEmp) return;
    setSaving(true);
    try {
      await workOrderApi.assign(id, Number(selectedEmp));
      toast.success("Đã phân công");
      setAssignOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi phân công");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      const pendingLog = approvals.find((a) => a.status === "PENDING");
      if (!pendingLog) {
        toast.error("Không có yêu cầu duyệt nào đang chờ");
        return;
      }
      await approvalApi.action(pendingLog.logId, {
        action: approveAction,
        comment,
        assignEmployeeId:
          approveAction === "APPROVED" && approveAssignEmp
            ? approveAssignEmp
            : undefined,
      });
      toast.success("Đã xử lý phê duyệt");
      setApproveOpen(false);
      setComment("");
      setApproveAssignEmp("");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi phê duyệt");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!wo)
    return (
      <div className="text-center py-20 text-gray-400">
        Không tìm thấy phiếu việc
      </div>
    );

  const isAssigned = wo.assignments?.some(
    (a) => Number(a.employeeId) === Number(user?.employeeId),
  );
  const isTcPlus = (user?.positionLevel ?? 0) >= LEVEL_TRUONG_CA;
  const canUpdate = canDo(user, "WORK_ORDER:UPDATE");
  const canAcceptWork = canUpdate && isAssigned;
  const canSuperviseFlow = canUpdate && (isAssigned || isTcPlus);
  const canReportAwaiting =
    canUpdate && isAssigned && wo.status === "IN_PROGRESS";
  const canUploadPhotos =
    canUpdate &&
    (isAssigned || isTcPlus) &&
    ["IN_PROGRESS", "AWAITING_CLOSURE"].includes(wo.status);
  const canCloseAfterReview =
    canUpdate && isTcPlus && wo.status === "AWAITING_CLOSURE";
  const canReopenFromAwaiting =
    canUpdate && isTcPlus && wo.status === "AWAITING_CLOSURE";
  const canApprove =
    wo.status === "PENDING_APPROVAL" && canDo(user, "WORK_ORDER:APPROVE");
  const canAssign = canDo(user, "WORK_ORDER:ASSIGN");
  const canEditClosureDraft =
    canUpdate &&
    (isAssigned || isTcPlus) &&
    ["WAITING", "IN_PROGRESS", "PAUSED"].includes(wo.status);
  const canResetRuntimeBaseline =
    wo.woSource === "CORRECTIVE" &&
    !wo.counterBaselineResetAt &&
    ["IN_PROGRESS", "PAUSED", "AWAITING_CLOSURE"].includes(wo.status) &&
    canUpdate &&
    (isAssigned || isTcPlus);

  const twoStepApproval = Number(pendingApprovalLog?.totalLevels) === 2;
  const tpStepName =
    approvalWorkflowSteps.find((s) => Number(s.stepLevel) === 2)
      ?.positionName ?? "Trưởng phòng";
  const tcStepName =
    approvalWorkflowSteps.find((s) => Number(s.stepLevel) === 1)
      ?.positionName ?? "Trưởng ca";
  const stepsForApprovalUi =
    approvalWorkflowSteps.length > 0
      ? approvalWorkflowSteps
      : pendingApprovalLog && Number(pendingApprovalLog.totalLevels) === 2
        ? [
            { stepLevel: 1, positionName: tcStepName },
            { stepLevel: 2, positionName: tpStepName },
          ]
        : pendingApprovalLog && Number(pendingApprovalLog.totalLevels) === 1
          ? [{ stepLevel: 1, positionName: tcStepName }]
          : [];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/work-orders" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-xs text-gray-400 font-mono">
              WO-{String(wo.woId).padStart(4, "0")}
            </p>
            <h2 className="text-lg font-bold text-gray-900 max-w-xl">
              {wo.description}
            </h2>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canAcceptWork && wo.status === "WAITING" && (
            <Button size="sm" onClick={() => changeStatus("IN_PROGRESS")}>
              <Play size={13} /> Nhận việc
            </Button>
          )}
          {canSuperviseFlow && wo.status === "IN_PROGRESS" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => changeStatus("PAUSED")}
            >
              <Pause size={13} /> Tạm dừng
            </Button>
          )}
          {canSuperviseFlow && wo.status === "PAUSED" && (
            <Button size="sm" onClick={() => changeStatus("IN_PROGRESS")}>
              <Play size={13} /> Tiếp tục
            </Button>
          )}
          {canReportAwaiting && (
            <Button
              size="sm"
              variant="success"
              onClick={() => {
                const s = wo.suggestedActualHours;
                if (s != null && Number.isFinite(Number(s))) {
                  setAwaitingHours(String(s).replace(".", ","));
                } else {
                  setAwaitingHours("");
                }
                setAwaitingOpen(true);
              }}
            >
              <CheckCircle size={13} /> Báo hoàn thành
            </Button>
          )}
          {canReopenFromAwaiting && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => changeStatus("IN_PROGRESS")}
            >
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
                  setCloseHours(String(h).replace(".", ","));
                } else {
                  setCloseHours("");
                }
                setCloseOpen(true);
              }}
            >
              <CheckCircle size={13} /> Đóng phiếu
            </Button>
          )}
          {canApprove && (
            <Button
              size="sm"
              variant="success"
              onClick={() => {
                setApproveAssignEmp("");
                setApproveOpen(true);
              }}
            >
              <CheckCircle size={13} /> Phê duyệt
            </Button>
          )}
          {canEditPendingResubmit && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEditWoOpen(true)}
            >
              <Pencil size={13} /> Sửa phiếu
            </Button>
          )}
          {canResubmitApproval && (
            <Button
              size="sm"
              onClick={handleResubmitApproval}
              loading={saving}
            >
              <Send size={13} /> Gửi lại phê duyệt
            </Button>
          )}
          {canAssign && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAssignOpen(true)}
            >
              <UserPlus size={13} /> Phân công
            </Button>
          )}
          {canResetRuntimeBaseline && (
            <Button
              size="sm"
              variant="secondary"
              onClick={resetRuntimeBaseline}
              loading={saving}
            >
              <TimerReset size={13} /> Reset mốc giờ chạy (PM)
            </Button>
          )}
        </div>
      </div>

      {wo.woSource === "CORRECTIVE" && wo.counterBaselineResetAt && (
        <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950">
          <TimerReset
            size={20}
            className="shrink-0 text-emerald-600 mt-0.5"
            aria-hidden
          />
          <div>
            <p className="font-bold text-emerald-900">
              Đã reset mốc giờ chạy (dự báo PM) trên phiếu này
            </p>
            <p className="mt-1 leading-relaxed">
              Thời điểm:{" "}
              <strong>{fDateTime(wo.counterBaselineResetAt)}</strong>
              {wo.counterBaselineResetByName ? (
                <>
                  {" "}
                  · Người thực hiện:{" "}
                  <strong>{wo.counterBaselineResetByName}</strong>
                </>
              ) : null}
              . Chỉ thực hiện được một lần — không cần bấm lại.
            </p>
          </div>
        </div>
      )}

      {needsResubmitApproval && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <p className="font-bold text-amber-950 mb-1">
            Chờ gửi lại phê duyệt
          </p>
          <p className="leading-relaxed text-amber-900/95">
            Giám sát đã yêu cầu chỉnh sửa hoặc luồng duyệt tạm dừng — phiếu vẫn ở trạng thái «Chờ duyệt» nhưng
            không còn bước đang chờ. Hãy{" "}
            <strong>sửa nội dung phiếu</strong> (nếu cần) rồi{" "}
            <strong>gửi lại phê duyệt</strong>: hệ thống tạo yêu cầu mới từ{" "}
            <strong>bước 1 — Trưởng ca</strong>; phiếu <strong>hai cấp</strong>{" "}
            (khẩn) sau đó vẫn qua <strong>Trưởng phòng</strong> như lần đầu.
          </p>
          {!canResubmitApproval && !canEditPendingResubmit && (
            <p className="mt-2 text-xs text-amber-800/90">
              Cần quyền cập nhật phiếu / tạo &amp; gửi duyệt (NV KT…) để thao tác tại đây.
            </p>
          )}
        </div>
      )}

      {wo.status === "PENDING_APPROVAL" &&
        (stepsForApprovalUi.length > 0 || !!pendingApprovalLog) && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-4 text-sm text-indigo-950">
          <p className="font-bold text-indigo-950 mb-3">Tiến trình phê duyệt</p>
          <div className="flex flex-wrap items-center gap-y-2 gap-x-1">
            {stepsForApprovalUi.map((step, idx) => {
              const level = Number(step.stepLevel);
              const done = approvals.some(
                (a) =>
                  Number(a.currentLevel) === level && a.status === "APPROVED",
              );
              const current =
                pendingApprovalLog &&
                Number(pendingApprovalLog.currentLevel) === level &&
                pendingApprovalLog.status === "PENDING";
              const label = step.positionName ?? `Bước ${level}`;
              return (
                <span key={level} className="flex items-center gap-1">
                  {idx > 0 && (
                    <ChevronRight
                      className="text-indigo-300 shrink-0 mx-0.5"
                      size={18}
                      aria-hidden
                    />
                  )}
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      done
                        ? "bg-green-100 text-green-900"
                        : current
                          ? "bg-amber-100 text-amber-950 ring-2 ring-amber-400 shadow-sm"
                          : "bg-white/90 text-gray-500 border border-indigo-100"
                    }`}
                  >
                    {done && <CheckCircle size={14} className="shrink-0" />}
                    {level}. {label}
                    {current ? " · đang chờ" : ""}
                  </span>
                </span>
              );
            })}
          </div>
          {twoStepApproval &&
            Number(pendingApprovalLog?.currentLevel) === 1 &&
            pendingApprovalLog?.status === "PENDING" && (
              <p className="mt-3 text-xs leading-relaxed border-t border-indigo-200/60 pt-3 text-indigo-900/95">
                Phiếu <strong>sự cố nghiêm trọng</strong> (2 cấp duyệt). Sau khi{" "}
                <strong>{tcStepName}</strong> duyệt xong, yêu cầu chuyển sang{" "}
                <strong>{tpStepName}</strong> — bước đó có thể{" "}
                <strong>xác nhận / phân công lại</strong> người hiện trường khi
                duyệt cuối (hoặc để trống, phân công sau trên phiếu).
              </p>
            )}
          {twoStepApproval &&
            Number(pendingApprovalLog?.currentLevel) === 2 &&
            pendingApprovalLog?.status === "PENDING" && (
              <p className="mt-3 text-xs font-semibold leading-relaxed border-t border-indigo-200/60 pt-3 text-amber-950">
                Đang chờ <strong>{tpStepName}</strong> — duyệt hoàn tất để phiếu
                sang «Chờ thực hiện». Ở bước cuối có thể chọn phân công ngay
                trong form Phê duyệt (điều chỉnh lại người giao nếu cần).
              </p>
            )}
          {!twoStepApproval &&
            Number(pendingApprovalLog?.currentLevel) === 1 &&
            pendingApprovalLog?.status === "PENDING" && (
              <p className="mt-3 text-xs leading-relaxed border-t border-indigo-200/60 pt-3 text-indigo-800/90">
                Phiếu thông thường: một bước duyệt{" "}
                <strong>{tcStepName}</strong>. Có thể phân công sau khi đã vào
                «Chờ thực hiện».
              </p>
            )}
        </div>
      )}

      {wo.status === "AWAITING_CLOSURE" && isTcPlus && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-sm text-violet-950">
          <span className="font-semibold">Chờ nghiệm thu.</span> Đọc{" "}
          <strong>báo cáo thợ</strong> và <strong>ảnh hiện trường</strong> bên
          dưới, sau đó <strong>Đóng phiếu</strong> hoặc{" "}
          <strong>Làm tiếp</strong> nếu cần bổ sung.
        </div>
      )}

      {wo.status === "AWAITING_CLOSURE" &&
        (wo.closureFieldNotes || wo.closurePartsNotes) && (
          <Card title="Báo cáo từ thợ (chờ nghiệm thu)">
            <div className="space-y-3 text-sm">
              {wo.closureFieldNotes ? (
                <div className="rounded-lg border border-blue-100 bg-blue-50/80 px-3 py-2">
                  <p className="text-xs font-bold text-blue-900 uppercase tracking-wide mb-1">
                    Ghi chú hiện trường / việc đã làm
                  </p>
                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {wo.closureFieldNotes}
                  </p>
                </div>
              ) : null}
              {wo.closurePartsNotes ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2">
                  <p className="text-xs font-bold text-amber-900 uppercase tracking-wide mb-1">
                    Linh kiện đã thay / vật tư cần thay
                  </p>
                  <p className="text-amber-950 whitespace-pre-wrap leading-relaxed">
                    {wo.closurePartsNotes}
                  </p>
                </div>
              ) : null}
            </div>
          </Card>
        )}

      {wo.status === "WAITING" && canAssign && !wo.assignments?.length && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <Info size={18} className="shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-bold text-amber-900">
              Chưa phân công người hiện trường
            </p>
            <p className="mt-1 leading-relaxed">
              Bấm <strong>Phân công</strong> và chọn <strong>Công nhân</strong>{" "}
              hoặc <strong>Nhân viên Kỹ thuật</strong>.
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

      {wo.status === "WAITING" && isAssigned && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
          <span className="font-semibold">Bạn được phân công.</span>{" "}
          <Link
            to={`/checklists?assetId=${wo.assetId}`}
            className="font-bold text-blue-800 underline"
          >
            Tài liệu / QR — #{wo.assetId}
          </Link>
        </div>
      )}

      {wo.recentChecklistsEligible && wo.recentChecklists?.length > 0 && (
        <Card title="Checklist đã duyệt gần đây (tham khảo)">
          <p className="text-xs text-gray-500 mb-3">
            Ba lần kiểm tra đã duyệt gần nhất; vật tư ghi trên phiếu việc.
          </p>
          <ul className="space-y-4">
            {wo.recentChecklists.map((c) => (
              <li
                key={c.checklistId}
                className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2 gap-y-1">
                  <Badge color={CHECKLIST_STATUS_COLOR[c.overallStatus] ?? "gray"}>
                    {c.overallStatus}
                  </Badge>
                  <span className="text-xs font-semibold text-slate-600">
                    #{c.checklistId}
                  </span>
                  <span className="text-xs text-slate-500">
                    {fDateTime(c.checkTime)}
                  </span>
                  {c.checkerName ? (
                    <span className="text-xs text-slate-600">
                      · {c.checkerName}
                    </span>
                  ) : null}
                  {c.readingValue != null && c.readingValue !== "" ? (
                    <span className="text-xs tabular-nums text-slate-700">
                      · Đồng hồ: {fNumber(c.readingValue)} h
                    </span>
                  ) : null}
                </div>
                {c.notes ? (
                  <p className="mt-2 text-slate-800 whitespace-pre-wrap leading-relaxed border-t border-slate-200/80 pt-2">
                    {c.notes}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-400 italic">
                    Không có ghi chú hiện trường.
                  </p>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end">
            <Link
              to={`/checklists?assetId=${wo.assetId}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-900"
            >
              <ClipboardList size={16} aria-hidden />
              Mở trang checklist / QR thiết bị
            </Link>
          </div>
        </Card>
      )}

      {wo.recentChecklistsEligible &&
        (!wo.recentChecklists || wo.recentChecklists.length === 0) &&
        ["WAITING", "IN_PROGRESS", "PAUSED", "AWAITING_CLOSURE"].includes(
          wo.status,
        ) && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-600 flex gap-2 items-start">
            <ClipboardList
              size={16}
              className="shrink-0 text-slate-400 mt-0.5"
              aria-hidden
            />
            <p>Chưa có checklist đã duyệt gần đây cho thiết bị này.</p>
          </div>
        )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Thông tin phiếu" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            {[
              ["Tài sản", wo.assetName],
              ["Vị trí", wo.locationName],
              ["Loại thiết bị", wo.assetTypeName],
              ["Ngày dự kiến", fDate(wo.plannedDate)],
              ["Ngày thực tế", fDate(wo.actualDate)],
              [
                "Giờ ước tính",
                wo.estimatedHours ? `${wo.estimatedHours}h` : "—",
              ],
              [
                "Giờ thực tế",
                wo.actualHours != null && wo.actualHours !== ""
                  ? `${wo.actualHours}h`
                  : "—",
              ],
              ["Nguồn", wo.woSource],
              ...(wo.woSource === "CORRECTIVE" && wo.counterBaselineResetAt
                ? [
                    [
                      "Reset mốc giờ chạy (PM)",
                      `${fDateTime(wo.counterBaselineResetAt)}${
                        wo.counterBaselineResetByName
                          ? ` · ${wo.counterBaselineResetByName}`
                          : ""
                      }`,
                    ],
                  ]
                : []),
            ].map(([l, v]) => (
              <div key={l}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {l}
                </p>
                <p className="font-semibold text-gray-900 mt-1">{v ?? "—"}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <Badge color={WO_STATUS_COLOR[wo.status]}>
              {WO_STATUS_LABEL[wo.status]}
            </Badge>
            <Badge color={WO_PRIORITY_COLOR[wo.priority]}>
              {WO_PRIORITY_LABEL[wo.priority]}
            </Badge>
          </div>
        </Card>

        <Card title="Nhân viên phụ trách">
          {wo.assignments?.length > 0 ? (
            <ul className="space-y-2">
              {wo.assignments.map((a) => (
                <li
                  key={a.employeeId}
                  className="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-xl"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
                    {a.fullName?.[0] ?? "?"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {a.fullName}
                    </p>
                    <p className="text-xs font-medium text-gray-600">
                      {a.positionName}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">Chưa phân công</p>
          )}
        </Card>
      </div>

      {canEditClosureDraft && (
        <Card title="Ghi chú hiện trường & vật tư (lưu nháp)">
          <p className="text-xs text-gray-500 mb-3">
            Lưu nháp khi làm; khi báo hoàn thành nội dung gửi kèm phiếu.
          </p>
          <div className="space-y-4">
            <Textarea
              label="Ghi chú hiện trường / việc đã làm"
              placeholder="Tình trạng, thao tác đã thực hiện..."
              value={closureFieldNotes}
              onChange={(e) => setClosureFieldNotes(e.target.value)}
              rows={3}
            />
            <Textarea
              label="Linh kiện đã thay / vật tư cần thay"
              placeholder="Ví dụ: thay phớt; đặt mua lọc..."
              value={closurePartsNotes}
              onChange={(e) => setClosurePartsNotes(e.target.value)}
              rows={3}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={saveClosureDraft}
                loading={saving}
              >
                Lưu nháp
              </Button>
            </div>
          </div>
        </Card>
      )}

      {["IN_PROGRESS", "AWAITING_CLOSURE"].includes(wo.status) && (
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
              <span className="text-xs text-gray-500">
                JPG / PNG / WEBP, tối đa 15 ảnh/lần, mỗi file ≤ 10MB
              </span>
            </div>
          )}
          {!wo.photos?.length && (
            <p className="text-sm text-gray-400">Chưa có ảnh.</p>
          )}
          {wo.photos?.length > 0 && (
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {wo.photos.map((p) => {
                const src = woPhotoSrc(p.filePath);
                const own =
                  p.uploadedBy != null &&
                  Number(p.uploadedBy) === Number(user?.employeeId);
                const canDel = canUploadPhotos && (own || isTcPlus);
                return (
                  <li
                    key={p.photoId}
                    className="relative group rounded-xl border border-gray-200 overflow-hidden bg-gray-50"
                  >
                    <a
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-square"
                    >
                      <img
                        src={src}
                        alt=""
                        className="w-full h-full object-cover"
                      />
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
                      {p.uploadedByName ?? "—"} ·{" "}
                      {p.createdAt ? fDateTime(p.createdAt) : ""}
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
            {approvals.map((a) => (
              <div
                key={a.logId}
                className="flex items-start gap-3 text-sm bg-gray-50 rounded-xl px-4 py-3"
              >
                <Badge
                  color={
                    a.status === "APPROVED"
                      ? "green"
                      : a.status === "REJECTED"
                        ? "red"
                        : a.status === "REQUEST_CHANGES"
                          ? "orange"
                          : "yellow"
                  }
                >
                  Bước {a.currentLevel}
                  {a.stepPositionName
                    ? ` · ${a.stepPositionName}`
                    : ""}
                </Badge>
                <div>
                  <p className="font-semibold text-gray-900">
                    {a.approverName ?? "Chờ phê duyệt"} ·{" "}
                    <span className="font-normal text-gray-600">
                      {fDateTime(a.actionDate)}
                    </span>
                  </p>
                  {a.comment && (
                    <p className="font-medium text-gray-700 text-xs mt-1">
                      &quot;{a.comment}&quot;
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Phân công nhân viên"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            Công nhân / NV Kỹ thuật thực hiện tại hiện trường.
          </p>
          <Select
            label="Nhân viên thực hiện"
            value={selectedEmp}
            onChange={(e) => setSelectedEmp(e.target.value)}
          >
            <option value="">— Chọn nhân viên —</option>
            {employees.map((e) => {
              const onLeave = Boolean(e.onScheduledLeave);
              return (
                <option
                  key={e.employeeId}
                  value={e.employeeId}
                  disabled={onLeave}
                >
                  {e.fullName} — {e.positionName}
                  {onLeave ? " (đang nghỉ có lịch)" : ""}
                </option>
              );
            })}
          </Select>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setAssignOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleAssign} loading={saving}>
              Phân công
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={awaitingOpen}
        onClose={() => setAwaitingOpen(false)}
        title="Báo hoàn thành (chờ nghiệm thu)"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Gửi ghi chú, vật tư và ảnh để Trưởng ca/TP nghiệm thu.
          </p>
          <Textarea
            label="Ghi chú hiện trường / việc đã làm *"
            placeholder="Tình trạng sau xử lý, thao tác đã thực hiện..."
            value={closureFieldNotes}
            onChange={(e) => setClosureFieldNotes(e.target.value)}
            rows={3}
          />
          <Textarea
            label="Linh kiện đã thay / vật tư cần thay (tuỳ chọn)"
            placeholder="Ví dụ: thay dây curoa A-123; đặt mua lọc dầu..."
            value={closurePartsNotes}
            onChange={(e) => setClosurePartsNotes(e.target.value)}
            rows={3}
          />
          <Input
            label="Giờ thực tế (tuỳ chọn)"
            type="text"
            inputMode="decimal"
            placeholder="Để trống = tự tính"
            value={awaitingHours}
            onChange={(e) => setAwaitingHours(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setAwaitingOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="success"
              onClick={submitAwaitingClosure}
              loading={saving}
            >
              Gửi
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Nghiệm thu — đóng phiếu"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">Xác nhận nghiệm thu; có thể chỉnh giờ thực tế.</p>
          <Input
            label="Giờ thực tế (tuỳ chọn)"
            type="text"
            inputMode="decimal"
            placeholder="Để trống = giữ theo báo cáo thợ"
            value={closeHours}
            onChange={(e) => setCloseHours(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCloseOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="success"
              onClick={submitCloseWorkOrder}
              loading={saving}
            >
              Đóng phiếu
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={approveOpen}
        onClose={() => {
          setApproveOpen(false);
          setApproveAssignEmp("");
        }}
        title="Xử lý phê duyệt"
        size="sm"
      >
        <div className="space-y-4">
          {twoStepApproval && pendingApprovalLog && (
            <p className="text-xs text-gray-600 rounded-lg bg-gray-50 px-3 py-2 border border-gray-100">
              Bước {pendingApprovalLog.currentLevel}/{pendingApprovalLog.totalLevels}
              {pendingApprovalLog.stepPositionName ? ` — ${pendingApprovalLog.stepPositionName}` : ""}
              {Number(pendingApprovalLog.currentLevel) === 2 ? ` · ${tpStepName} có thể đổi người phân công khi duyệt.` : ""}
            </p>
          )}
          <Select
            label="Hành động"
            value={approveAction}
            onChange={(e) => setApproveAction(e.target.value)}
          >
            <option value="APPROVED">Duyệt</option>
            <option value="REJECTED">Từ chối</option>
            <option value="REQUEST_CHANGES">Yêu cầu chỉnh sửa</option>
          </Select>
          {isWoFinalApprovalStep &&
            approveAction === "APPROVED" && (
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-3 space-y-2">
                <Select
                  label="Phân công ngay (tuỳ chọn)"
                  value={approveAssignEmp}
                  onChange={(e) => setApproveAssignEmp(e.target.value)}
                >
                  <option value="">
                    — Để sau: Phân công trên phiếu —
                  </option>
                  {approveFieldEmployees.map((e) => {
                    const onLeave = Boolean(e.onScheduledLeave);
                    return (
                      <option
                        key={e.employeeId}
                        value={e.employeeId}
                        disabled={onLeave}
                      >
                        {e.fullName} — {e.positionName}
                        {onLeave ? " (đang nghỉ có lịch)" : ""}
                      </option>
                    );
                  })}
                </Select>
                <p className="text-xs text-blue-900/85 leading-relaxed">
                  Chỉ ở <strong>bước duyệt cuối</strong>. Chọn người để vừa duyệt
                  vừa gửi thông báo phân công; để trống nếu sẽ giao việc sau.
                </p>
              </div>
            )}
          <Textarea
            label="Ghi chú"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Nhập lý do (bắt buộc khi từ chối)"
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setApproveOpen(false)}>
              Hủy
            </Button>
            <Button
              variant={
                approveAction === "APPROVED"
                  ? "success"
                  : approveAction === "REJECTED"
                    ? "danger"
                    : "primary"
              }
              onClick={handleApprove}
              loading={saving}
            >
              {approveAction === "APPROVED"
                ? "Duyệt"
                : approveAction === "REJECTED"
                  ? "Từ chối"
                  : "Yêu cầu sửa"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={editWoOpen}
        onClose={() => setEditWoOpen(false)}
        title="Chỉnh sửa phiếu (trước khi gửi lại phê duyệt)"
        size="lg"
      >
        {wo && (
          <WorkOrderForm
            wo={wo}
            assets={woEditAssets}
            onSuccess={() => {
              setEditWoOpen(false);
              toast.success("Đã cập nhật phiếu — bấm «Gửi lại phê duyệt» khi sẵn sàng.");
              load();
            }}
            onCancel={() => setEditWoOpen(false)}
          />
        )}
      </Modal>
    </div>
  );
}
