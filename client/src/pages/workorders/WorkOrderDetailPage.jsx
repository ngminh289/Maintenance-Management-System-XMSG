/**
 * WorkOrderDetailPage.jsx — Chi tiết WO.
 * Phân công cá nhân hoặc nhóm (với trưởng nhóm).
 * Chỉ trưởng nhóm (IsGroupLeader) mới bắt đầu phiếu và ghi chú vật tư.
 * Trưởng ca / Trưởng phòng: phân công, nghiệm thu, đóng phiếu.
 * Link checklist: WO từ lịch (SCHEDULE) kèm woId; banner nhắc checklist hiển thị mọi trạng thái trừ hoàn thành/hủy.
 * woLinkedChecklist: bản checklist mới nhất gắn WO (mọi thành viên nhóm thấy khi đồng nghiệp đã nộp). Duyệt WO: nhập Giờ ước tính (POST approve).
 * Soft-delete (mig 070): isDeleted=1 → hiển thị banner Đã lưu trữ, ẩn mọi action; chỉ Admin có nút Khôi phục.
 */
import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
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
  Star,
  Archive,
  ArchiveRestore,
  Users,
} from "lucide-react";
import { EmployeeCard } from "../../components/ui/EmployeeCard.jsx";
import { workOrderApi } from "../../api/workOrder.api.js";
import { employeeApi } from "../../api/employee.api.js";
import { assetApi } from "../../api/asset.api.js";
import { approvalApi } from "../../api/approval.api.js";
import { api } from "../../api/index.js";
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
  toDateInputValue,
  CHECKLIST_STATUS_COLOR,
  APPROVAL_STATUS_COLOR,
} from "../../utils/format.js";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import {
  canDo,
  canAssignWorkOrder,
  LEVEL_TRUONG_CA,
  canEditWorkOrderRow,
  canDeleteWorkOrderRow,
  canRestoreWorkOrder,
} from "../../utils/rbac.js";
import toast from "react-hot-toast";

const ASSIGNEE_MAX_LEVEL = 2;

const API_ORIGIN = (
  import.meta.env.VITE_API_BASE || "http://localhost:4000/api"
).replace(/\/?api\/?$/, "");

