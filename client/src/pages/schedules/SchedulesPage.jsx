/**
 * SchedulesPage.jsx — Lịch bảo trì: DRAFT/REJECTED → Gửi → PENDING_APPROVAL → (Phê duyệt) → PENDING.
 * Hai kiểu: Định kỳ (ngày/tuần/tháng/năm) — có nút WO + scheduler; Dự báo (giờ) — WO tự sinh khi vượt ngưỡng, không tạo từ lịch.
 * UX Xem/Sửa/Xoá:
 *   - Xem (Eye): mở modal read-only.
 *   - Sửa (Pencil): KTS sửa khi DRAFT/REJECTED; TC/TP sửa khi PENDING/IN_PROGRESS/OVERDUE; Admin/TP đủ quyền.
 *   - Xoá (Trash2): popup 1 hoặc 2 nhánh tuỳ WO liên quan (BE trả về deletePreview).
 *     + Pre-approval / WO chưa khởi động: xoá luôn, kèm cancel WO PENDING_APPROVAL/WAITING.
 *     + Có WO IN_PROGRESS/PAUSED/AWAITING_CLOSURE/COMPLETED/CANCELLED: cảnh báo giữ WO.
 */
import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Play,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Eye,
  Pencil,
  Trash2,
  Send,
  FileSpreadsheet,
} from "lucide-react";
import { scheduleApi } from "../../api/schedule.api.js";
import { assetApi } from "../../api/asset.api.js";
import { checklistApi } from "../../api/checklist.api.js";
import { Button } from "../../components/ui/Button.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { Select } from "../../components/ui/Input.jsx";
import { Pagination } from "../../components/ui/Pagination.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { PageLoader } from "../../components/ui/Spinner.jsx";
import {
  EMPTY_SCHEDULE_FORM,
  ScheduleFormFields as SharedScheduleFormFields,
  buildSchedulePayload,
  mapScheduleToForm,
  validateScheduleForm as validateSharedScheduleForm,
} from "../../components/schedules/ScheduleFormFields.jsx";
import {
  fDate,
  dateInputWithOffset,
  todayDateInput,
  toDateInputValue,
} from "../../utils/format.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { canDo } from "../../utils/rbac.js";
import { exportRowsToExcel } from "../../utils/excelExport.js";
import toast from "react-hot-toast";

/** Hiển thị theo đơn vị tần suất (khớp nghiệp vụ 2 loại). */
const SCHEDULE_KIND_BADGE = {
  periodic: { label: "Định kỳ", color: "blue" },
  predictive: { label: "Dự báo (giờ)", color: "yellow" },
};
function scheduleKindKey(s) {
  return s?.frequencyUnit === "HOURS" ? "predictive" : "periodic";
}

function formatScheduleChecklistNames(s) {
  if (Array.isArray(s?.checklistTemplateNames) && s.checklistTemplateNames.length) {
    return s.checklistTemplateNames.join(", ");
  }
  return s?.checklistTemplateName ?? "";
}
const UNIT_LABEL = {
  HOURS: "giờ",
  DAYS: "ngày",
  WEEKS: "tuần",
  MONTHS: "tháng",
  YEARS: "năm",
};
const STATUS_COLOR = {
  DRAFT: "gray",
  PENDING_APPROVAL: "yellow",
  PENDING: "blue",
  IN_PROGRESS: "blue",
  COMPLETED: "green",
  OVERDUE: "red",
  CANCELLED: "gray",
  REJECTED: "orange",
};
const STATUS_LABEL = {
  DRAFT: "Bản nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  PENDING: "Chờ TH",
  IN_PROGRESS: "Đang TH",
  COMPLETED: "Hoàn thành",
  OVERDUE: "Quá hạn",
  CANCELLED: "Hủy",
  REJECTED: "Từ chối",
};

const MAINTENANCE_TYPE_LABEL = {
  PREVENTIVE: "Định kỳ",
  PREDICTIVE: "Dự báo",
  CORRECTIVE: "Khắc phục",
};

function dueRangeByPeriod(period) {
  if (!period) return {};
  const dueTo = todayDateInput();
  if (period === "week") return { dueFrom: dateInputWithOffset(-6), dueTo };
  if (period === "month") return { dueFrom: dateInputWithOffset(-29), dueTo };
  if (period === "quarter") return { dueFrom: dateInputWithOffset(-89), dueTo };
  return {};
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const normalized = toDateInputValue(dateStr);
  if (!normalized) return null;
  const [y, m, d] = normalized.split("-").map(Number);
  const targetDate = new Date(y, m - 1, d);
  return Math.round(
    (targetDate - new Date(new Date().toDateString())) / 86400000,
  );
}

