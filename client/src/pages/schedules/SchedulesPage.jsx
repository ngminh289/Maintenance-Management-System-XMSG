/**
 * SchedulesPage.jsx — Lịch bảo trì: DRAFT/REJECTED → Gửi → PENDING_APPROVAL → (Phê duyệt) → PENDING.
 * Hai kiểu: Định kỳ (ngày/tuần/tháng/năm) — có nút WO + scheduler; Dự báo (giờ) — WO tự sinh khi vượt ngưỡng, không tạo từ lịch.
 * Sửa/xóa: nháp & từ chối; Admin (level≥4) được vượt quy tắc.
 */
import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Play,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Pencil,
  Trash2,
  Send,
} from "lucide-react";
import { scheduleApi } from "../../api/schedule.api.js";
import { assetApi } from "../../api/asset.api.js";
import { assetTypeApi } from "../../api/assetType.api.js";
import { checklistApi } from "../../api/checklist.api.js";
import { Button } from "../../components/ui/Button.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { Input, Select, Textarea } from "../../components/ui/Input.jsx";
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
import { fDate } from "../../utils/format.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { canDo } from "../../utils/rbac.js";
import toast from "react-hot-toast";

/** Hiển thị theo đơn vị tần suất (khớp nghiệp vụ 2 loại). */
const SCHEDULE_KIND_BADGE = {
  periodic: { label: "Định kỳ", color: "blue" },
  predictive: { label: "Dự báo (giờ)", color: "yellow" },
};
function scheduleKindKey(s) {
  return s?.frequencyUnit === "HOURS" ? "predictive" : "periodic";
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
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  let startDate = null;
  if (period === "week") startDate = new Date(today.getTime() - 6 * 86400000);
  if (period === "month") startDate = new Date(today.getTime() - 29 * 86400000);
  if (period === "quarter")
    startDate = new Date(today.getTime() - 89 * 86400000);
  if (!startDate) return {};
  return { dueFrom: startDate.toISOString().slice(0, 10), dueTo: end };
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.round(
    (new Date(dateStr) - new Date(new Date().toDateString())) / 86400000,
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

// ── Form component dùng chung cho cả Tạo và Sửa ────────────────────────────
function ScheduleForm({ form, setF, patchForm, assets }) {
  const isPredictive = form.scheduleKind === "predictive";

  // Autofill PM từ DefaultPMValue/Unit của loại tài sản khi chọn tài sản
  const handleAssetChange = async (assetId) => {
    setF("assetId", assetId);
    if (!assetId || isPredictive) return;
    try {
      const asset = assets.find((a) => String(a.assetId) === String(assetId));
      if (!asset?.assetTypeId) return;
      const res = await assetTypeApi.getById(asset.assetTypeId);
      const t = res.data.data;
      if (
        t?.defaultPMValue &&
        t?.defaultPMUnit &&
        t.defaultPMUnit !== "HOURS"
      ) {
        patchForm({
          frequencyValue: t.defaultPMValue,
          frequencyUnit: t.defaultPMUnit,
        });
      }
    } catch {
      /* bỏ qua lỗi fetch, không block */
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Tên lịch *"
          value={form.scheduleName ?? ""}
          onChange={(e) => setF("scheduleName", e.target.value)}
          placeholder="VD: PM máy lọc bụi tháng 1"
        />
        <Select
          label="Tài sản *"
          value={form.assetId ?? ""}
          onChange={(e) => handleAssetChange(e.target.value)}
        >
          <option value="">— Chọn tài sản —</option>
          {assets.map((a) => (
            <option key={a.assetId} value={a.assetId}>
              {a.assetName}
            </option>
          ))}
        </Select>
        <Select
          label="Kiểu lịch *"
          value={form.scheduleKind ?? "periodic"}
          onChange={(e) => {
            const kind = e.target.value;
            if (kind === "predictive") {
              patchForm({
                scheduleKind: "predictive",
                maintenanceType: "PREDICTIVE",
                frequencyUnit: "HOURS",
                frequencyValue:
                  form.frequencyUnit === "HOURS"
                    ? Number(form.frequencyValue) || 720
                    : 720,
              });
            } else {
              const u =
                form.frequencyUnit === "HOURS"
                  ? "DAYS"
                  : (form.frequencyUnit ?? "DAYS");
              patchForm({
                scheduleKind: "periodic",
                maintenanceType: "PREVENTIVE",
                frequencyUnit: u,
                frequencyValue:
                  form.frequencyUnit === "HOURS"
                    ? 30
                    : Number(form.frequencyValue) || 30,
              });
            }
          }}
        >
          <option value="periodic">Định kỳ (ngày / tuần / tháng / năm)</option>
          <option value="predictive">Dự báo (theo giờ chạy máy)</option>
        </Select>
        {isPredictive ? (
          <Input
            label="Ngưỡng giờ chạy (tích lũy) *"
            type="number"
            min={1}
            value={form.frequencyValue ?? 720}
            onChange={(e) => setF("frequencyValue", e.target.value)}
          />
        ) : (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                label="Tần suất *"
                type="number"
                min={1}
                value={form.frequencyValue ?? 30}
                onChange={(e) => setF("frequencyValue", e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Select
                label="Đơn vị *"
                value={form.frequencyUnit ?? "DAYS"}
                onChange={(e) => setF("frequencyUnit", e.target.value)}
              >
                <option value="DAYS">Ngày</option>
                <option value="WEEKS">Tuần</option>
                <option value="MONTHS">Tháng</option>
                <option value="YEARS">Năm</option>
              </Select>
            </div>
          </div>
        )}
        {isPredictive && (
          <p className="text-sm text-gray-600 col-span-2">
            Đơn vị: <strong>giờ chạy tích lũy</strong> — khi nhập đồng hồ máy
            vượt ngưỡng, hệ thống tự tạo phiếu PM chờ duyệt (không dùng nút WO
            trên dòng lịch).
          </p>
        )}
        {!isPredictive && (
          <p className="text-xs text-blue-600 col-span-2 -mt-1">
            💡 Chọn tài sản sẽ tự gợi ý tần suất từ loại thiết bị (có thể sửa
            lại).
          </p>
        )}
        <Input
          label="Ngày bắt đầu *"
          type="date"
          value={form.startDate ?? ""}
          onChange={(e) => setF("startDate", e.target.value)}
        />
        <Input
          label="Ngày kết thúc"
          type="date"
          value={form.endDate ?? ""}
          onChange={(e) => setF("endDate", e.target.value)}
        />
      </div>
      <Textarea
        label="Mô tả công việc *"
        value={form.description ?? ""}
        onChange={(e) => setF("description", e.target.value)}
        placeholder="Mô tả nội dung bảo trì cần thực hiện..."
      />
      {!isPredictive && form.startDate && (
        <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
          Ngày đến hạn đầu tiên: <strong>{fDate(form.startDate)}</strong> +{" "}
          {form.frequencyValue}{" "}
          {UNIT_LABEL[form.frequencyUnit] ?? form.frequencyUnit}. Sau khi
          tạo/hoàn thành WO, hệ thống tự tính chu kỳ tiếp theo.
        </p>
      )}
      {isPredictive && (
        <p className="text-xs text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2">
          Lịch dự báo theo giờ — dựa trên bộ đếm tài sản và trung bình giờ/ngày;
          không tạo phiếu từ nút WO trên lịch.
        </p>
      )}
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
  const [editItem, setEditItem] = useState(null); // lịch đang sửa
  const [deleteItem, setDeleteItem] = useState(null); // lịch đang xóa
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

  const validateForm = (f) => {
    if (!f.assetId || !f.scheduleName?.trim() || !f.startDate) {
      toast.error("Vui lòng điền đầy đủ: Tài sản, Tên lịch, Ngày bắt đầu");
      return false;
    }
    if (!f.description?.trim()) {
      toast.error("Vui lòng nhập mô tả công việc");
      return false;
    }
    if (!f.frequencyValue || Number(f.frequencyValue) < 1) {
      toast.error("Tần suất hoặc ngưỡng giờ phải ≥ 1");
      return false;
    }
    return true;
  };

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

  const openEdit = (s) => {
    setForm(mapScheduleToForm(s));
    setEditItem(s);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!validateSharedScheduleForm(form, toast.error)) return;
    setSaving(true);
    try {
      await scheduleApi.update(editItem.scheduleId, buildSchedulePayload(form));
      toast.success("Đã cập nhật lịch bảo trì");
      setEditItem(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi cập nhật");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setSaving(true);
    try {
      await scheduleApi.remove(deleteItem.scheduleId);
      toast.success("Đã xóa lịch bảo trì");
      setDeleteItem(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi xóa");
    } finally {
      setSaving(false);
    }
  };

  const canCreateSch = canDo(user, "SCHEDULE:CREATE");
  const canUpdateSch = canDo(user, "SCHEDULE:UPDATE");
  const canSubmitSch = canDo(user, "SCHEDULE:SUBMIT");
  const canCreateWo = canDo(user, "WORK_ORDER:CREATE");
  const canDeleteSch = canDo(user, "SCHEDULE:DELETE");
  const adminBypass = (user?.positionLevel ?? 0) >= 4;

  const isOperational = (s) =>
    ["PENDING", "IN_PROGRESS", "OVERDUE"].includes(s.status);
  const canEditRow = (s) =>
    adminBypass || ["DRAFT", "REJECTED"].includes(s.status);
  const canDeleteRow = (s) =>
    adminBypass || ["DRAFT", "REJECTED"].includes(s.status);

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

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-blue-950">
        <p className="font-bold text-blue-900 mb-1">
          Luồng lịch → phiếu việc → hiện trường
        </p>
        <ul className="list-disc pl-5 space-y-1 text-blue-900/90 leading-relaxed">
          <li>
            Sau khi <strong>Thêm lịch</strong>, trạng thái là{" "}
            <strong>Bản nháp</strong> — bấm <strong>Gửi</strong> trên dòng đó để
            vào <strong>Chờ duyệt</strong>, rồi xử lý tại menu{" "}
            <strong>Phê duyệt</strong>.
          </li>
          <li>
            <strong>Lịch</strong> phải được duyệt trước (trạng thái{" "}
            <strong>Chờ TH</strong> trên lịch = kế hoạch đã OK, chờ đến hạn thực
            hiện).
          </li>
          <li>
            Lịch <strong>định kỳ</strong>: nút <strong>WO</strong> hoặc
            scheduler (đến hạn) tạo <strong>phiếu việc</strong>{" "}
            <strong>Chờ thực hiện</strong> — <em>không</em> phê duyệt lại phiếu.
            Lịch <strong>dự báo theo giờ</strong> không có nút WO — phiếu tự
            sinh khi vượt ngưỡng giờ chạy (chờ duyệt phiếu).
          </li>
          <li>
            Trưởng ca / Trưởng phòng <strong>phân công</strong> KTV hiện trường
            hoặc Chuyên viên KTS trên chi tiết phiếu; người được giao xem phiếu
            tại <strong>Phiếu việc</strong> + thông báo.
          </li>
          <li>
            Tại máy: mở <strong>Checklist / QR</strong> (mã tài sản) để xem
            SOP/tài liệu — QR ở đây là <strong>nhận diện thiết bị</strong>,
            không phải khoá vật lý trừ khi nhà máy tích hợp thêm.
          </li>
        </ul>
      </div>

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
        <div className="flex justify-end">
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
                        {s.checklistTemplateName ? (
                          <Badge color="indigo">
                            {s.checklistTemplateName}
                          </Badge>
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
                                title="Gửi Trưởng phòng duyệt"
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
                          {canUpdateSch && canEditRow(s) && (
                            <button
                              type="button"
                              onClick={() => openEdit(s)}
                              title="Sửa lịch"
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {canDeleteSch && canDeleteRow(s) && (
                            <button
                              type="button"
                              onClick={() => setDeleteItem(s)}
                              title="Xóa lịch"
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
            <Button type="submit" loading={saving}>
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal xác nhận Xóa */}
      <Modal
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        title="Xác nhận xóa"
        size="sm"
      >
        {deleteItem && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Bạn có chắc muốn xóa lịch bảo trì{" "}
              <strong>"{deleteItem.scheduleName}"</strong> của tài sản{" "}
              <strong>{deleteItem.assetName}</strong>?
            </p>
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDeleteItem(null)}>
                Hủy
              </Button>
              <Button variant="danger" onClick={handleDelete} loading={saving}>
                <Trash2 size={14} /> Xóa lịch
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