function woPhotoSrc(filePath) {
  if (!filePath) return "";
  const p = String(filePath).trim();
  if (/^https?:\/\//i.test(p)) return p;
  const rel = p.replace(/^\/+/, "");
  return `${API_ORIGIN.replace(/\/$/, "")}/${rel}`;
}

/** Popover danh sách thành viên nhóm (phân công WO). */
function GroupMembersPopover({ members, loading, error }) {
  if (loading) {
    return (
      <p className="px-3 py-2 text-xs text-gray-500">Đang tải thành viên…</p>
    );
  }
  if (error) {
    return (
      <p className="px-3 py-2 text-xs text-red-600">Không tải được thành viên</p>
    );
  }
  if (!members?.length) {
    return (
      <p className="px-3 py-2 text-xs text-gray-500">Nhóm chưa có thành viên</p>
    );
  }
  return (
    <ul className="max-h-52 overflow-y-auto py-1 divide-y divide-gray-100">
      {members.map((m) => {
        const isLeader = Number(m.isGroupLeader) === 1;
        return (
          <li
            key={m.employeeId}
            className={`px-3 py-2 text-xs ${isLeader ? "bg-amber-50/80" : ""}`}
          >
            <p className="font-semibold text-gray-900">
              {m.fullName}
              {isLeader && (
                <span className="ml-1.5 text-[10px] font-bold text-amber-800 bg-amber-100 px-1 py-0.5 rounded">
                  TN
                </span>
              )}
            </p>
            <p className="text-gray-500 mt-0.5 truncate">
              {m.positionName}
              {m.empSpecialty ? ` · ${m.empSpecialty}` : ""}
              {m.craftLevel ? ` · Bậc ${m.craftLevel}` : ""}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/** Một dòng nhóm trong modal phân công — nút Users mở modal thành viên. */
function MaintenanceGroupAssignRow({ group, selected, onSelect, onViewMembers }) {
  const g = group;
  return (
    <div
      className={`flex items-stretch border-b border-gray-100 last:border-0 ${
        selected ? "bg-blue-50" : "hover:bg-gray-50"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 flex items-center gap-3 px-3 py-2.5 text-left min-w-0"
      >
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
            selected ? "bg-blue-600 text-white" : "bg-indigo-100 text-indigo-700"
          }`}
        >
          {g.groupName?.[0] ?? "N"}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-semibold ${selected ? "text-blue-700" : "text-gray-900"}`}
          >
            {g.groupName}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {g.memberCount ?? 0} thành viên
            {g.specialty ? ` · ${g.specialty}` : ""}
            {g.leaderName ? ` · TN: ${g.leaderName}` : " · Chưa có trưởng nhóm"}
          </p>
        </div>
        {selected && (
          <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded flex-shrink-0">
            ✓
          </span>
        )}
      </button>
      <button
        type="button"
        title="Xem thành viên nhóm"
        onClick={(e) => {
          e.stopPropagation();
          onViewMembers();
        }}
        className="px-2.5 flex items-center justify-center border-l border-gray-100 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
      >
        <Users size={16} />
      </button>
    </div>
  );
}

export function WorkOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [wo, setWo] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [approvals, setApprovals] = useState([]);
  const [approvalWorkflowSteps, setApprovalWorkflowSteps] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMode, setAssignMode] = useState("individual"); // "individual" | "group"
  const [assignSpecialty, setAssignSpecialty] = useState("");
  const [assignCraftLevel, setAssignCraftLevel] = useState("");
  const [assignGroupFilter, setAssignGroupFilter] = useState(""); // lọc chuyên môn nhóm
  const [selectedGroup, setSelectedGroup] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  /** Cache thành viên theo groupId — modal xem thành viên khi phân công */
  const [groupMembersCache, setGroupMembersCache] = useState({});
  const [groupMembersModal, setGroupMembersModal] = useState(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState("");
  const [approveAction, setApproveAction] = useState("APPROVED");
  const [comment, setComment] = useState("");
  const [approveAssignMode, setApproveAssignMode] = useState("individual");
  const [approveAssignEmp, setApproveAssignEmp] = useState("");
  const [approveAssignGroup, setApproveAssignGroup] = useState("");
  const [approveGroupMembers, setApproveGroupMembers] = useState([]);
  const [approveEstimatedHours, setApproveEstimatedHours] = useState("");
  const [approvePlannedDate, setApprovePlannedDate] = useState("");
  const [approvePriority, setApprovePriority] = useState("");
  const [approveDescription, setApproveDescription] = useState("");
  const [approveFieldEmployees, setApproveFieldEmployees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [awaitingOpen, setAwaitingOpen] = useState(false);
  const [awaitingHours, setAwaitingHours] = useState("");
  const [closureFieldNotes, setClosureFieldNotes] = useState("");
  const [closurePartsNotes, setClosurePartsNotes] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeHours, setCloseHours] = useState("");
  const [shutdownReason, setShutdownReason] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [editWoOpen, setEditWoOpen] = useState(false);

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
    api
      .get("/maintenance-groups")
      .then((r) => {
        setGroups(r.data.data?.items ?? r.data.data ?? []);
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!wo) return;
    setClosureFieldNotes(wo.closureFieldNotes ?? "");
    setClosurePartsNotes(wo.closurePartsNotes ?? "");
  }, [wo?.woId, wo?.closureFieldNotes, wo?.closurePartsNotes]);

  const pendingApprovalLog = approvals.find((a) => a.status === "PENDING");
  const woArchivedFlag = Number(wo?.isDeleted) === 1;
  const needsResubmitApproval =
    !woArchivedFlag &&
    wo?.status === "PENDING_APPROVAL" &&
    !pendingApprovalLog;
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
    if (!approveOpen || !wo) return;
    setApproveEstimatedHours(
      wo.estimatedHours != null && wo.estimatedHours !== ""
        ? String(wo.estimatedHours)
        : "",
    );
    setApprovePlannedDate(
      toDateInputValue(wo.plannedDate),
    );
    setApprovePriority(wo.priority || "");
    setApproveDescription(wo.description || "");
  }, [approveOpen, wo?.woId, wo?.estimatedHours]);

  useEffect(() => {
    if (!approveOpen || approveAssignMode !== "group" || !approveAssignGroup) {
      setApproveGroupMembers([]);
      return;
    }
    api
      .get(`/maintenance-groups/${approveAssignGroup}`)
      .then((r) => setApproveGroupMembers(r.data.data?.members ?? []))
      .catch(() => setApproveGroupMembers([]));
  }, [approveOpen, approveAssignMode, approveAssignGroup]);

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
      toast.error(
        err.response?.data?.message ?? "Không gửi lại được phê duyệt",
      );
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status, extra = {}) => {
    if (!confirm(`Chuyển sang «${WO_STATUS_LABEL[status] ?? status}»?`)) return;
    try {
      await workOrderApi.changeStatus(id, status, extra);
      toast.success("Đã cập nhật");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi");
    }
  };

  const setPowerState = async (action) => {
    try {
      await workOrderApi.setPowerState(
        id,
        action,
        shutdownReason.trim() || undefined,
      );
      toast.success(action === "SHUTDOWN" ? "Đã ghi nhận tắt máy" : "Đã ghi nhận bật máy");
      if (action === "SHUTDOWN") setShutdownReason("");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Không cập nhật được trạng thái máy");
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

  const handleSoftDelete = async () => {
    setArchiveBusy(true);
    try {
      await workOrderApi.remove(id);
      toast.success(`Đã chuyển phiếu WO-${String(wo?.woId ?? id).padStart(4, "0")} vào lưu trữ`);
      setDeleteOpen(false);
      navigate("/work-orders");
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Không thể xoá phiếu việc");
    } finally {
      setArchiveBusy(false);
    }
  };

  const handleRestore = async () => {
    setArchiveBusy(true);
    try {
      await workOrderApi.restore(id);
      toast.success(`Đã khôi phục phiếu WO-${String(wo?.woId ?? id).padStart(4, "0")}`);
      setRestoreOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Không thể khôi phục phiếu");
    } finally {
      setArchiveBusy(false);
    }
  };

  const handleAssign = async () => {
    if (assignMode === "group") {
      if (!selectedGroup) {
        toast.error("Chọn nhóm");
        return;
      }
      setSaving(true);
      try {
        await workOrderApi.assignGroup(id, Number(selectedGroup));
        toast.success("Đã phân công nhóm");
        setAssignOpen(false);
        load();
      } catch (err) {
        toast.error(err.response?.data?.message ?? "Lỗi phân công nhóm");
      } finally {
        setSaving(false);
      }
    } else {
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
    }
  };

  const openGroupMembersModal = (g) => {
    const key = String(g.groupId);
    const cached = groupMembersCache[key];
    if (cached?.fetched) {
      setGroupMembersModal({
        groupId: g.groupId,
        groupName: g.groupName,
        loading: false,
        members: cached.members ?? [],
        error: !!cached.error,
      });
      return;
    }
    setGroupMembersModal({
      groupId: g.groupId,
      groupName: g.groupName,
      loading: true,
      members: undefined,
      error: false,
    });
  };

  useEffect(() => {
    const groupId = groupMembersModal?.groupId;
    if (!groupId || !groupMembersModal.loading) return;

    let cancelled = false;
    (async () => {
      try {
        const r = await api.get(`/maintenance-groups/${groupId}`);
        if (cancelled) return;
        const members = r.data.data?.members ?? [];
        const key = String(groupId);
        setGroupMembersCache((prev) => ({
          ...prev,
          [key]: { fetched: true, members },
        }));
        setGroupMembersModal((prev) =>
          prev && String(prev.groupId) === String(groupId)
            ? { ...prev, loading: false, members, error: false }
            : prev,
        );
      } catch {
        if (cancelled) return;
        const key = String(groupId);
        setGroupMembersCache((prev) => ({
          ...prev,
          [key]: { fetched: true, members: [], error: true },
        }));
        setGroupMembersModal((prev) =>
          prev && String(prev.groupId) === String(groupId)
            ? { ...prev, loading: false, members: [], error: true }
            : prev,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [groupMembersModal?.groupId, groupMembersModal?.loading]);

  /** Chọn nhóm — dùng cache nếu đã hover/xem thành viên trước đó */
  const handleSelectGroup = async (gid) => {
    setSelectedGroup(gid);
    setGroupMembers([]);
    if (!gid) return;
    const key = String(gid);
    const cached = groupMembersCache[key];
    if (cached?.fetched) {
      setGroupMembers(cached.members ?? []);
      return;
    }
    try {
      const r = await api.get(`/maintenance-groups/${gid}`);
      const members = r.data.data?.members ?? [];
      setGroupMembers(members);
      setGroupMembersCache((prev) => ({
        ...prev,
        [key]: { loading: false, fetched: true, members },
      }));
    } catch {
      toast.error("Không tải được thành viên nhóm");
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
          approveAction === "APPROVED" &&
          approveAssignMode === "individual" &&
          approveAssignEmp
            ? approveAssignEmp
            : undefined,
        assignGroupId:
          approveAction === "APPROVED" &&
          approveAssignMode === "group" &&
          approveAssignGroup
            ? approveAssignGroup
            : undefined,
        estimatedHours:
          approveAction === "APPROVED" &&
          String(approveEstimatedHours).trim() !== ""
            ? approveEstimatedHours
            : undefined,
        plannedDate:
          approveAction === "APPROVED" ? approvePlannedDate : undefined,
        priority:
          approveAction === "APPROVED" && String(approvePriority).trim() !== ""
            ? approvePriority
            : undefined,
        description:
          approveAction === "APPROVED" ? approveDescription : undefined,
      });
      toast.success("Đã xử lý phê duyệt");
      setApproveOpen(false);
      setComment("");
      setApproveAssignMode("individual");
      setApproveAssignEmp("");
      setApproveAssignGroup("");
      setApproveGroupMembers([]);
      setApproveEstimatedHours("");
      setApprovePlannedDate("");
      setApprovePriority("");
      setApproveDescription("");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi phê duyệt");
    } finally {
      setSaving(false);
    }
  };

  const checklistForAssetHref = useMemo(() => {
    if (!wo) return "/checklists";
    const q = new URLSearchParams({ assetId: String(wo.assetId) });
    const source = String(wo.woSource || "").toUpperCase();
    const scheduleChecklistSource =
      source === "SCHEDULE" ||
      source === "PREDICTIVE_SCHEDULE" ||
      (source === "PREDICTIVE" && wo.scheduleId != null);
    if (scheduleChecklistSource && wo.scheduleId != null) {
      q.set("woId", String(wo.woId));
      const openSlot = (
        wo.checklistRequirements?.length
          ? wo.checklistRequirements
          : wo.checklistSlots || []
      ).find((s) =>
        ["OPEN", "OVERDUE"].includes(String(s.status).toUpperCase()),
      );
      if (openSlot?.templateId) {
        q.set("templateId", String(openSlot.templateId));
      }
    }
    return `/checklists?${q.toString()}`;
  }, [wo]);

  const checklistPendingByTemplate = useMemo(() => {
    const linked = Array.isArray(wo?.woLinkedChecklists)
      ? wo.woLinkedChecklists
      : wo?.woLinkedChecklist
        ? [wo.woLinkedChecklist]
        : [];
    const m = new Map();
    for (const cl of linked) {
      if (String(cl.reviewStatus || "").toUpperCase() === "PENDING") {
        m.set(Number(cl.templateId), cl);
      }
    }
    return m;
  }, [wo?.woLinkedChecklists, wo?.woLinkedChecklist]);

  if (loading) return <PageLoader />;
  if (!wo)
    return (
      <div className="text-center py-20 text-gray-400">
        Không tìm thấy phiếu việc
      </div>
    );

  /** Soft-delete: phiếu đã lưu trữ — chỉ Admin xem chi tiết, mọi action ẩn trừ Khôi phục. */
  const isArchived = Number(wo.isDeleted) === 1;
  const canEditWo = !isArchived && canEditWorkOrderRow(user, wo);
  const canSoftDeleteWo = !isArchived && canDeleteWorkOrderRow(user, wo);
  const canRestoreWo = isArchived && canRestoreWorkOrder(user);

  const isAssigned = wo.assignments?.some(
    (a) => Number(a.employeeId) === Number(user?.employeeId),
  );
  /** Người dùng hiện tại là trưởng nhóm của phiếu này */
  const amGroupLeader = wo.assignments?.some(
    (a) =>
      Number(a.employeeId) === Number(user?.employeeId) &&
      Number(a.isGroupLeader) === 1,
  );
  const isTcPlus = (user?.positionLevel ?? 0) >= LEVEL_TRUONG_CA;
  const canUpdate = !isArchived && canDo(user, "WORK_ORDER:UPDATE");
  /** Bắt đầu / tạm dừng / tiếp tục: chỉ trưởng nhóm hoặc TC+ */
  const canAcceptWork = canUpdate && (amGroupLeader || isTcPlus);
  const canSuperviseFlow = canUpdate && (isAssigned || isTcPlus);
  /** Báo hoàn thành: trưởng nhóm hoặc TC+ */
  const canReportAwaiting =
    canUpdate && (amGroupLeader || isTcPlus) && wo.status === "IN_PROGRESS";
  const canUploadPhotos =
    canUpdate && (isAssigned || isTcPlus) && wo.status === "IN_PROGRESS";
  const canCloseAfterReview =
    canUpdate && isTcPlus && wo.status === "AWAITING_CLOSURE";
  const canReopenFromAwaiting =
    canUpdate && isTcPlus && wo.status === "AWAITING_CLOSURE";
  const canApprove =
    !isArchived &&
    wo.status === "PENDING_APPROVAL" &&
    canDo(user, "WORK_ORDER:APPROVE");
  const canAssign = !isArchived && canAssignWorkOrder(user);
  /** Ghi chú vật tư: chỉ trưởng nhóm hoặc TC+ */
  const canEditClosureDraft =
    canUpdate &&
    (amGroupLeader || isTcPlus) &&
    ["WAITING", "IN_PROGRESS", "PAUSED"].includes(wo.status);
  const canResetRuntimeBaseline =
    wo.woSource === "CORRECTIVE" &&
    !wo.counterBaselineResetAt &&
    ["IN_PROGRESS", "PAUSED"].includes(wo.status) &&
    canUpdate &&
    (amGroupLeader || isTcPlus);
  const canControlMachinePower =
    canUpdate &&
    (amGroupLeader || isTcPlus) &&
    ["IN_PROGRESS", "PAUSED", "AWAITING_CLOSURE"].includes(wo.status);
  const machinePowerState = String(wo.machinePowerState || "STARTUP").toUpperCase();
  const machineIsShutdown = machinePowerState === "SHUTDOWN";
  const source = String(wo.woSource || "").toUpperCase();
  const checklistSlots = Array.isArray(wo.checklistSlots)
    ? wo.checklistSlots
    : wo.checklistSlot
      ? [wo.checklistSlot]
      : [];
  const checklistRequirements =
    Array.isArray(wo.checklistRequirements) && wo.checklistRequirements.length
      ? wo.checklistRequirements
      : checklistSlots.filter((s) => s.templateId != null);
  const hasChecklistRequirement =
    (source === "SCHEDULE" ||
      source === "PREDICTIVE_SCHEDULE" ||
      (source === "PREDICTIVE" && wo.scheduleId != null)) &&
    wo.scheduleId != null &&
    checklistRequirements.length > 0 &&
    !["COMPLETED", "CANCELLED"].includes(wo.status);
  const checklistDueDate =
    checklistRequirements[0]?.dueDate || checklistSlots[0]?.dueDate || null;
  const fulfilledCount = checklistRequirements.filter((s) =>
    ["FULFILLED", "WAIVED"].includes(String(s.status).toUpperCase()),
  ).length;
  const totalRequired = checklistRequirements.length;
  const checklistDone =
    wo.checklistRequirementsMet === true ||
    (totalRequired > 0 && fulfilledCount >= totalRequired);
  const woLinkedChecklists = Array.isArray(wo.woLinkedChecklists)
    ? wo.woLinkedChecklists
    : wo.woLinkedChecklist
      ? [wo.woLinkedChecklist]
      : [];
  const checklistPendingCount = checklistPendingByTemplate.size;
  const checklistStillToDoCount = checklistRequirements.filter((req) => {
    const st = String(req.status || "").toUpperCase();
    if (["FULFILLED", "WAIVED"].includes(st)) return false;
    if (checklistPendingByTemplate.has(Number(req.templateId))) return false;
    return ["OPEN", "OVERDUE"].includes(st) || req.slotMissing;
  }).length;
  const checklistPendingReview =
    !checklistDone && checklistPendingCount > 0;
  const anyWoLinkedChecklistApproved = woLinkedChecklists.some(
    (c) => String(c.reviewStatus || "").toUpperCase() === "APPROVED",
  );
  const canSeeWoLinkedChecklist =
    isTcPlus || amGroupLeader || anyWoLinkedChecklistApproved;

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
            <>
              <Button
                size="sm"
                onClick={() =>
                  changeStatus("IN_PROGRESS", {
                    requiresShutdown: true,
                    shutdownReason: shutdownReason.trim() || undefined,
                  })
                }
              >
                <Play size={13} /> Nhận việc + Tắt máy
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => changeStatus("IN_PROGRESS", { requiresShutdown: false })}
              >
                <Play size={13} /> Nhận việc + Giữ máy chạy
              </Button>
            </>
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
                setApproveAssignMode("individual");
                setApproveAssignEmp("");
                setApproveAssignGroup("");
                setApproveGroupMembers([]);
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
            <Button size="sm" onClick={handleResubmitApproval} loading={saving}>
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
          {canEditWo && !canEditPendingResubmit && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEditWoOpen(true)}
            >
              <Pencil size={13} /> Sửa phiếu
            </Button>
          )}
          {canSoftDeleteWo && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 size={13} /> Xoá phiếu
            </Button>
          )}
          {canRestoreWo && (
            <Button
              size="sm"
              variant="success"
              onClick={() => setRestoreOpen(true)}
            >
              <ArchiveRestore size={13} /> Khôi phục
            </Button>
          )}
        </div>
      </div>

      {isArchived && (
        <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50/95 px-4 py-3 text-sm text-amber-950">
          <Archive size={20} className="shrink-0 text-amber-700 mt-0.5" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-amber-900">Phiếu việc đã được lưu trữ</p>
            <p className="mt-1 leading-relaxed">
              Phiếu này đã chuyển vào kho lưu trữ — chỉ Quản trị viên mới xem được. Mọi
              thao tác (sửa, phân công, chuyển trạng thái, phê duyệt) đã bị khoá để bảo
              toàn lịch sử dữ liệu.
              {wo.deletedAt && (
                <>
                  {" "}
                  Lưu trữ lúc <strong>{fDateTime(wo.deletedAt)}</strong>
                  {wo.deletedByName ? (
                    <> bởi <strong>{wo.deletedByName}</strong></>
                  ) : null}
                  .
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {hasChecklistRequirement && (
        <div className="flex gap-3 rounded-xl border border-teal-200 bg-teal-50/90 px-4 py-3 text-sm text-teal-950">
          <ClipboardList
            size={18}
            className="shrink-0 text-teal-600 mt-0.5"
            aria-hidden
          />
          <div>
            <p className="font-bold text-teal-900">
              {String(wo.woSource || "").toUpperCase() ===
                "PREDICTIVE_SCHEDULE" ||
              (String(wo.woSource || "").toUpperCase() === "PREDICTIVE" &&
                wo.scheduleId != null)
                ? "Checklist dự báo đính kèm"
                : "Checklist định kỳ đính kèm"}
            </p>
            {wo.checklistSlotSyncWarning && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {wo.checklistSlotSyncWarning}
              </p>
            )}
            <p className="mt-1 leading-relaxed">
              {checklistDone
                ? totalRequired > 1
                  ? `Đã hoàn thành và xác nhận đủ ${totalRequired} mẫu checklist.`
                  : "Checklist đã được thực hiện và xác nhận."
                : checklistPendingReview && checklistStillToDoCount > 0
                  ? `Đã nộp ${checklistPendingCount + fulfilledCount}/${totalRequired} mẫu — ${checklistPendingCount} chờ duyệt. Vẫn cần làm ${checklistStillToDoCount} mẫu còn lại (bên dưới).`
                  : checklistPendingReview
                    ? `Đã nộp ${checklistPendingCount}/${totalRequired} mẫu — đang chờ giám sát duyệt.`
                    : totalRequired > 1
                      ? `Cần hoàn thành ${totalRequired} mẫu checklist (${fulfilledCount}/${totalRequired} đã duyệt xong).`
                      : "Checklist chưa được thực hiện. Vui lòng hoàn tất checklist hiện trường cho phiếu này."}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge
                color={
                  checklistDone
                    ? "green"
                    : checklistPendingReview && checklistStillToDoCount === 0
                      ? "orange"
                      : checklistStillToDoCount > 0
                        ? "yellow"
                        : "orange"
                }
              >
                {checklistDone
                  ? "Đã thực hiện"
                  : checklistStillToDoCount > 0
                    ? `Còn ${checklistStillToDoCount} mẫu`
                    : checklistPendingReview
                      ? "Chờ duyệt"
                      : "Chưa thực hiện"}
              </Badge>
              {checklistDueDate && (
                <Badge color="blue">
                  Hạn checklist: {fDate(checklistDueDate)}
                </Badge>
              )}
            </div>
            {!checklistDone && (
              <div className="mt-3 space-y-2">
                {checklistRequirements.length > 0 ? (
                  checklistRequirements.map((slot) => {
                    const st = String(slot.status || "").toUpperCase();
                    const done = ["FULFILLED", "WAIVED"].includes(st);
                    const open = ["OPEN", "OVERDUE"].includes(st);
                    const pendingCl = checklistPendingByTemplate.get(
                      Number(slot.templateId),
                    );
                    const q = new URLSearchParams({
                      assetId: String(wo.assetId),
                      woId: String(wo.woId),
                    });
                    if (slot.templateId != null) {
                      q.set("templateId", String(slot.templateId));
                    }
                    return (
                      <div
                        key={slot.slotId ?? `${slot.templateId}-${st}`}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-teal-100 bg-white/70 px-3 py-2"
                      >
                        <span className="font-medium text-teal-950">
                          {slot.templateName ||
                            (slot.templateId
                              ? `Mẫu #${slot.templateId}`
                              : "Checklist")}
                        </span>
                        <Badge
                          color={
                            done
                              ? "green"
                              : pendingCl
                                ? "orange"
                                : st === "OVERDUE"
                                  ? "red"
                                  : "yellow"
                          }
                        >
                          {done
                            ? "Đã duyệt xong"
                            : pendingCl
                              ? "Chờ duyệt"
                              : st === "OVERDUE"
                                ? "Quá hạn"
                                : "Chưa làm"}
                        </Badge>
                        {pendingCl && (
                          <Link
                            to={`/checklists/history?assetId=${wo.assetId}&checklistId=${pendingCl.checklistId}`}
                            className="text-sm font-semibold text-violet-800 underline"
                          >
                            Xem bản đã nộp
                          </Link>
                        )}
                        {open && !pendingCl && (
                          <Link
                            to={`/checklists?${q.toString()}`}
                            className="text-sm font-semibold text-teal-900 underline hover:no-underline"
                          >
                            Mở checklist mẫu này
                          </Link>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <Link
                    to={checklistForAssetHref}
                    className="inline-block text-sm font-semibold text-teal-900 underline hover:no-underline"
                  >
                    Mở trang checklist — tài sản #{wo.assetId}
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {wo.recentChecklistsEligible &&
        woLinkedChecklists.length > 0 &&
        canSeeWoLinkedChecklist && (
          <Card title="Checklist đã nộp cho phiếu này">
            <div className="space-y-3">
              {woLinkedChecklists.map((cl) => (
                <div
                  key={cl.checklistId}
                  className="rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-3 text-sm space-y-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      color={
                        CHECKLIST_STATUS_COLOR[cl.overallStatus] ?? "gray"
                      }
                    >
                      {cl.overallStatus}
                    </Badge>
                    <Badge
                      color={
                        APPROVAL_STATUS_COLOR[cl.reviewStatus] ?? "yellow"
                      }
                    >
                      {cl.reviewStatus === "PENDING"
                        ? "Chờ duyệt"
                        : cl.reviewStatus === "APPROVED"
                          ? "Đã duyệt"
                          : cl.reviewStatus === "REJECTED"
                            ? "Từ chối"
                            : cl.reviewStatus}
                    </Badge>
                    <span className="text-xs font-mono text-gray-500">
                      #{cl.checklistId}
                    </span>
                  </div>
                  <p className="text-gray-800">
                    <span className="font-semibold">
                      {cl.checkerName ?? "—"}
                    </span>
                    <span className="text-gray-500">
                      {" "}
                      · {fDateTime(cl.checkTime)}
                    </span>
                  </p>
                  {cl.templateName && (
                    <p className="text-xs text-gray-600">
                      Mẫu: {cl.templateName}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Link
                      to={`/checklists/history?assetId=${wo.assetId}&checklistId=${cl.checklistId}`}
                      className="text-sm font-semibold text-violet-800 underline"
                    >
                      Xem chi tiết / ảnh câu hỏi
                    </Link>
                    {canDo(user, "CHECKLIST_RESULT:APPROVE") &&
                      cl.reviewStatus === "PENDING" && (
                        <Link
                          to={`/checklists/review?checklistId=${cl.checklistId}`}
                          className="text-sm font-semibold text-blue-700 underline"
                        >
                          Mở tiếp nhận checklist
                        </Link>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

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
              Thời điểm: <strong>{fDateTime(wo.counterBaselineResetAt)}</strong>
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
          <p className="font-bold text-amber-950 mb-1">Chờ gửi lại phê duyệt</p>
          <p className="leading-relaxed text-amber-900/95">
            Giám sát đã yêu cầu chỉnh sửa hoặc luồng duyệt tạm dừng — phiếu vẫn
            ở trạng thái «Chờ duyệt» nhưng không còn bước đang chờ. Hãy{" "}
            <strong>sửa nội dung phiếu</strong> (nếu cần) rồi{" "}
            <strong>gửi lại phê duyệt</strong>: hệ thống tạo yêu cầu mới từ{" "}
            <strong>bước 1 — Trưởng ca</strong>; phiếu <strong>hai cấp</strong>{" "}
            (khẩn) sau đó vẫn qua <strong>Trưởng phòng</strong> như lần đầu.
          </p>
          {!canResubmitApproval && !canEditPendingResubmit && (
            <p className="mt-2 text-xs text-amber-800/90">
              Cần quyền cập nhật phiếu / tạo &amp; gửi duyệt (Chuyên viên KTS…)
              để thao tác tại đây.
            </p>
          )}
        </div>
      )}

      {wo.status === "PENDING_APPROVAL" &&
        (stepsForApprovalUi.length > 0 || !!pendingApprovalLog) && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-4 text-sm text-indigo-950">
            <p className="font-bold text-indigo-950 mb-3">
              Tiến trình phê duyệt
            </p>
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
                  Phiếu <strong>sự cố nghiêm trọng</strong> (2 cấp duyệt). Sau
                  khi <strong>{tcStepName}</strong> duyệt xong, yêu cầu chuyển
                  sang <strong>{tpStepName}</strong> — bước đó có thể{" "}
                  <strong>xác nhận / phân công lại</strong> người hiện trường
                  khi duyệt cuối (hoặc để trống, phân công sau trên phiếu).
                </p>
              )}
            {twoStepApproval &&
              Number(pendingApprovalLog?.currentLevel) === 2 &&
              pendingApprovalLog?.status === "PENDING" && (
                <p className="mt-3 text-xs font-semibold leading-relaxed border-t border-indigo-200/60 pt-3 text-amber-950">
                  Đang chờ <strong>{tpStepName}</strong> — duyệt hoàn tất để
                  phiếu sang «Chờ thực hiện». Ở bước cuối có thể chọn phân công
                  ngay trong form Phê duyệt (điều chỉnh lại người giao nếu cần).
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
              Bấm <strong>Phân công</strong> và chọn{" "}
              <strong>KTV hiện trường</strong> hoặc{" "}
              <strong>Chuyên viên kỹ thuật số</strong>.
            </p>
          </div>
        </div>
      )}

      {wo.status === "WAITING" && isAssigned && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
          {amGroupLeader ? (
            <span className="font-semibold text-blue-800">
              Bạn là trưởng nhóm — bấm <strong>Bắt đầu</strong> để khởi động
              phiếu này.
            </span>
          ) : (
            <span className="font-semibold">
              Bạn được phân công — chờ trưởng nhóm bắt đầu.
            </span>
          )}{" "}
          <Link
            to={checklistForAssetHref}
            className="font-bold text-blue-800 underline ml-1"
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
                  <Badge
                    color={CHECKLIST_STATUS_COLOR[c.overallStatus] ?? "gray"}
                  >
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
              to={checklistForAssetHref}
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
                "Yêu cầu dừng máy",
                Number(wo.requiresShutdown) === 1 ? "Có" : "Không",
              ],
              [
                "Trạng thái nguồn máy",
                machineIsShutdown ? "Đang tắt máy" : "Đang bật máy",
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
              {wo.assignments.map((a) => {
                const photoUrl = a.photoPath
                  ? employeeApi.getPhotoUrl(a.photoPath)
                  : null;
                const isLeader = Number(a.isGroupLeader) === 1;
                return (
                  <EmployeeCard key={a.employeeId} emp={a} side="right">
                    <li
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-default ${isLeader ? "bg-blue-50 border border-blue-100" : "bg-gray-50"}`}
                    >
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={a.fullName}
                          className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                          {a.fullName?.[0] ?? "?"}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">
                            {a.fullName}
                          </p>
                          {isLeader && (
                            <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase tracking-wide">
                              Trưởng nhóm
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-gray-600">
                          {a.positionName}
                          {a.specialty ? ` · ${a.specialty}` : ""}
                          {a.craftLevel ? ` · Bậc ${a.craftLevel}` : ""}
                        </p>
                      </div>
                      {a.craftLevel && (
                        <div className="flex items-center gap-1 text-xs text-blue-600 font-semibold flex-shrink-0">
                          <Star size={11} /> {a.craftLevel}
                        </div>
                      )}
                    </li>
                  </EmployeeCard>
                );
              })}
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

      {canControlMachinePower && (
        <Card title="Điều khiển nguồn máy">
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Trạng thái hiện tại:{" "}
              <span className={machineIsShutdown ? "font-bold text-amber-700" : "font-bold text-green-700"}>
                {machineIsShutdown ? "Đang tắt máy" : "Đang bật máy"}
              </span>
            </p>
            {!machineIsShutdown && (
              <>
                <Input
                  label="Lý do dừng máy (tuỳ chọn)"
                  value={shutdownReason}
                  onChange={(e) => setShutdownReason(e.target.value)}
                  placeholder="VD: thay bạc đạn cụm trục chính"
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={() => setPowerState("SHUTDOWN")}>
                    Tắt máy
                  </Button>
                </div>
              </>
            )}
            {machineIsShutdown && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setPowerState("STARTUP")}
                >
                  Bật máy
                </Button>
              </div>
            )}
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
                  {a.stepPositionName ? ` · ${a.stepPositionName}` : ""}
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
        onClose={() => {
          setAssignOpen(false);
          setAssignMode("individual");
          setAssignSpecialty("");
          setSelectedEmp("");
          setSelectedGroup("");
          setGroupMembers([]);
          setGroupMembersModal(null);
          setGroupMembersCache({});
        }}
        title="Phân công thực hiện"
        size="md"
      >
        <div className="space-y-4">
          {/* Chọn chế độ */}
          <div className="flex gap-2">
            {[
              ["individual", "Cá nhân"],
              ["group", "Nhóm bảo trì"],
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setAssignMode(mode);
                  setSelectedEmp("");
                  setSelectedGroup("");
                  setGroupMembers([]);
                  setAssignSpecialty("");
                  setAssignCraftLevel("");
                  setAssignGroupFilter("");
                  setGroupMembersModal(null);
                  setGroupMembersCache({});
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  assignMode === mode
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {assignMode === "individual" ? (
            <>
              {/* Filter cá nhân */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Lọc chuyên môn..."
                  value={assignSpecialty}
                  onChange={(e) => {
                    setAssignSpecialty(e.target.value);
                    setSelectedEmp("");
                  }}
                  className="flex-1 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 outline-none placeholder:text-gray-400"
                />
                <select
                  value={assignCraftLevel}
                  onChange={(e) => {
                    setAssignCraftLevel(e.target.value);
                    setSelectedEmp("");
                  }}
                  className="w-36 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg px-2 py-2 focus:border-blue-500 outline-none"
                >
                  <option value="">Tất cả bậc</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      Bậc thợ {n}
                    </option>
                  ))}
                </select>
              </div>

              {/* Danh sách chọn nhân viên */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Nhân viên thực hiện{" "}
                  <span className="text-gray-400 font-normal">
                    (tự là trưởng nhóm)
                  </span>
                </label>
                <div className="border border-gray-200 rounded-xl overflow-auto max-h-60 divide-y divide-gray-100">
                  {employees
                    .filter(
                      (e) =>
                        (!assignSpecialty ||
                          (e.specialty ?? "")
                            .toLowerCase()
                            .includes(assignSpecialty.toLowerCase())) &&
                        (!assignCraftLevel ||
                          String(e.craftLevel) === String(assignCraftLevel)),
                    )
                    .map((e) => {
                      const onLeave = Boolean(e.onScheduledLeave);
                      const selected =
                        String(selectedEmp) === String(e.employeeId);
                      return (
                        <EmployeeCard key={e.employeeId} emp={e} side="left">
                          <button
                            type="button"
                            disabled={onLeave}
                            onClick={() =>
                              !onLeave && setSelectedEmp(String(e.employeeId))
                            }
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                              selected
                                ? "bg-blue-50"
                                : onLeave
                                  ? "opacity-50 cursor-not-allowed bg-gray-50"
                                  : "hover:bg-gray-50"
                            }`}
                          >
                            {e.photoPath ? (
                              <img
                                src={employeeApi.getPhotoUrl(e.photoPath)}
                                alt={e.fullName}
                                className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">
                                {e.fullName?.[0] ?? "?"}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p
                                  className={`text-sm font-semibold ${selected ? "text-blue-700" : "text-gray-900"}`}
                                >
                                  {e.fullName}
                                </p>
                                {selected && (
                                  <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded">
                                    ✓
                                  </span>
                                )}
                                {onLeave && (
                                  <span className="text-[10px] text-orange-600 font-semibold bg-orange-50 px-1.5 py-0.5 rounded">
                                    Đang nghỉ
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 truncate">
                                {e.positionName}
                                {e.specialty ? ` · ${e.specialty}` : ""}
                                {e.craftLevel ? ` · Bậc ${e.craftLevel}` : ""}
                              </p>
                            </div>
                            {e.craftLevel && (
                              <div className="flex items-center gap-1 text-xs text-blue-600 font-semibold flex-shrink-0">
                                <Star size={11} /> {e.craftLevel}
                              </div>
                            )}
                          </button>
                        </EmployeeCard>
                      );
                    })}
                  {employees.filter(
                    (e) =>
                      (!assignSpecialty ||
                        (e.specialty ?? "")
                          .toLowerCase()
                          .includes(assignSpecialty.toLowerCase())) &&
                      (!assignCraftLevel ||
                        String(e.craftLevel) === String(assignCraftLevel)),
                  ).length === 0 && (
                    <p className="px-4 py-6 text-sm text-gray-400 text-center">
                      Không có nhân viên phù hợp
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Lọc nhóm theo chuyên môn */}
              <input
                type="text"
                placeholder="Lọc nhóm theo chuyên môn..."
                value={assignGroupFilter}
                onChange={(e) => {
                  setAssignGroupFilter(e.target.value);
                  setSelectedGroup("");
                  setGroupMembers([]);
                }}
                className="w-full text-sm text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 outline-none placeholder:text-gray-400"
              />
              <p className="text-xs text-gray-500">
                Bấm icon <Users size={12} className="inline -mt-0.5" /> bên phải mỗi nhóm để xem thành viên.
              </p>

              {/* Danh sách nhóm */}
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
                {groups
                  .filter(
                    (g) =>
                      !assignGroupFilter ||
                      (g.specialty ?? "")
                        .toLowerCase()
                        .includes(assignGroupFilter.toLowerCase()) ||
                      g.groupName
                        .toLowerCase()
                        .includes(assignGroupFilter.toLowerCase()),
                  )
                  .map((g) => {
                    const gid = g.groupId;
                    const sel = String(selectedGroup) === String(gid);
                    return (
                      <MaintenanceGroupAssignRow
                        key={gid}
                        group={g}
                        selected={sel}
                        onSelect={() => handleSelectGroup(gid)}
                        onViewMembers={() => openGroupMembersModal(g)}
                      />
                    );
                  })}
                {groups.filter(
                  (g) =>
                    !assignGroupFilter ||
                    (g.specialty ?? "")
                      .toLowerCase()
                      .includes(assignGroupFilter.toLowerCase()) ||
                    g.groupName
                      .toLowerCase()
                      .includes(assignGroupFilter.toLowerCase()),
                ).length === 0 && (
                  <p className="px-4 py-6 text-sm text-gray-400 text-center">
                    Không có nhóm phù hợp
                  </p>
                )}
              </div>

              {/* Xem trước thành viên nhóm đã chọn */}
              {groupMembers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">
                    Thành viên nhóm
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-200 rounded-xl">
                    {groupMembers.map((m) => {
                      const isLeader = Number(m.isGroupLeader) === 1;
                      return (
                        <EmployeeCard
                          key={m.employeeId}
                          emp={{ ...m, specialty: m.empSpecialty }}
                          side="left"
                        >
                          <div
                            className={`flex items-center gap-3 px-3 py-2 ${isLeader ? "bg-yellow-50" : ""}`}
                          >
                            {m.photoPath ? (
                              <img
                                src={employeeApi.getPhotoUrl(m.photoPath)}
                                alt={m.fullName}
                                className="w-7 h-7 rounded-full object-cover border border-gray-200 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                                {m.fullName?.[0] ?? "?"}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-sm font-semibold text-gray-800">
                                  {m.fullName}
                                </p>
                                {isLeader && (
                                  <span className="text-[10px] font-bold bg-yellow-500 text-white px-1.5 py-0.5 rounded">
                                    Trưởng nhóm
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 truncate">
                                {m.positionName}
                                {m.empSpecialty ? ` · ${m.empSpecialty}` : ""}
                                {m.craftLevel ? ` · Bậc ${m.craftLevel}` : ""}
                              </p>
                            </div>
                          </div>
                        </EmployeeCard>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">
                    Trưởng nhóm sẽ bắt đầu phiếu và ghi chú vật tư.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-3 pt-1">
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
        open={!!groupMembersModal}
        onClose={() => setGroupMembersModal(null)}
        title={
          groupMembersModal
            ? `Thành viên · ${groupMembersModal.groupName}`
            : "Thành viên nhóm"
        }
        size="sm"
        stacked
      >
        {groupMembersModal && (
          <GroupMembersPopover
            members={groupMembersModal.members}
            loading={groupMembersModal.loading}
            error={groupMembersModal.error}
          />
        )}
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
          <p className="text-xs text-gray-500">
            Xác nhận nghiệm thu; có thể chỉnh giờ thực tế.
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
          setApproveAssignMode("individual");
          setApproveAssignEmp("");
          setApproveAssignGroup("");
          setApproveGroupMembers([]);
          setApproveEstimatedHours("");
          setApprovePlannedDate("");
          setApprovePriority("");
          setApproveDescription("");
        }}
        title="Xử lý phê duyệt"
        size="sm"
      >
        <div className="space-y-4">
          {twoStepApproval && pendingApprovalLog && (
            <p className="text-xs text-gray-600 rounded-lg bg-gray-50 px-3 py-2 border border-gray-100">
              Bước {pendingApprovalLog.currentLevel}/
              {pendingApprovalLog.totalLevels}
              {pendingApprovalLog.stepPositionName
                ? ` — ${pendingApprovalLog.stepPositionName}`
                : ""}
              {Number(pendingApprovalLog.currentLevel) === 2
                ? ` · ${tpStepName} có thể đổi người phân công khi duyệt.`
                : ""}
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
          {approveAction === "APPROVED" && (
            <div className="space-y-3">
              <Input
                label="Ngày dự kiến"
                type="date"
                value={approvePlannedDate}
                onChange={(e) => setApprovePlannedDate(e.target.value)}
              />
              <Input
                label="Giờ ước tính (giờ)"
                type="number"
                min={0}
                step={0.5}
                value={approveEstimatedHours}
                onChange={(e) => setApproveEstimatedHours(e.target.value)}
                placeholder="Để trống nếu không đổi / giữ giá trị hiện tại"
              />
              <Select
                label="Ưu tiên"
                value={approvePriority}
                onChange={(e) => setApprovePriority(e.target.value)}
              >
                <option value="">— Giữ như hiện tại —</option>
                <option value="LOW">Thấp</option>
                <option value="MEDIUM">Trung bình</option>
                <option value="HIGH">Cao</option>
                <option value="EMERGENCY">Khẩn cấp</option>
              </Select>
              <Textarea
                label="Mô tả công việc"
                value={approveDescription}
                onChange={(e) => setApproveDescription(e.target.value)}
                placeholder="Cập nhật mô tả trước khi duyệt (nếu cần)"
                rows={3}
              />
            </div>
          )}
          {isWoFinalApprovalStep && approveAction === "APPROVED" && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-3 space-y-2">
              <Select
                label="Kiểu phân công"
                value={approveAssignMode}
                onChange={(e) => {
                  setApproveAssignMode(e.target.value);
                  setApproveAssignEmp("");
                  setApproveAssignGroup("");
                  setApproveGroupMembers([]);
                }}
              >
                <option value="individual">Cá nhân</option>
                <option value="group">Nhóm</option>
              </Select>
              {approveAssignMode === "individual" ? (
                <Select
                  label="Phân công ngay (tuỳ chọn)"
                  value={approveAssignEmp}
                  onChange={(e) => setApproveAssignEmp(e.target.value)}
                >
                  <option value="">— Để sau: Phân công trên phiếu —</option>
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
              ) : (
                <>
                  <Select
                    label="Nhóm bảo trì (tuỳ chọn)"
                    value={approveAssignGroup}
                    onChange={(e) => setApproveAssignGroup(e.target.value)}
                  >
                    <option value="">— Để sau: Phân công trên phiếu —</option>
                    {groups.map((g) => (
                      <option key={g.groupId} value={g.groupId}>
                        {g.groupName}
                        {g.specialty ? ` · ${g.specialty}` : ""}
                        {g.leaderName ? ` · TN: ${g.leaderName}` : ""}
                      </option>
                    ))}
                  </Select>
                  {approveGroupMembers.length > 0 && (
                    <div className="rounded-lg border border-blue-200 bg-white px-3 py-2">
                      <p className="text-xs font-semibold text-blue-900 mb-1">
                        Thành viên nhóm sẽ được phân công
                      </p>
                      <ul className="space-y-0.5">
                        {approveGroupMembers.map((m) => (
                          <li key={m.employeeId} className="text-xs text-gray-700">
                            {m.fullName}
                            {Number(m.isGroupLeader) === 1 ? " (Trưởng nhóm)" : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
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
        title={
          canEditPendingResubmit
            ? "Chỉnh sửa phiếu (trước khi gửi lại phê duyệt)"
            : "Chỉnh sửa phiếu việc"
        }
        size="lg"
      >
        {wo && (
          <WorkOrderForm
            wo={wo}
            onSuccess={() => {
              setEditWoOpen(false);
              if (canEditPendingResubmit) {
                toast.success(
                  "Đã cập nhật phiếu — bấm «Gửi lại phê duyệt» khi sẵn sàng.",
                );
              } else {
                toast.success("Đã cập nhật phiếu việc");
              }
              load();
            }}
            onCancel={() => setEditWoOpen(false)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="Xác nhận xoá phiếu việc"
        message={`Bạn có muốn xoá phiếu WO-${String(wo.woId).padStart(4, "0")} (${wo.assetName ?? "—"}) không? Phiếu sẽ chuyển vào kho lưu trữ — chỉ Quản trị viên mới truy cập và khôi phục được.`}
        confirmLabel="Xoá phiếu"
        cancelLabel="Không"
        variant="danger"
        loading={archiveBusy}
        onConfirm={handleSoftDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      <ConfirmDialog
        open={restoreOpen}
        title="Khôi phục phiếu việc"
        message={`Khôi phục phiếu WO-${String(wo.woId).padStart(4, "0")} (${wo.assetName ?? "—"}) về danh sách hoạt động? Phiếu sẽ giữ nguyên trạng thái trước khi lưu trữ.`}
        confirmLabel="Khôi phục"
        cancelLabel="Huỷ"
        loading={archiveBusy}
        onConfirm={handleRestore}
        onCancel={() => setRestoreOpen(false)}
      />
    </div>
  );
}
