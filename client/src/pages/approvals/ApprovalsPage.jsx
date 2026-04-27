/**
 * ApprovalsPage.jsx — Phê duyệt / xử lý (Trưởng ca, Trưởng phòng theo bước workflow).
 * WO 2 bước chỉ cho sự cố nghiêm trọng (EMERGENCY hoặc CORRECTIVE+HIGH); hiển thị vai trò từng bước.
 * Hiển thị đủ ngữ cảnh: loại tài nguyên, mẫu luồng, tài sản, vị trí, mô tả chi tiết theo từng loại.
 * Dữ liệu mở rộng: approvalLog.model.js findPendingForPosition.
 * Duyệt WO: có thể nhập Giờ ước tính (gửi kèm POST approve → WorkOrders.EstimatedHours).
 */
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  RefreshCw,
  Wrench,
  FileText,
  Calendar,
  ChevronRight,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { approvalApi } from "../../api/approval.api.js";
import { employeeApi } from "../../api/employee.api.js";
import { api } from "../../api/index.js";
import { Badge } from "../../components/ui/Badge.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { Input, Select, Textarea } from "../../components/ui/Input.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { PageLoader } from "../../components/ui/Spinner.jsx";
import {
  fDateTime,
  fDate,
  fNumber,
  toDateInputValue,
  WO_STATUS_LABEL,
  WO_PRIORITY_LABEL,
} from "../../utils/format.js";
import toast from "react-hot-toast";

const RESOURCE_CONFIG = {
  WORK_ORDER: { label: "Phiếu việc", icon: Wrench, color: "blue" },
  DIGITAL_ASSET: { label: "Tài liệu số", icon: FileText, color: "purple" },
  MAINTENANCE_PLAN: {
    label: "Kế hoạch bảo trì",
    icon: Calendar,
    color: "green",
  },
};

const WO_SOURCE_LABEL = {
  SCHEDULE: "Từ lịch",
  PREDICTIVE: "Dự đoán",
  MANUAL: "Thủ công",
  CORRECTIVE: "Khắc phục",
};
const SCHEDULE_TYPE_LABEL = {
  PREVENTIVE: "Định kỳ",
  PREDICTIVE: "Dự đoán",
  CORRECTIVE: "Khắc phục",
};
const SCHEDULE_PRIORITY_LABEL = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  URGENT: "Khẩn",
};
const FREQ_UNIT_LABEL = {
  HOURS: "giờ",
  DAYS: "ngày",
  WEEKS: "tuần",
  MONTHS: "tháng",
  YEARS: "năm",
};
const SCHEDULE_STATUS_LABEL = {
  DRAFT: "Bản nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  PENDING: "Chờ TH",
  IN_PROGRESS: "Đang TH",
  COMPLETED: "Hoàn thành",
  OVERDUE: "Quá hạn",
  CANCELLED: "Hủy",
  REJECTED: "Từ chối",
};
const DOC_STATUS_LABEL = {
  DRAFT: "Bản nháp",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  ARCHIVED: "Lưu trữ",
};

function formatFreq(v, unit) {
  if (v == null || !unit) return null;
  const u = FREQ_UNIT_LABEL[unit] ?? unit;
  return `${v} ${u}`;
}

/** Một dòng trong khối chi tiết — ẩn nếu không có giá trị */
function DetailRow({ label, children }) {
  if (children == null || children === "") return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,140px)_1fr] gap-1 sm:gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </span>
      <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">
        {children}
      </div>
    </div>
  );
}

