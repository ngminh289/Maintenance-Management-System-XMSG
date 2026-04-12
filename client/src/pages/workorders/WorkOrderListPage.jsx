/**
 * WorkOrderListPage.jsx — Danh sách phiếu việc (card, cờ phê duyệt).
 * RBAC: nút tạo khi canDo(WORK_ORDER:CREATE).
 * Cờ từ API: needsApprovalResubmit (sau YC chỉnh sửa), approvalHasPending (đang có bước PENDING).
 */
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  ChevronRight,
  Wrench,
  MapPin,
  Calendar,
  AlertCircle,
  RotateCcw,
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
import {
  WO_STATUS_LABEL,
  WO_STATUS_COLOR,
  WO_PRIORITY_LABEL,
  WO_PRIORITY_COLOR,
  fDate,
} from "../../utils/format.js";
import { WorkOrderForm } from "./WorkOrderForm.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { canDo } from "../../utils/rbac.js";
import toast from "react-hot-toast";

const STATUS_TABS = [
  { key: "", label: "Tất cả" },
  { key: "PENDING_APPROVAL", label: "Chờ duyệt" },
  { key: "WAITING", label: "Chờ TH" },
  { key: "IN_PROGRESS", label: "Đang TH" },
  { key: "AWAITING_CLOSURE", label: "Chờ NT" },
  { key: "COMPLETED", label: "Hoàn thành" },
  { key: "CANCELLED", label: "Đã hủy" },
];

function isTruthyDbFlag(v) {
  return v === true || v === 1 || v === "1";
}

export function WorkOrderListPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [assets, setAssets] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workOrderApi.getAll({
        page,
        limit: LIMIT,
        ...(status && { status }),
        ...(priority && { priority }),
      });
      setOrders(res.data.data?.items ?? []);
      setTotal(res.data.data?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, status, priority]);

  useEffect(() => {
    assetApi
      .getAll({ limit: 200 })
      .then((r) => setAssets(r.data.data?.items ?? []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Phiếu việc
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            <span className="text-amber-700 font-medium">YC sửa</span> = giám sát yêu cầu chỉnh sửa — mở phiếu và{" "}
            <span className="font-medium text-slate-700">gửi lại duyệt</span>.
            {" "}
            <span className="text-amber-600 font-medium">Chờ duyệt</span> = đang có bước phê duyệt PENDING.
          </p>
        </div>
        {canDo(user, "WORK_ORDER:CREATE") && (
          <Button onClick={() => setCreateOpen(true)} className="shrink-0">
            <Plus size={16} /> Tạo phiếu
          </Button>
        )}
      </div>

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
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
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
              return (
                <li key={wo.woId}>
                  <Link
                    to={`/work-orders/${wo.woId}`}
                    className={`flex flex-col sm:flex-row sm:items-stretch gap-3 sm:gap-4 p-4 sm:px-5 sm:py-4
                      hover:bg-slate-50/90 transition-colors group
                      ${resubmit ? "border-l-4 border-l-amber-400 pl-3 sm:pl-4" : "border-l-4 border-l-transparent"}`}
                  >
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                          WO-{String(wo.woId).padStart(4, "0")}
                        </span>
                        {resubmit && (
                          <Badge color="orange" className="gap-1">
                            <RotateCcw size={11} aria-hidden />
                            YC sửa
                          </Badge>
                        )}
                        {wo.status === "PENDING_APPROVAL" && pending && !resubmit && (
                          <Badge color="yellow">Chờ duyệt</Badge>
                        )}
                        <Badge color={WO_STATUS_COLOR[wo.status] ?? "gray"}>
                          {stLabel}
                        </Badge>
                        <Badge color={WO_PRIORITY_COLOR[wo.priority] ?? "gray"}>
                          {prLabel}
                        </Badge>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1.5 py-0.5 rounded bg-slate-100">
                          {wo.woSource}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 leading-snug line-clamp-2">
                        {wo.description?.trim() || (
                          <span className="text-slate-400 italic">Không có mô tả</span>
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
                          <Calendar size={12} className="text-slate-400 shrink-0" />
                          {fDate(wo.plannedDate)}
                        </span>
                        {wo.estimatedHours != null && Number(wo.estimatedHours) > 0 && (
                          <span>Ước tính ~{wo.estimatedHours}h</span>
                        )}
                      </div>
                      {resubmit && (
                        <p className="text-xs text-amber-800/90 flex items-center gap-1.5">
                          <AlertCircle size={14} className="shrink-0" aria-hidden />
                          <span>Chi tiết → sửa (nếu cần) → gửi lại duyệt.</span>
                        </p>
                      )}
                    </div>
                    <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-2 shrink-0 sm:border-l sm:border-slate-100 sm:pl-4">
                      <span className="text-xs font-semibold text-blue-600 group-hover:text-blue-700 sm:hidden">
                        Chi tiết
                      </span>
                      <ChevronRight
                        size={20}
                        className="text-slate-300 group-hover:text-blue-500 transition-colors"
                        aria-hidden
                      />
                    </div>
                  </Link>
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
          assets={assets}
          onSuccess={() => {
            setCreateOpen(false);
            load();
            toast.success("Đã tạo phiếu việc");
          }}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>
    </div>
  );
}