function DueDateChip({ nextDueDate, frequencyUnit, status }) {
  if (["DRAFT", "PENDING_APPROVAL", "REJECTED"].includes(status)) {
    return <span className="text-xs text-gray-400 italic">Chưa hiệu lực</span>;
  }
  if (frequencyUnit === "HOURS") {
    return <span className="text-xs text-gray-400 italic">Theo giờ chạy</span>;
  }
  if (!nextDueDate) return <span className="text-xs text-gray-400">—</span>;

  const days = daysUntil(nextDueDate);

  if (status === "OVERDUE" || days < 0) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 rounded-full px-2 py-0.5">
          <AlertTriangle size={10} /> Quá hạn {Math.abs(days)} ngày
        </span>
        <span className="text-xs text-red-500 font-medium">
          {fDate(nextDueDate)}
        </span>
      </div>
    );
  }
  if (days <= 7) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
          <Clock size={10} /> Còn {days} ngày
        </span>
        <span className="text-xs text-amber-600 font-medium">
          {fDate(nextDueDate)}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 rounded-full px-2 py-0.5">
        <CheckCircle size={10} /> Còn {days} ngày
      </span>
      <span className="text-xs text-green-600 font-medium">
        {fDate(nextDueDate)}
      </span>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export function SchedulesPage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [assets, setAssets] = useState([]);
  const [checklistTemplates, setChecklistTemplates] = useState([]);
  const [locations, setLocations] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    assetId: "",
    locationId: "",
    status: "",
    maintenanceType: "",
    priority: "",
    period: "",
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deletePreview, setDeletePreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmEditOpen, setConfirmEditOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_SCHEDULE_FORM);
  const [saving, setSaving] = useState(false);
  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const periodRange = dueRangeByPeriod(filters.period);
      const res = await scheduleApi.getAll({
        page,
        limit: LIMIT,
        ...(filters.assetId && { assetId: filters.assetId }),
        ...(filters.locationId && { locationId: filters.locationId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.maintenanceType && {
          maintenanceType: filters.maintenanceType,
        }),
        ...(filters.priority && { priority: filters.priority }),
        ...periodRange,
      });
      setSchedules(res.data.data?.items ?? []);
      setTotal(res.data.data?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    load();
    assetApi
      .getAll({ limit: 200 })
      .then((r) => setAssets(r.data.data?.items ?? []))
      .catch(() => {});
    assetApi
      .getLocations()
      .then((r) => setLocations(r.data.data ?? []))
      .catch(() => {});
    checklistApi
      .getTemplates()
      .then((r) => setChecklistTemplates(r.data.data ?? []))
      .catch(() => {});
  }, [load]);

  const setFilter = (k, v) => {
    setFilters((p) => ({ ...p, [k]: v }));
    setPage(1);
  };

  const handleGenerateWO = async (id) => {
    try {
      const res = await scheduleApi.generateWO(id);
      toast.success(
        `Đã tạo WO-${String(res.data.data?.workOrderId ?? 0).padStart(4, "0")} từ lịch bảo trì`,
      );
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi tạo phiếu");
    }
  };

  const handleSubmit = async (id) => {
    try {
      await scheduleApi.submit(id);
      toast.success("Đã gửi lịch bảo trì vào luồng phê duyệt");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi gửi phê duyệt");
    }
  };

  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const patchForm = useCallback((patch) => {
    setForm((p) => ({ ...p, ...patch }));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!validateSharedScheduleForm(form, toast.error)) return;
    setSaving(true);
    try {
      await scheduleApi.create(buildSchedulePayload(form));
      toast.success("Đã tạo lịch bảo trì");
      setCreateOpen(false);
      setForm(EMPTY_SCHEDULE_FORM);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi tạo lịch");
    } finally {
      setSaving(false);
    }
  };

  const openView = (s) => {
    setForm(mapScheduleToForm(s));
    setViewItem(s);
  };

  const openEdit = (s) => {
    setForm(mapScheduleToForm(s));
    setEditItem(s);
  };

  const handleEdit = (e) => {
    e.preventDefault();
    if (!validateSharedScheduleForm(form, toast.error)) return;
    setConfirmEditOpen(true);
  };

  const performEdit = async () => {
    if (!editItem) return;
    setSaving(true);
    try {
      await scheduleApi.update(editItem.scheduleId, buildSchedulePayload(form));
      toast.success("Đã lưu chi tiết chỉnh sửa lịch bảo trì");
      setConfirmEditOpen(false);
      setEditItem(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi cập nhật");
    } finally {
      setSaving(false);
    }
  };

  const openDelete = async (s) => {
    setDeleteItem(s);
    setDeletePreview(null);
    setPreviewLoading(true);
    try {
      const res = await scheduleApi.deletePreview(s.scheduleId);
      setDeletePreview(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Không tải được preview xoá");
      setDeleteItem(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setSaving(true);
    try {
      const res = await scheduleApi.remove(deleteItem.scheduleId);
      const cancelled = res.data?.data?.cancelledWorkOrderIds ?? [];
      toast.success(
        cancelled.length > 0
          ? `Đã xoá lịch bảo trì và huỷ ${cancelled.length} phiếu việc chưa khởi động`
          : "Đã xoá lịch bảo trì",
      );
      setDeleteItem(null);
      setDeletePreview(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi xoá");
    } finally {
      setSaving(false);
    }
  };

  const canCreateSch = canDo(user, "SCHEDULE:CREATE");
  const canUpdateSch = canDo(user, "SCHEDULE:UPDATE");
  const canSubmitSch = canDo(user, "SCHEDULE:SUBMIT");
  const canCreateWo = canDo(user, "WORK_ORDER:CREATE");
  const canDeleteSch = canDo(user, "SCHEDULE:DELETE");
  const actorLevel = Number(user?.positionLevel) || 0;
  const actorPid = Number(user?.positionId) || 0;
  const isAdmin = actorLevel >= 4;
  const isTruongCa = actorPid === 3;
  const isTruongPhongLane = actorLevel >= 3 && !isTruongCa; // Trưởng/Phó BT (6/8) hoặc PKT (7/9)
  const isKyThuat = actorLevel === 2;
  const isBgd = actorLevel >= 5 && !isAdmin;

  const isOperational = (s) =>
    ["PENDING", "IN_PROGRESS", "OVERDUE"].includes(s.status);
  /** Match logic ở service (canEditScheduleByRole). */
  const canEditRow = (s) => {
    if (isBgd) return false;
    if (isAdmin || isTruongPhongLane) return true;
    if (["DRAFT", "REJECTED"].includes(s.status)) {
      return isKyThuat;
    }
    if (["PENDING", "IN_PROGRESS", "OVERDUE"].includes(s.status)) {
      return isTruongCa;
    }
    return false;
  };
  /** Xoá: chỉ Admin và tuyến Trưởng/Phó. */
  const canDeleteRow = (_s) => isAdmin || isTruongPhongLane;

  const overdueCount = schedules.filter(
    (s) =>
      isOperational(s) &&
      s.frequencyUnit !== "HOURS" &&
      daysUntil(s.nextDueDate) < 0,
  ).length;
  const warningCount = schedules.filter((s) => {
    if (!isOperational(s) || s.frequencyUnit === "HOURS") return false;
    const d = daysUntil(s.nextDueDate);
    return d !== null && d >= 0 && d <= 7;
  }).length;

  const TH_TOOLTIPS = {
    Kiểu: "Định kỳ (ngày/tuần/tháng/năm) hoặc dự báo theo giờ chạy tích lũy.",
    "Tần suất": "Chu kỳ lặp lại giữa các lần bảo trì (vd. mỗi 30 ngày).",
    "Ngày bắt đầu": "Ngày bắt đầu áp dụng kế hoạch lịch.",
    "Ngày đến hạn":
      "Mốc lần bảo trì tiếp theo cần hoàn thành (sau khi tạo WO từ lịch, mốc này được lùi thêm 1 chu kỳ).",
    "Ngày TH cuối":
      "Ngày hệ thống ghi nhận đã phát sinh WO / cập nhật chu kỳ gần nhất (không phải ngày thợ hoàn thành phiếu).",
  };

  const handleExportExcel = () => {
    const ok = exportRowsToExcel({
      rows: schedules.map((s) => ({
        "ID lịch": s.scheduleId,
        "Tên lịch": s.scheduleName ?? "",
        "Tài sản": s.assetName ?? "",
        "Kiểu lịch":
          SCHEDULE_KIND_BADGE[scheduleKindKey(s)]?.label ?? scheduleKindKey(s),
        Checklist: formatScheduleChecklistNames(s),
        "Trạng thái": STATUS_LABEL[s.status] ?? s.status ?? "",
        "Loại bảo trì":
          MAINTENANCE_TYPE_LABEL[s.maintenanceType] ?? s.maintenanceType ?? "",
        "Tần suất":
          `${s.frequencyValue ?? ""} ${UNIT_LABEL[s.frequencyUnit] ?? s.frequencyUnit ?? ""}`.trim(),
        "Ngày bắt đầu": fDate(s.startDate) ?? "",
        "Ngày đến hạn": fDate(s.nextDueDate) ?? "",
        "Ngày thực hiện cuối": fDate(s.lastExecutedDate) ?? "",
      })),
      sheetName: "Lich bao tri",
      fileName: `lich-bao-tri-trang-${page}.xlsx`,
    });
    if (!ok) {
      toast.error("Không có dữ liệu để xuất Excel");
      return;
    }
    toast.success("Đã xuất Excel danh sách lịch bảo trì");
  };

  return (
    <div className="space-y-5">
      {/* Banner cảnh báo */}
      {(overdueCount > 0 || warningCount > 0) && (
        <div className="flex gap-3 flex-wrap">
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              <AlertTriangle size={16} className="text-red-600 shrink-0" />
              <span className="text-sm font-bold text-red-700">
                {overdueCount} lịch quá hạn — hệ thống đã tự tạo WO
              </span>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
              <Clock size={16} className="text-amber-600 shrink-0" />
              <span className="text-sm font-bold text-amber-700">
                {warningCount} lịch sắp đến hạn (≤ 7 ngày)
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Select
          value={filters.assetId}
          onChange={(e) => setFilter("assetId", e.target.value)}
        >
          <option value="">Tất cả tài sản</option>
          {assets.map((a) => (
            <option key={a.assetId} value={a.assetId}>
              {a.assetName}
            </option>
          ))}
        </Select>
        <Select
          value={filters.locationId}
          onChange={(e) => setFilter("locationId", e.target.value)}
        >
          <option value="">Tất cả khu vực</option>
          {locations.map((l) => (
            <option key={l.locationId} value={l.locationId}>
              {l.parentLocationName
                ? `${l.parentLocationName} › ${l.locationName}`
                : l.locationName}
            </option>
          ))}
        </Select>
        <Select
          value={filters.status}
          onChange={(e) => setFilter("status", e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          value={filters.maintenanceType}
          onChange={(e) => setFilter("maintenanceType", e.target.value)}
        >
          <option value="">Tất cả loại bảo trì</option>
          {Object.entries(MAINTENANCE_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          value={filters.priority}
          onChange={(e) => setFilter("priority", e.target.value)}
        >
          <option value="">Tất cả ưu tiên</option>
          <option value="LOW">Thấp</option>
          <option value="MEDIUM">Trung bình</option>
          <option value="HIGH">Cao</option>
          <option value="EMERGENCY">Khẩn cấp</option>
        </Select>
        <Select
          value={filters.period}
          onChange={(e) => setFilter("period", e.target.value)}
        >
          <option value="">Thời gian: tất cả</option>
          <option value="week">Tuần này (7 ngày)</option>
          <option value="month">Tháng này (30 ngày)</option>
          <option value="quarter">3 tháng gần đây</option>
        </Select>
        <Button
          variant="secondary"
          onClick={() => {
            setFilters({
              assetId: "",
              locationId: "",
              status: "",
              maintenanceType: "",
              priority: "",
              period: "",
            });
            setPage(1);
          }}
        >
          Xóa bộ lọc
        </Button>
      </div>

      {canCreateSch && (
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={handleExportExcel}
            disabled={loading || schedules.length === 0}
            title={
              schedules.length === 0
                ? "Không có dữ liệu để xuất"
                : "Xuất Excel theo danh sách đang hiển thị"
            }
          >
            <FileSpreadsheet size={15} /> Xuất Excel
          </Button>
          <Button
            onClick={() => {
              setForm(EMPTY_SCHEDULE_FORM);
              setCreateOpen(true);
            }}
          >
            <Plus size={15} /> Thêm lịch bảo trì
          </Button>
        </div>
      )}
      {!canCreateSch && (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            onClick={handleExportExcel}
            disabled={loading || schedules.length === 0}
            title={
              schedules.length === 0
                ? "Không có dữ liệu để xuất"
                : "Xuất Excel theo danh sách đang hiển thị"
            }
          >
            <FileSpreadsheet size={15} /> Xuất Excel
          </Button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : schedules.length === 0 ? (
          <EmptyState icon={Calendar} title="Chưa có lịch bảo trì" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    "Tên lịch",
                    "Tài sản",
                    "Kiểu",
                    "Checklist",
                    "Trạng thái",
                    "Tần suất",
                    "Ngày bắt đầu",
                    "Ngày đến hạn",
                    "Ngày TH cuối",
                    "",
                  ].map((h) => (
                    <th
                      key={h || "actions"}
                      title={h ? TH_TOOLTIPS[h] : undefined}
                      className="text-left text-xs font-bold text-gray-700 uppercase tracking-wide px-4 py-3 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schedules.map((s) => {
                  const op = isOperational(s);
                  const days =
                    op && s.frequencyUnit !== "HOURS"
                      ? daysUntil(s.nextDueDate)
                      : null;
                  const isOverdue = days !== null && days < 0;
                  const isWarning = days !== null && days >= 0 && days <= 7;
                  return (
                    <tr
                      key={s.scheduleId}
                      className={`hover:bg-gray-50 transition-colors ${isOverdue ? "bg-red-50/40" : isWarning ? "bg-amber-50/40" : ""}`}
                    >
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {s.scheduleName}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {s.assetName}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const sk = scheduleKindKey(s);
                          const b = SCHEDULE_KIND_BADGE[sk];
                          return <Badge color={b.color}>{b.label}</Badge>;
                        })()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatScheduleChecklistNames(s) ? (
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {(Array.isArray(s.checklistTemplateNames) &&
                            s.checklistTemplateNames.length
                              ? s.checklistTemplateNames
                              : [s.checklistTemplateName]
                            ).map((name) => (
                              <Badge key={name} color="indigo">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">
                            Chưa gắn template
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={STATUS_COLOR[s.status] ?? "gray"}>
                          {STATUS_LABEL[s.status] ?? s.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                        {s.frequencyValue}{" "}
                        {UNIT_LABEL[s.frequencyUnit] ?? s.frequencyUnit}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                        {fDate(s.startDate)}
                      </td>
                      <td className="px-4 py-3">
                        <DueDateChip
                          nextDueDate={s.nextDueDate}
                          frequencyUnit={s.frequencyUnit}
                          status={s.status}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {fDate(s.lastExecutedDate) || (
                          <span className="text-gray-400 italic text-xs">
                            Chưa TH
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {canSubmitSch &&
                            ["DRAFT", "REJECTED"].includes(s.status) && (
                              <Button
                                size="xs"
                                variant="secondary"
                                onClick={() => handleSubmit(s.scheduleId)}
                                title="Gửi duyệt"
                              >
                                <Send size={11} /> Gửi
                              </Button>
                            )}
                          {canCreateWo &&
                            ["PENDING", "IN_PROGRESS", "OVERDUE"].includes(
                              s.status,
                            ) &&
                            s.frequencyUnit !== "HOURS" && (
                              <Button
                                size="xs"
                                variant="secondary"
                                onClick={() => handleGenerateWO(s.scheduleId)}
                                title="Tạo WO từ lịch định kỳ (theo ngày/tuần/tháng/năm)"
                              >
                                <Play size={11} /> WO
                              </Button>
                            )}
                          <button
                            type="button"
                            onClick={() => openView(s)}
                            title="Xem chi tiết"
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
                          >
                            <Eye size={13} />
                          </button>
                          {canUpdateSch && canEditRow(s) && (
                            <button
                              type="button"
                              onClick={() => openEdit(s)}
                              title="Sửa lịch"
                              className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {canDeleteSch && canDeleteRow(s) && (
                            <button
                              type="button"
                              onClick={() => openDelete(s)}
                              title="Xoá lịch"
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pagination
        page={page}
        totalPages={Math.ceil(total / LIMIT)}
        onChange={setPage}
      />

      {/* Modal Tạo mới */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Thêm lịch bảo trì"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <SharedScheduleFormFields
            form={form}
            setF={setF}
            patchForm={patchForm}
            assets={assets}
            checklistTemplates={checklistTemplates}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" loading={saving}>
              Thêm lịch
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Xem chi tiết — read-only */}
      <Modal
        open={!!viewItem}
        onClose={() => setViewItem(null)}
        title={`Chi tiết lịch — ${viewItem?.scheduleName ?? ""}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge color={STATUS_COLOR[viewItem?.status] ?? "gray"}>
              {STATUS_LABEL[viewItem?.status] ?? viewItem?.status}
            </Badge>
            {viewItem?.frequencyUnit === "HOURS" ? (
              <Badge color="yellow">Dự báo (giờ)</Badge>
            ) : (
              <Badge color="blue">Định kỳ</Badge>
            )}
            {viewItem?.lastExecutedDate && (
              <span className="text-gray-500">
                TH cuối: {fDate(viewItem.lastExecutedDate)}
              </span>
            )}
          </div>
          <SharedScheduleFormFields
            form={form}
            setF={() => {}}
            patchForm={() => {}}
            assets={assets}
            checklistTemplates={checklistTemplates}
            readOnly
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setViewItem(null)}
            >
              Đóng
            </Button>
            {canUpdateSch && viewItem && canEditRow(viewItem) && (
              <Button
                type="button"
                onClick={() => {
                  const target = viewItem;
                  setViewItem(null);
                  openEdit(target);
                }}
              >
                <Pencil size={14} /> Sửa
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal Sửa */}
      <Modal
        open={!!editItem}
        onClose={() => setEditItem(null)}
        title="Sửa lịch bảo trì"
        size="lg"
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <SharedScheduleFormFields
            form={form}
            setF={setF}
            patchForm={patchForm}
            assets={assets}
            checklistTemplates={checklistTemplates}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditItem(null)}
            >
              Hủy
            </Button>
            <Button type="submit" loading={saving && confirmEditOpen}>
              Lưu
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmEditOpen}
        title="Xác nhận lưu chỉnh sửa"
        message="Bạn có muốn lưu chi tiết chỉnh sửa không?"
        confirmLabel="Lưu"
        cancelLabel="Không"
        loading={saving}
        onConfirm={performEdit}
        onCancel={() => (saving ? null : setConfirmEditOpen(false))}
      />

      {/* Popup xoá — 2 nhánh (preview do BE phân loại WO liên quan) */}
      <ConfirmDialog
        open={!!deleteItem}
        title={
          deletePreview?.woGroups?.willKeep?.length > 0
            ? "Lịch đã phát sinh phiếu việc"
            : "Xác nhận xoá lịch bảo trì"
        }
        message={
          previewLoading || !deletePreview ? (
            "Đang tải thông tin lịch..."
          ) : deletePreview.woGroups.willKeep.length > 0 ? (
            <>
              Lịch <strong>"{deleteItem?.scheduleName}"</strong> đã phát sinh{" "}
              <strong>{deletePreview.woGroups.willKeep.length}</strong> Phiếu
              việc đang thực hiện hoặc đã đóng. Hệ thống sẽ{" "}
              <strong>huỷ Lịch</strong> nhưng{" "}
              <strong>giữ lại Phiếu việc</strong> để bảo toàn dữ liệu lịch sử
              {deletePreview.woGroups.willCancel.length > 0 ? (
                <>
                  {" "}
                  và{" "}
                  <strong>
                    huỷ {deletePreview.woGroups.willCancel.length}
                  </strong>{" "}
                  phiếu chưa khởi động
                </>
              ) : null}
              . Bạn có đồng ý không?
            </>
          ) : (
            <>
              Bạn có muốn xoá lịch bảo trì{" "}
              <strong>"{deleteItem?.scheduleName}"</strong> này không?
              {deletePreview.woGroups.willCancel.length > 0 && (
                <span className="block text-xs text-amber-700 mt-2">
                  Lưu ý: {deletePreview.woGroups.willCancel.length} phiếu việc
                  liên quan (chưa khởi động) cũng sẽ được huỷ.
                </span>
              )}
            </>
          )
        }
        confirmLabel="Có"
        cancelLabel="Không"
        variant="danger"
        loading={saving}
        onConfirm={handleDelete}
        onCancel={() => {
          if (saving) return;
          setDeleteItem(null);
          setDeletePreview(null);
        }}
      />
    </div>
  );
}
