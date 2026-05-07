/**
 * WorkOrderListPage.jsx — Danh sách phiếu việc (card, cờ phê duyệt).
 * RBAC: nút tạo khi canDo(WORK_ORDER:CREATE).
 * Cờ từ API: needsApprovalResubmit (sau YC chỉnh sửa), approvalHasPending (đang có bước PENDING).
 * Tab "Đã lưu trữ" (chỉ Admin) — phiếu IsDeleted=1: chỉ xem, có thể khôi phục.
 * Action 3 icon (Eye/Pencil/Trash2): hiển thị theo canEditWorkOrderRow / canDeleteWorkOrderRow.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  ChevronRight,
  Wrench,
  MapPin,
  Calendar,
  AlertCircle,
  RotateCcw,
  FileSpreadsheet,
  Eye,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { workOrderApi } from "../../api/workOrder.api.js";
import { assetApi } from "../../api/asset.api.js";
import { Button } from "../../components/ui/Button.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Select } from "../../components/ui/Input.jsx";
import { Pagination } from "../../components/ui/Pagination.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { PageLoader } from "../../components/ui/Spinner.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import {
  WO_STATUS_LABEL,
  WO_STATUS_COLOR,
  WO_PRIORITY_LABEL,
  WO_PRIORITY_COLOR,
  fDate,
  todayDateInput,
  dateInputWithOffset,
} from "../../utils/format.js";
import { WorkOrderForm } from "./WorkOrderForm.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import {
  canDo,
  canEditWorkOrderRow,
  canDeleteWorkOrderRow,
  canViewArchivedWorkOrders,
  canRestoreWorkOrder,
} from "../../utils/rbac.js";
import { exportRowsToExcel } from "../../utils/excelExport.js";
import toast from "react-hot-toast";

const STATUS_TABS = [
  {
    key: "",
    label: "Tất cả",
    color:
      "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50",
  },
  {
    key: "PENDING_APPROVAL",
    label: "Chờ duyệt",
    color: "bg-yellow-50 border-yellow-200 text-yellow-800",
  },
  {
    key: "WAITING",
    label: "Chờ thực hiện",
    color: "bg-blue-50 border-blue-200 text-blue-800",
  },
  {
    key: "IN_PROGRESS",
    label: "Đang thực hiện",
    color: "bg-indigo-50 border-indigo-200 text-indigo-800",
  },
  {
    key: "AWAITING_CLOSURE",
    label: "Chờ nghiệm thu",
    color: "bg-violet-50 border-violet-200 text-violet-900",
  },
  {
    key: "COMPLETED",
    label: "Hoàn thành",
    color: "bg-green-50 border-green-200 text-green-800",
  },
  {
    key: "CANCELLED",
    label: "Đã hủy",
    color: "bg-gray-50 border-gray-200 text-gray-800",
  },
];

function isTruthyDbFlag(v) {
  return v === true || v === 1 || v === "1";
}

export function WorkOrderListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [woSource, setWoSource] = useState("");
  const [assetId, setAssetId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [period, setPeriod] = useState("");
  const [q, setQ] = useState("");
  const [assets, setAssets] = useState([]);
  const [locations, setLocations] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [restoreItem, setRestoreItem] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  /** archivedMode: tab "Đã lưu trữ" — chỉ Admin (canViewArchivedWorkOrders). */
  const [archivedMode, setArchivedMode] = useState(false);
  const canSeeArchived = canViewArchivedWorkOrders(user);
  const canRestore = canRestoreWorkOrder(user);
  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = {
        page,
        limit: LIMIT,
        ...(status && { status }),
        ...(priority && { priority }),
        ...(woSource && { woSource }),
        ...(assetId && { assetId }),
        ...(locationId && { locationId }),
        ...(resourceType && !archivedMode && { resourceType }),
        ...(q.trim() && { q: q.trim() }),
        ...(period && {
          plannedFrom:
            period === "week"
              ? dateInputWithOffset(-6)
              : period === "month"
                ? dateInputWithOffset(-29)
                : period === "quarter"
                  ? dateInputWithOffset(-89)
                  : undefined,
          plannedTo: todayDateInput(),
        }),
      };
      const res = archivedMode
        ? await workOrderApi.getArchived(queryParams)
        : await workOrderApi.getAll(queryParams);
      setOrders(res.data.data?.items ?? []);
      setTotal(res.data.data?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    status,
    priority,
    woSource,
    assetId,
    locationId,
    resourceType,
    period,
    q,
    archivedMode,
  ]);

  useEffect(() => {
    assetApi
      .getAll({ limit: 200 })
      .then((r) => setAssets(r.data.data?.items ?? []))
      .catch(() => {});
    assetApi
      .getLocations()
      .then((r) => setLocations(r.data.data ?? []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const stop = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const openView = (wo, e) => {
    if (e) stop(e);
    navigate(`/work-orders/${wo.woId}`);
  };

  const openEdit = (wo, e) => {
    if (e) stop(e);
    setEditItem(wo);
  };

  const openDelete = (wo, e) => {
    if (e) stop(e);
    setDeleteItem(wo);
  };

  const openRestore = (wo, e) => {
    if (e) stop(e);
    setRestoreItem(wo);
  };

  const handleConfirmDelete = async () => {
    if (!deleteItem) return;
    setActionLoading(true);
    try {
      await workOrderApi.remove(deleteItem.woId);
      toast.success(`Đã chuyển phiếu WO-${String(deleteItem.woId).padStart(4, "0")} vào lưu trữ`);
      setDeleteItem(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Không thể xoá phiếu việc");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreItem) return;
    setActionLoading(true);
    try {
      await workOrderApi.restore(restoreItem.woId);
      toast.success(`Đã khôi phục phiếu WO-${String(restoreItem.woId).padStart(4, "0")}`);
      setRestoreItem(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Không thể khôi phục phiếu");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportExcel = () => {
    const ok = exportRowsToExcel({
      rows: orders.map((wo) => ({
        "Mã phiếu việc": `WO-${String(wo.woId ?? "").padStart(4, "0")}`,
        "ID phiếu": wo.woId,
        "Tài sản": wo.assetName ?? "",
        "Vị trí": wo.locationName ?? "",
        "Trạng thái": WO_STATUS_LABEL[wo.status] ?? wo.status ?? "",
        "Ưu tiên": WO_PRIORITY_LABEL[wo.priority] ?? wo.priority ?? "",
        "Nguồn tạo": wo.woSource ?? "",
        "Mô tả": wo.description ?? "",
        "Ngày kế hoạch": fDate(wo.plannedDate) ?? "",
        "Ngày hoàn tất": fDate(wo.actualDate) ?? "",
        "Giờ ước tính": wo.estimatedHours ?? "",
        "Giờ thực tế": wo.actualHours ?? "",
      })),
      sheetName: "Phieu viec",
      fileName: `phieu-viec-trang-${page}.xlsx`,
    });
    if (!ok) {
      toast.error("Không có dữ liệu để xuất Excel");
      return;
    }
    toast.success("Đã xuất Excel danh sách phiếu việc");
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Phiếu việc
          </h1>
          {/* <p className="text-sm text-slate-500 mt-1">
            <span className="text-amber-700 font-medium">YC sửa</span> = giám
            sát yêu cầu chỉnh sửa — mở phiếu và{" "}
            <span className="font-medium text-slate-700">gửi lại duyệt</span>.{" "}
            <span className="text-amber-600 font-medium">Chờ duyệt</span> = đang
            có bước phê duyệt PENDING.
          </p> */}
        </div>
        {canDo(user, "WORK_ORDER:CREATE") && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleExportExcel}
              disabled={loading || orders.length === 0}
              title={
                orders.length === 0
                  ? "Không có dữ liệu để xuất"
                  : "Xuất Excel theo danh sách đang hiển thị"
              }
            >
              <FileSpreadsheet size={15} /> Xuất Excel
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="shrink-0">
              <Plus size={16} /> Tạo phiếu
            </Button>
          </div>
        )}
        {!canDo(user, "WORK_ORDER:CREATE") && (
          <Button
            variant="secondary"
            onClick={handleExportExcel}
            disabled={loading || orders.length === 0}
            title={
              orders.length === 0
                ? "Không có dữ liệu để xuất"
                : "Xuất Excel theo danh sách đang hiển thị"
            }
          >
            <FileSpreadsheet size={15} /> Xuất Excel
          </Button>
        )}
      </div>

      {canSeeArchived && (
        <div className="flex gap-1.5 border-b border-slate-200">
          <button
            type="button"
            onClick={() => {
              setArchivedMode(false);
              setStatus("");
              setPage(1);
            }}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors
              ${!archivedMode ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Wrench size={13} /> Đang hoạt động
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setArchivedMode(true);
              setStatus("");
              setPage(1);
            }}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors
              ${archivedMode ? "border-amber-700 text-amber-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Archive size={13} /> Đã lưu trữ
            </span>
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setStatus(tab.key);
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border
                ${
                  status === tab.key
                    ? "bg-slate-900 text-white border-slate-900 shadow-md"
                    : tab.color
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Select
          label=""
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-44 sm:min-w-[11rem]"
        >
          <option value="">Mọi ưu tiên</option>
          {Object.entries(WO_PRIORITY_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Tìm WO-ID, mô tả, tài sản..."
          className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none bg-white"
        />
        <Select
          value={woSource}
          onChange={(e) => {
            setWoSource(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Mọi nguồn</option>
          <option value="MANUAL">Thủ công</option>
          <option value="SCHEDULE">Từ lịch</option>
          <option value="PREDICTIVE">Dự báo</option>
          <option value="CORRECTIVE">Sự cố</option>
          <option value="EMERGENCY">Khẩn cấp</option>
        </Select>
        <Select
          value={assetId}
          onChange={(e) => {
            setAssetId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả tài sản</option>
          {assets.map((a) => (
            <option key={a.assetId} value={a.assetId}>
              {a.assetName}
            </option>
          ))}
        </Select>
        <Select
          value={locationId}
          onChange={(e) => {
            setLocationId(e.target.value);
            setPage(1);
          }}
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
          value={resourceType}
          onChange={(e) => {
            setResourceType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Nguồn lực: tất cả</option>
          <option value="UNASSIGNED">Chưa phân công</option>
          <option value="INDIVIDUAL">Nhân viên (1 người)</option>
          <option value="GROUP">Nhóm (&gt;=2 người)</option>
        </Select>
        <Select
          value={period}
          onChange={(e) => {
            setPeriod(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Thời gian: tất cả</option>
          <option value="week">7 ngày gần đây</option>
          <option value="month">30 ngày gần đây</option>
          <option value="quarter">90 ngày gần đây</option>
        </Select>
        <Button
          variant="secondary"
          onClick={() => {
            setStatus("");
            setPriority("");
            setWoSource("");
            setAssetId("");
            setLocationId("");
            setResourceType("");
            setPeriod("");
            setQ("");
            setPage(1);
          }}
        >
          Xóa bộ lọc
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/50 overflow-hidden min-h-[200px]">
        {loading ? (
          <PageLoader />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="Không có phiếu"
            description="Đổi bộ lọc hoặc tạo phiếu mới."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {orders.map((wo) => {
              const pending = isTruthyDbFlag(wo.approvalHasPending);
              const resubmit = isTruthyDbFlag(wo.needsApprovalResubmit);
              const stLabel = WO_STATUS_LABEL[wo.status] ?? wo.status;
              const prLabel = WO_PRIORITY_LABEL[wo.priority] ?? wo.priority;
              const showEdit = !archivedMode && canEditWorkOrderRow(user, wo);
              const showDelete = !archivedMode && canDeleteWorkOrderRow(user, wo);
              const showRestore = archivedMode && canRestore;
              return (
                <li
                  key={wo.woId}
                  onClick={() => navigate(`/work-orders/${wo.woId}`)}
                  className={`flex flex-col sm:flex-row sm:items-stretch gap-3 sm:gap-4 p-4 sm:px-5 sm:py-4
                      hover:bg-slate-50/90 transition-colors group cursor-pointer
                      ${archivedMode ? "bg-amber-50/40" : ""}
                      ${resubmit ? "border-l-4 border-l-amber-400 pl-3 sm:pl-4" : "border-l-4 border-l-transparent"}`}
                >
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                        WO-{String(wo.woId).padStart(4, "0")}
                      </span>
                      {archivedMode && (
                        <Badge color="amber" className="gap-1">
                          <Archive size={11} aria-hidden />
                          Đã lưu trữ
                        </Badge>
                      )}
                      {resubmit && (
                        <Badge color="orange" className="gap-1">
                          <RotateCcw size={11} aria-hidden />
                          YC sửa
                        </Badge>
                      )}
                      {wo.status === "PENDING_APPROVAL" &&
                        pending &&
                        !resubmit && <Badge color="yellow">Chờ duyệt</Badge>}
                      <Badge color={WO_STATUS_COLOR[wo.status] ?? "gray"}>
                        {stLabel}
                      </Badge>
                      <Badge color={WO_PRIORITY_COLOR[wo.priority] ?? "gray"}>
                        {prLabel}
                      </Badge>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1.5 py-0.5 rounded bg-slate-100">
                        {wo.woSource}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-1.5 py-0.5 rounded bg-slate-100">
                        {Number(wo.assignmentCount ?? 0) === 0
                          ? "Chưa phân công"
                          : Number(wo.assignmentCount ?? 0) === 1
                            ? "Nhân viên"
                            : "Nhóm"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-snug line-clamp-2">
                      {wo.description?.trim() || (
                        <span className="text-slate-400 italic">
                          Không có mô tả
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                        <Wrench size={12} className="text-slate-400 shrink-0" />
                        {wo.assetName}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} className="text-slate-400 shrink-0" />
                        {wo.locationName ?? "—"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar
                          size={12}
                          className="text-slate-400 shrink-0"
                        />
                        {fDate(wo.plannedDate)}
                      </span>
                      {wo.actualDate && (
                        <span>Hoàn tất: {fDate(wo.actualDate)}</span>
                      )}
                      {wo.estimatedHours != null &&
                        Number(wo.estimatedHours) > 0 && (
                          <span>Ước tính ~{wo.estimatedHours}h</span>
                        )}
                      {wo.actualHours != null &&
                        Number(wo.actualHours) > 0 && (
                          <span>Thực tế {wo.actualHours}h</span>
                        )}
                      {archivedMode && wo.deletedAt && (
                        <span className="text-amber-700">
                          Lưu trữ: {fDate(wo.deletedAt)}
                          {wo.deletedByName ? ` • ${wo.deletedByName}` : ""}
                        </span>
                      )}
                    </div>
                    {resubmit && !archivedMode && (
                      <p className="text-xs text-amber-800/90 flex items-center gap-1.5">
                        <AlertCircle
                          size={14}
                          className="shrink-0"
                          aria-hidden
                        />
                        <span>Chi tiết → sửa (nếu cần) → gửi lại duyệt.</span>
                      </p>
                    )}
                  </div>
                  <div className="flex sm:flex-col items-center justify-end gap-1 shrink-0 sm:border-l sm:border-slate-100 sm:pl-3">
                    <button
                      type="button"
                      title="Xem chi tiết"
                      onClick={(e) => openView(wo, e)}
                      className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Eye size={16} />
                    </button>
                    {showEdit && (
                      <button
                        type="button"
                        title="Chỉnh sửa"
                        onClick={(e) => openEdit(wo, e)}
                        className="p-2 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {showDelete && (
                      <button
                        type="button"
                        title="Xoá (chuyển vào lưu trữ)"
                        onClick={(e) => openDelete(wo, e)}
                        className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    {showRestore && (
                      <button
                        type="button"
                        title="Khôi phục phiếu"
                        onClick={(e) => openRestore(wo, e)}
                        className="p-2 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                      >
                        <ArchiveRestore size={16} />
                      </button>
                    )}
                    <ChevronRight
                      size={18}
                      className="hidden sm:block text-slate-300 group-hover:text-blue-500 transition-colors"
                      aria-hidden
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={Math.ceil(total / LIMIT) || 1}
        onChange={setPage}
      />

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tạo phiếu việc mới"
        size="lg"
      >
        <WorkOrderForm
          onSuccess={() => {
            setCreateOpen(false);
            load();
            toast.success("Đã tạo phiếu việc");
          }}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      <Modal
        open={!!editItem}
        onClose={() => setEditItem(null)}
        title={
          editItem
            ? `Chỉnh sửa WO-${String(editItem.woId).padStart(4, "0")}`
            : "Chỉnh sửa phiếu việc"
        }
        size="lg"
      >
        {editItem && (
          <WorkOrderForm
            wo={editItem}
            onSuccess={() => {
              setEditItem(null);
              load();
              toast.success("Đã cập nhật phiếu việc");
            }}
            onCancel={() => setEditItem(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteItem}
        title="Xác nhận xoá phiếu việc"
        message={
          deleteItem
            ? `Bạn có muốn xoá phiếu WO-${String(deleteItem.woId).padStart(4, "0")} (${deleteItem.assetName ?? "—"}) không? Phiếu sẽ được chuyển vào kho lưu trữ — chỉ Quản trị viên mới truy cập và khôi phục được.`
            : ""
        }
        confirmLabel="Xoá phiếu"
        cancelLabel="Không"
        variant="danger"
        loading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteItem(null)}
      />

      <ConfirmDialog
        open={!!restoreItem}
        title="Khôi phục phiếu việc"
        message={
          restoreItem
            ? `Khôi phục phiếu WO-${String(restoreItem.woId).padStart(4, "0")} (${restoreItem.assetName ?? "—"}) về danh sách hoạt động? Phiếu sẽ giữ nguyên trạng thái trước khi lưu trữ.`
            : ""
        }
        confirmLabel="Khôi phục"
        cancelLabel="Huỷ"
        loading={actionLoading}
        onConfirm={handleConfirmRestore}
        onCancel={() => setRestoreItem(null)}
      />
    </div>
  );
}