function listSummaryLine(item) {
  const parts = [];
  if (item.resourceType === "WORK_ORDER") {
    if (item.woPlannedDate)
      parts.push(`Kế hoạch: ${fDate(item.woPlannedDate)}`);
    if (item.woPriority)
      parts.push(WO_PRIORITY_LABEL[item.woPriority] ?? item.woPriority);
    if (item.woSource)
      parts.push(WO_SOURCE_LABEL[item.woSource] ?? item.woSource);
    if (item.woEstimatedHours != null)
      parts.push(`${item.woEstimatedHours} giờ ước tính`);
  } else if (item.resourceType === "MAINTENANCE_PLAN") {
    if (item.scheduleMaintenanceType)
      parts.push(
        SCHEDULE_TYPE_LABEL[item.scheduleMaintenanceType] ??
          item.scheduleMaintenanceType,
      );
    const fq = formatFreq(
      item.scheduleFrequencyValue,
      item.scheduleFrequencyUnit,
    );
    if (fq) parts.push(`Tần suất: ${fq}`);
    if (item.scheduleStartDate)
      parts.push(`Bắt đầu ${fDate(item.scheduleStartDate)}`);
  } else if (item.resourceType === "DIGITAL_ASSET") {
    if (item.digitalFileType) parts.push(item.digitalFileType);
    if (item.digitalCurrentVersion != null)
      parts.push(`Phiên bản ${item.digitalCurrentVersion}`);
    if (item.digitalFileSizeKb != null)
      parts.push(`${fNumber(item.digitalFileSizeKb)} KB`);
  }
  return parts.length ? parts.join(" · ") : null;
}

function ApprovalDetailPanel({ item }) {
  const docLink = item.resourceType === "DIGITAL_ASSET" ? `/documents` : null;
  const woLink =
    item.resourceType === "WORK_ORDER"
      ? `/work-orders/${item.resourceId}`
      : null;

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-1 max-h-[min(52vh,480px)] overflow-y-auto">
      <DetailRow label="Mẫu luồng">{item.workflowName}</DetailRow>
      <DetailRow label="Mã tham chiếu">#{item.resourceId}</DetailRow>
      <DetailRow label="Cấp duyệt">
        Bước {item.currentLevel} / {item.totalLevels}
        {item.stepPositionName ? (
          <span className="block text-gray-700 font-semibold mt-0.5">
            Vai trò: {item.stepPositionName}
          </span>
        ) : null}
      </DetailRow>
      <DetailRow label="Người gửi">{item.submitterName}</DetailRow>
      <DetailRow label="Gửi lúc">{fDateTime(item.actionDate)}</DetailRow>
      <DetailRow label="Trạng thái tài nguyên">
        {item.resourceType === "WORK_ORDER" && item.resourceStatus
          ? (WO_STATUS_LABEL[item.resourceStatus] ?? item.resourceStatus)
          : item.resourceType === "MAINTENANCE_PLAN" && item.resourceStatus
            ? (SCHEDULE_STATUS_LABEL[item.resourceStatus] ??
              item.resourceStatus)
            : item.resourceType === "DIGITAL_ASSET" && item.resourceStatus
              ? (DOC_STATUS_LABEL[item.resourceStatus] ?? item.resourceStatus)
              : item.resourceStatus}
      </DetailRow>

      <DetailRow label="Tài sản liên quan">
        {item.resourceAssetName ? (
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">{item.resourceAssetName}</span>
            {item.resourceAssetLocation && (
              <span className="text-xs text-gray-600 flex items-center gap-1">
                <MapPin size={12} className="shrink-0" />{" "}
                {item.resourceAssetLocation}
              </span>
            )}
          </span>
        ) : (
          "—"
        )}
      </DetailRow>

      {item.resourceType === "WORK_ORDER" && (
        <>
          <DetailRow label="Tiêu đề / mô tả">
            {item.woFullDescription || item.resourceDescription}
          </DetailRow>
          <DetailRow label="Ngày dự kiến">
            {item.woPlannedDate ? fDate(item.woPlannedDate) : null}
          </DetailRow>
          <DetailRow label="Độ ưu tiên">
            {item.woPriority
              ? (WO_PRIORITY_LABEL[item.woPriority] ?? item.woPriority)
              : null}
          </DetailRow>
          <DetailRow label="Nguồn WO">
            {item.woSource
              ? (WO_SOURCE_LABEL[item.woSource] ?? item.woSource)
              : null}
          </DetailRow>
          <DetailRow label="Giờ ước tính">
            {item.woEstimatedHours != null
              ? String(item.woEstimatedHours)
              : null}
          </DetailRow>
          {item.woScheduleId != null && (
            <DetailRow label="Lịch nguồn">#{item.woScheduleId}</DetailRow>
          )}
        </>
      )}

      {item.resourceType === "MAINTENANCE_PLAN" && (
        <>
          <DetailRow label="Tên lịch">{item.resourceDescription}</DetailRow>
          <DetailRow label="Nội dung công việc">
            {item.scheduleDescription}
          </DetailRow>
          <DetailRow label="Loại bảo trì">
            {item.scheduleMaintenanceType
              ? (SCHEDULE_TYPE_LABEL[item.scheduleMaintenanceType] ??
                item.scheduleMaintenanceType)
              : null}
          </DetailRow>
          <DetailRow label="Tần suất">
            {formatFreq(
              item.scheduleFrequencyValue,
              item.scheduleFrequencyUnit,
            )}
          </DetailRow>
          <DetailRow label="Ưu tiên lịch">
            {item.schedulePriority
              ? (SCHEDULE_PRIORITY_LABEL[item.schedulePriority] ??
                item.schedulePriority)
              : null}
          </DetailRow>
          <DetailRow label="Ngày bắt đầu">
            {item.scheduleStartDate ? fDate(item.scheduleStartDate) : null}
          </DetailRow>
          <DetailRow label="Đến hạn tiếp">
            {item.scheduleNextDueDate ? fDate(item.scheduleNextDueDate) : null}
          </DetailRow>
          <DetailRow label="Thời gian ước tính (phút)">
            {item.scheduleEstimatedTime != null
              ? String(item.scheduleEstimatedTime)
              : null}
          </DetailRow>
        </>
      )}

      {item.resourceType === "DIGITAL_ASSET" && (
        <>
          <DetailRow label="Tên file">{item.resourceDescription}</DetailRow>
          <DetailRow label="Định dạng">{item.digitalFileType}</DetailRow>
          <DetailRow label="Mô tả">{item.digitalDescription}</DetailRow>
          <DetailRow label="Phiên bản">
            {item.digitalCurrentVersion != null
              ? String(item.digitalCurrentVersion)
              : null}
          </DetailRow>
          <DetailRow label="Tải lên">
            {item.digitalUploadDate ? fDateTime(item.digitalUploadDate) : null}
          </DetailRow>
          <DetailRow label="Dung lượng">
            {item.digitalFileSizeKb != null
              ? `${fNumber(item.digitalFileSizeKb)} KB`
              : null}
          </DetailRow>
        </>
      )}

      <div className="pt-3 flex flex-wrap gap-2">
        {woLink && (
          <Link
            to={woLink}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
          >
            <ExternalLink size={12} /> Mở phiếu việc
          </Link>
        )}
        {docLink && (
          <Link
            to={docLink}
            className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:underline"
          >
            <ExternalLink size={12} /> Mở kho tài liệu
          </Link>
        )}
        {item.resourceType === "MAINTENANCE_PLAN" && (
          <Link
            to="/schedules"
            className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline"
          >
            <ExternalLink size={12} /> Danh sách lịch bảo trì
          </Link>
        )}
      </div>
    </div>
  );
}

export function ApprovalsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState("APPROVED");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  /** Phân công ngay khi duyệt xong WO (bước cuối) — tuỳ chọn */
  const [assignMode, setAssignMode] = useState("individual");
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignGroupId, setAssignGroupId] = useState("");
  const [assignGroups, setAssignGroups] = useState([]);
  const [assignGroupMembers, setAssignGroupMembers] = useState([]);
  const [approveEstimatedHours, setApproveEstimatedHours] = useState("");
  const [approvePlannedDate, setApprovePlannedDate] = useState("");
  const [approvePriority, setApprovePriority] = useState("");
  const [approveDescription, setApproveDescription] = useState("");
  const [fieldEmployees, setFieldEmployees] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await approvalApi.getPending();
      setItems(res.data.data?.items ?? res.data.data ?? []);
    } catch {
      toast.error("Lỗi tải danh sách phê duyệt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isWoFinalStep = (item) =>
    item?.resourceType === "WORK_ORDER" &&
    Number(item?.currentLevel) === Number(item?.totalLevels);

  useEffect(() => {
    if (!selected || !isWoFinalStep(selected)) {
      setFieldEmployees([]);
      setAssignGroups([]);
      setAssignGroupMembers([]);
      return;
    }
    employeeApi
      .getAll({ limit: 300 })
      .then((r) => {
        const list = r.data.data?.items ?? [];
        setFieldEmployees(
          list.filter(
            (e) => e.isActive !== false && (e.positionLevel ?? 99) <= 2,
          ),
        );
      })
      .catch(() => setFieldEmployees([]));
    api
      .get("/maintenance-groups")
      .then((r) => setAssignGroups(r.data.data?.items ?? r.data.data ?? []))
      .catch(() => setAssignGroups([]));
  }, [selected]);

  useEffect(() => {
    if (
      !selected ||
      !isWoFinalStep(selected) ||
      assignMode !== "group" ||
      !assignGroupId
    ) {
      setAssignGroupMembers([]);
      return;
    }
    api
      .get(`/maintenance-groups/${assignGroupId}`)
      .then((r) => setAssignGroupMembers(r.data.data?.members ?? []))
      .catch(() => setAssignGroupMembers([]));
  }, [selected, assignMode, assignGroupId]);

  const handleAction = async () => {
    if (!selected) return;
    if (
      (action === "REJECTED" || action === "REQUEST_CHANGES") &&
      !comment.trim()
    ) {
      toast.error("Vui lòng nhập lý do khi từ chối hoặc yêu cầu chỉnh sửa");
      return;
    }
    setSaving(true);
    try {
      await approvalApi.action(selected.logId, {
        action,
        comment,
        assignEmployeeId:
          action === "APPROVED" &&
          assignMode === "individual" &&
          assignEmployeeId
            ? assignEmployeeId
            : undefined,
        assignGroupId:
          action === "APPROVED" && assignMode === "group" && assignGroupId
            ? assignGroupId
            : undefined,
        estimatedHours:
          action === "APPROVED" &&
          selected.resourceType === "WORK_ORDER" &&
          String(approveEstimatedHours).trim() !== ""
            ? approveEstimatedHours
            : undefined,
        plannedDate:
          action === "APPROVED" && selected.resourceType === "WORK_ORDER"
            ? approvePlannedDate
            : undefined,
        priority:
          action === "APPROVED" &&
          selected.resourceType === "WORK_ORDER" &&
          String(approvePriority).trim() !== ""
            ? approvePriority
            : undefined,
        description:
          action === "APPROVED" && selected.resourceType === "WORK_ORDER"
            ? approveDescription
            : undefined,
      });
      toast.success(
        action === "APPROVED"
          ? assignEmployeeId
            ? "Đã duyệt và phân công nhân việc."
            : "Đã phê duyệt!"
          : action === "REJECTED"
            ? "Đã từ chối"
            : "Đã gửi yêu cầu chỉnh sửa",
      );
      setSelected(null);
      setComment("");
      setAssignMode("individual");
      setAssignEmployeeId("");
      setAssignGroupId("");
      setAssignGroupMembers([]);
      setApproveEstimatedHours("");
      setApprovePlannedDate("");
      setApprovePriority("");
      setApproveDescription("");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi xử lý");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/80 to-white px-5 py-4 shadow-sm">
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="text-amber-600" size={22} />
          Phê duyệt &amp; xử lý
        </h1>
        <p className="text-sm text-gray-600 mt-1 max-w-3xl">
          Xem đủ thông tin từng yêu cầu (phiếu việc, lịch bảo trì, tài liệu)
          trước khi duyệt, từ chối hoặc yêu cầu chỉnh sửa. Danh sách chỉ hiện
          các bước thuộc chức danh của bạn trong mẫu luồng.
        </p>
        <p className="text-sm text-gray-700 mt-3 pt-3 border-t border-amber-100/80 leading-relaxed">
          <strong>Duyệt</strong> và <strong>phân công</strong> là hai việc khác
          nhau: duyệt chuyển phiếu sang <em>Chờ thực hiện</em> (hoặc bước tiếp
          theo nếu đa cấp). Phân công = gán KTV hiện trường / Chuyên viên KTS —
          có thể <strong>làm ngay khi duyệt bước cuối</strong> (ô bên dưới) hoặc{" "}
          <strong>để sau</strong> tại Chi tiết phiếu.{" "}
          <strong>Phiếu WO khẩn 2 bước</strong> (ưu tiên Khẩn cấp, hoặc sự cố
          khắc phục mức Cao): bước 1 Trưởng ca → bước 2 Trưởng phòng xác nhận;
          Trưởng phòng có thể <strong>chọn lại người phân công</strong> khi
          duyệt cuối. Các phiếu thường chỉ cần <strong>một bước</strong> (Trưởng
          ca).
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">
          {items.length} yêu cầu đang chờ xử lý
        </p>
        <Button variant="secondary" size="sm" onClick={load}>
          <RefreshCw size={13} /> Làm mới
        </Button>
      </div>

      {loading ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Không có yêu cầu phê duyệt"
          description="Tất cả đã được xử lý hoặc không có bước nào gán cho chức danh của bạn."
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
          {items.map((item) => {
            const cfg = RESOURCE_CONFIG[item.resourceType] ?? {
              label: item.resourceType,
              icon: ShieldCheck,
              color: "gray",
            };
            const Icon = cfg.icon;
            const summary = listSummaryLine(item);
            const title = item.resourceDescription || cfg.label;
            return (
              <div
                key={item.logId}
                className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50/80 transition-colors"
              >
                <div
                  className={`p-2.5 rounded-xl flex-shrink-0 ${
                    cfg.color === "blue"
                      ? "bg-blue-50"
                      : cfg.color === "purple"
                        ? "bg-purple-50"
                        : cfg.color === "green"
                          ? "bg-green-50"
                          : "bg-gray-50"
                  }`}
                >
                  <Icon
                    size={18}
                    className={
                      cfg.color === "blue"
                        ? "text-blue-600"
                        : cfg.color === "purple"
                          ? "text-purple-600"
                          : cfg.color === "green"
                            ? "text-green-600"
                            : "text-gray-500"
                    }
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge color={cfg.color}>{cfg.label}</Badge>
                    <Badge color="yellow">
                      Bước {item.currentLevel}/{item.totalLevels}
                      {item.stepPositionName
                        ? ` · ${item.stepPositionName}`
                        : ""}
                    </Badge>
                    <span className="font-mono text-xs font-bold text-gray-500">
                      #{item.resourceId}
                    </span>
                  </div>
                  {item.workflowName && (
                    <p className="text-xs text-gray-500 mb-1">
                      {item.workflowName}
                    </p>
                  )}
                  <p className="text-sm font-bold text-gray-900 leading-snug line-clamp-2">
                    {title}
                  </p>
                  {summary && (
                    <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                      {summary}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {item.resourceAssetName && (
                      <span className="text-xs text-gray-600">
                        <span className="text-gray-400">Tài sản:</span>{" "}
                        <strong className="text-gray-800">
                          {item.resourceAssetName}
                        </strong>
                        {item.resourceAssetLocation && (
                          <span className="text-gray-500">
                            {" "}
                            · {item.resourceAssetLocation}
                          </span>
                        )}
                      </span>
                    )}
                    {item.submitterName && (
                      <span className="text-xs text-gray-500">
                        Người gửi: <strong>{item.submitterName}</strong>
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {fDateTime(item.actionDate)}
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSelected(item);
                    setAction("APPROVED");
                    setComment("");
                    setAssignMode("individual");
                    setAssignEmployeeId("");
                    setAssignGroupId("");
                    setAssignGroupMembers([]);
                    setApproveEstimatedHours("");
                    setApprovePlannedDate(
                      toDateInputValue(item.resourcePlannedDate),
                    );
                    setApprovePriority(item.resourcePriority || "");
                    setApproveDescription(item.resourceDescription || "");
                  }}
                  className="flex-shrink-0 self-center"
                >
                  Xem &amp; xử lý <ChevronRight size={12} />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => {
          setSelected(null);
          setAssignMode("individual");
          setAssignEmployeeId("");
          setAssignGroupId("");
          setAssignGroupMembers([]);
          setApproveEstimatedHours("");
          setApprovePlannedDate("");
          setApprovePriority("");
          setApproveDescription("");
        }}
        title="Phê duyệt — xem đầy đủ thông tin"
        size="lg"
      >
        {selected && (
          <div className="space-y-4">
            <ApprovalDetailPanel item={selected} />

            <Select
              label="Hành động"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="APPROVED">✓ Duyệt</option>
              <option value="REJECTED">✗ Từ chối</option>
              <option value="REQUEST_CHANGES">↩ Yêu cầu chỉnh sửa</option>
            </Select>

            {selected.resourceType === "WORK_ORDER" &&
              action === "APPROVED" && (
                <div className="space-y-3">
                  <Input
                    label="Ngày dự kiến"
                    type="date"
                    value={approvePlannedDate}
                    onChange={(e) => setApprovePlannedDate(e.target.value)}
                  />
                  <Input
                    label="Giờ ước tính (giờ) — ghi vào phiếu khi duyệt"
                    type="number"
                    min={0}
                    step={0.5}
                    value={approveEstimatedHours}
                    onChange={(e) => setApproveEstimatedHours(e.target.value)}
                    placeholder="VD: 4 — để trống nếu không đổi"
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

            {selected.resourceType === "WORK_ORDER" &&
              isWoFinalStep(selected) &&
              action === "APPROVED" && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-3 space-y-2">
                  <Select
                    label="Kiểu phân công"
                    value={assignMode}
                    onChange={(e) => {
                      setAssignMode(e.target.value);
                      setAssignEmployeeId("");
                      setAssignGroupId("");
                      setAssignGroupMembers([]);
                    }}
                  >
                    <option value="individual">Cá nhân</option>
                    <option value="group">Nhóm</option>
                  </Select>
                  {assignMode === "individual" ? (
                    <Select
                      label="Phân công ngay (tuỳ chọn)"
                      value={assignEmployeeId}
                      onChange={(e) => setAssignEmployeeId(e.target.value)}
                    >
                      <option value="">
                        — Để sau: vào Phiếu việc → Phân công —
                      </option>
                      {fieldEmployees.map((e) => (
                        <option key={e.employeeId} value={e.employeeId}>
                          {e.fullName} — {e.positionName}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <>
                      <Select
                        label="Nhóm bảo trì (tuỳ chọn)"
                        value={assignGroupId}
                        onChange={(e) => setAssignGroupId(e.target.value)}
                      >
                        <option value="">
                          — Để sau: vào Phiếu việc → Phân công —
                        </option>
                        {assignGroups.map((g) => (
                          <option key={g.groupId} value={g.groupId}>
                            {g.groupName}
                            {g.specialty ? ` · ${g.specialty}` : ""}
                            {g.leaderName ? ` · TN: ${g.leaderName}` : ""}
                          </option>
                        ))}
                      </Select>
                      {assignGroupMembers.length > 0 && (
                        <div className="rounded-lg border border-blue-200 bg-white px-3 py-2">
                          <p className="text-xs font-semibold text-blue-900 mb-1">
                            Thành viên nhóm sẽ được phân công
                          </p>
                          <ul className="space-y-0.5">
                            {assignGroupMembers.map((m) => (
                              <li
                                key={m.employeeId}
                                className="text-xs text-gray-700"
                              >
                                {m.fullName}
                                {Number(m.isGroupLeader) === 1
                                  ? " (Trưởng nhóm)"
                                  : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

            <Textarea
              label={`Ghi chú${action !== "APPROVED" ? " *" : ""}`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                action === "APPROVED"
                  ? "Ghi chú khi duyệt (tuỳ chọn)"
                  : action === "REJECTED"
                    ? "Lý do từ chối (bắt buộc)"
                    : "Nội dung cần chỉnh sửa (bắt buộc)"
              }
              rows={3}
            />

            <div className="flex justify-end gap-3 pt-1">
              <Button
                variant="secondary"
                onClick={() => {
                  setSelected(null);
                  setAssignMode("individual");
                  setAssignEmployeeId("");
                  setAssignGroupId("");
                  setAssignGroupMembers([]);
                  setApproveEstimatedHours("");
                  setApprovePlannedDate("");
                  setApprovePriority("");
                  setApproveDescription("");
                }}
              >
                Đóng
              </Button>
              <Button
                variant={
                  action === "APPROVED"
                    ? "success"
                    : action === "REJECTED"
                      ? "danger"
                      : "primary"
                }
                onClick={handleAction}
                loading={saving}
              >
                {action === "APPROVED" ? (
                  <>
                    <CheckCircle size={14} /> Xác nhận duyệt
                  </>
                ) : action === "REJECTED" ? (
                  <>
                    <XCircle size={14} /> Từ chối
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} /> Yêu cầu sửa
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
