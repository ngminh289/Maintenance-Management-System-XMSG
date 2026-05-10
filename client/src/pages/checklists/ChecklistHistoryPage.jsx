/**
 * ChecklistHistoryPage.jsx — Danh sách kết quả checklist (mọi role đăng nhập có menu Checklist).
 * KTV hiện trường: chỉ thấy phiếu APPROVED (mọi người) + toàn bộ phiếu do mình nộp (mọi trạng thái) — khớp backend.
 * NVKT+: xem toàn bộ. Xem chi tiết trong modal (đọc, không duyệt). Câu Photo: ảnh từ AnswerValue.
 *
 * Bộ lọc (gọi GET /checklists/results):
 *   - q             — tìm theo tên TS / ghi chú / mã phiếu.
 *   - reviewStatus  — Chờ duyệt / Đã duyệt / Từ chối.
 *   - overallStatus — OK / WARNING / NG.
 *   - assetId       — chọn nhanh bằng AssetIdSearchPicker.
 *   - checkFrom/To  — khoảng ngày kiểm tra.
 *   - mine=1        — chỉ phiếu do tôi nộp (NVKT+; KTV bị BE restrict sẵn).
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ClipboardList,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Building2,
  MapPin,
  User,
  Clock,
  SlidersHorizontal,
  ImageIcon,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  X,
  Search,
} from "lucide-react";
import { checklistApi } from "../../api/checklist.api.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { canAccess } from "../../utils/rbac.js";
import { Card } from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { AssetIdSearchPicker } from "../../components/AssetIdSearchPicker.jsx";
import {
  CHECKLIST_STATUS_COLOR,
  APPROVAL_STATUS_COLOR,
  fDateTime,
  fNumber,
} from "../../utils/format.js";
import {
  getReviewRowCompare,
  formatAnswerLabel,
  formatSafeBand,
  formatInputRangeBand,
} from "../../utils/checklistReviewCompare.js";
import { checklistStoredPhotoUrl } from "../../utils/checklistPhotoUrl.js";
import { exportRowsToExcel } from "../../utils/excelExport.js";
import toast from "react-hot-toast";

const INPUT_TYPE_SHORT = {
  PassFail: "Đạt / Không đạt",
  Numeric: "Số",
  Text: "Ghi chú",
  Photo: "Ảnh",
  Range: "Khoảng",
  Selection: "Chọn",
};

function rowShellClass(tone) {
  if (tone === "bad") return "border-l-4 border-l-red-500 bg-red-50/40";
  if (tone === "good")
    return "border-l-4 border-l-emerald-500 bg-emerald-50/30";
  if (tone === "warn") return "border-l-4 border-l-amber-500 bg-amber-50/35";
  return "border-l-4 border-l-slate-200 bg-white";
}

const PAGE_SIZE = 12;

const REVIEW_STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái duyệt" },
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "REJECTED", label: "Bị từ chối" },
];

const OVERALL_STATUS_OPTIONS = [
  { value: "", label: "Tất cả kết quả" },
  { value: "OK", label: "OK" },
  { value: "WARNING", label: "WARNING (cảnh báo)" },
  { value: "NG", label: "NG (sự cố)" },
];

export function ChecklistHistoryPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryAssetId = searchParams.get("assetId")?.trim() || "";
  const focusChecklistId =
    searchParams.get("checklistId")?.trim() ||
    searchParams.get("focus")?.trim() ||
    "";

  const canOpenAsset = canAccess(user, "assets");
  const isWorker = (user?.positionLevel ?? 0) <= 1;

  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Bộ lọc — khởi tạo từ query string (assetId) để giữ tương thích link cũ.
  const [filters, setFilters] = useState({
    q: "",
    reviewStatus: "",
    overallStatus: "",
    assetId: queryAssetId,
    checkFrom: "",
    checkTo: "",
    mine: false,
  });
  const [showFilters, setShowFilters] = useState(false);

  // Đồng bộ ngược assetId vào URL (giữ behavior cũ: ?assetId=… vẫn hoạt động).
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (filters.assetId) next.set("assetId", String(filters.assetId));
    else next.delete("assetId");
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.assetId]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.q.trim()) n += 1;
    if (filters.reviewStatus) n += 1;
    if (filters.overallStatus) n += 1;
    if (filters.assetId) n += 1;
    if (filters.checkFrom) n += 1;
    if (filters.checkTo) n += 1;
    if (filters.mine) n += 1;
    return n;
  }, [filters]);

  const updateFilter = useCallback((patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      q: "",
      reviewStatus: "",
      overallStatus: "",
      assetId: "",
      checkFrom: "",
      checkTo: "",
      mine: false,
    });
    setPage(1);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: PAGE_SIZE,
      };
      const qTrim = filters.q.trim();
      if (qTrim) params.q = qTrim;
      if (filters.reviewStatus) params.reviewStatus = filters.reviewStatus;
      if (filters.overallStatus) params.overallStatus = filters.overallStatus;
      if (filters.assetId) params.assetId = filters.assetId;
      if (filters.checkFrom) params.checkFrom = filters.checkFrom;
      if (filters.checkTo) params.checkTo = filters.checkTo;
      if (filters.mine && !isWorker) params.mine = 1;

      const res = await checklistApi.getResults(params);
      const d = res.data.data;
      setPayload({
        items: d?.items ?? [],
        total: Number(d?.total) || 0,
      });
    } catch {
      toast.error("Không tải được danh sách checklist");
      setPayload({ items: [], total: 0 });
    } finally {
      setLoading(false);
    }
  }, [page, filters, isWorker]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(payload.total / PAGE_SIZE));

  const openDetail = useCallback(async (checklistId) => {
    setModalOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await checklistApi.getResultById(checklistId);
      setDetail(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Không mở được chi tiết");
      setModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!focusChecklistId || loading || modalOpen) return;
    const focusIdNum = Number(focusChecklistId);
    if (!Number.isFinite(focusIdNum) || focusIdNum <= 0) return;
    openDetail(focusIdNum);
  }, [focusChecklistId, loading, modalOpen, openDetail]);

  const photoHref = detail?.evidencePhoto
    ? checklistStoredPhotoUrl(detail.evidencePhoto)
    : null;

  const detailRows = useMemo(() => {
    if (!detail?.details?.length) return [];
    return detail.details.map((d) => ({
      d,
      cmp: getReviewRowCompare(d),
    }));
  }, [detail]);

  const handleExportExcel = () => {
    const ok = exportRowsToExcel({
      rows: payload.items.map((row) => ({
        "ID checklist": row.checklistId,
        "Tài sản": row.assetName ?? `Tài sản #${row.assetId ?? ""}`,
        "ID tài sản": row.assetId ?? "",
        "Trạng thái tổng": row.overallStatus ?? "",
        "Trạng thái duyệt": row.reviewStatus ?? "",
        "Người nộp": row.checkerName ?? "",
        "Thời điểm kiểm tra": fDateTime(row.checkTime) ?? "",
        "Ghi chú": row.notes ?? "",
      })),
      sheetName: "Danh sach checklist",
      fileName: `danh-sach-checklist-trang-${page}.xlsx`,
    });
    if (!ok) {
      toast.error("Không có dữ liệu để xuất Excel");
      return;
    }
    toast.success("Đã xuất Excel danh sách checklist");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="text-indigo-600" size={24} aria-hidden />
            Danh sách checklist
          </h1>
          {/* <p className="text-sm text-gray-600 mt-1">
            Tra cứu phiếu đã nộp — bấm một dòng để xem chi tiết câu hỏi & ảnh.
          </p> */}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleExportExcel}
            disabled={loading || payload.items.length === 0}
            title={
              payload.items.length === 0
                ? "Không có dữ liệu để xuất"
                : "Xuất Excel theo danh sách đang hiển thị"
            }
          >
            <FileSpreadsheet size={15} /> Xuất Excel
          </Button>
          <Link
            to="/checklists"
            className="text-sm font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            ← Quét QR / nộp checklist
          </Link>
        </div>
      </div>

      <Card noPad>
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                aria-hidden
              />
              <input
                type="search"
                value={filters.q}
                onChange={(e) => updateFilter({ q: e.target.value })}
                placeholder="Tìm theo tên tài sản, ghi chú, mã phiếu…"
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
              />
            </div>
            <select
              value={filters.reviewStatus}
              onChange={(e) => updateFilter({ reviewStatus: e.target.value })}
              style={{ colorScheme: "light" }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
            >
              {REVIEW_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value} className="text-slate-900 bg-white">
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={filters.overallStatus}
              onChange={(e) => updateFilter({ overallStatus: e.target.value })}
              style={{ colorScheme: "light" }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
            >
              {OVERALL_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value} className="text-slate-900 bg-white">
                  {opt.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowFilters((s) => !s)}
              title="Mở thêm bộ lọc"
            >
              <Filter size={14} />
              {showFilters ? "Ẩn bộ lọc" : "Bộ lọc"}
              {activeFilterCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-indigo-600 text-white text-[10px] font-bold w-4 h-4">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            {activeFilterCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                title="Xoá tất cả bộ lọc"
              >
                <X size={14} /> Xoá lọc
              </Button>
            )}
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
              <div className="sm:col-span-2 lg:col-span-1">
                <AssetIdSearchPicker
                  id="filter-asset"
                  label="Tài sản"
                  value={filters.assetId}
                  onChange={(v) => updateFilter({ assetId: v || "" })}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="filter-from"
                  className="text-sm font-semibold text-gray-700 block"
                >
                  Từ ngày
                </label>
                <input
                  id="filter-from"
                  type="date"
                  value={filters.checkFrom}
                  max={filters.checkTo || undefined}
                  onChange={(e) => updateFilter({ checkFrom: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm
                    focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="filter-to"
                  className="text-sm font-semibold text-gray-700 block"
                >
                  Đến ngày
                </label>
                <input
                  id="filter-to"
                  type="date"
                  value={filters.checkTo}
                  min={filters.checkFrom || undefined}
                  onChange={(e) => updateFilter({ checkTo: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm
                    focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                />
              </div>
              {!isWorker && (
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm cursor-pointer select-none sm:col-span-2 lg:col-span-3">
                  <input
                    type="checkbox"
                    checked={filters.mine}
                    onChange={(e) => updateFilter({ mine: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-medium text-slate-800">
                    Chỉ phiếu do tôi nộp
                  </span>
                </label>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card title={`Phiếu (${payload.total})`}>
        {loading ? (
          <div className="flex justify-center py-16 text-gray-400">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : payload.items.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-12">
            Không có phiếu checklist phù hợp.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {payload.items.map((row) => {
              const mine =
                user?.employeeId != null &&
                Number(row.checkerId) === Number(user.employeeId);
              return (
                <li key={row.checklistId}>
                  <button
                    type="button"
                    onClick={() => openDetail(row.checklistId)}
                    className="w-full text-left px-1 py-4 hover:bg-gray-50 rounded-xl transition-colors flex flex-wrap items-start gap-3"
                  >
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Badge
                        color={
                          CHECKLIST_STATUS_COLOR[row.overallStatus] ?? "gray"
                        }
                      >
                        {row.overallStatus}
                      </Badge>
                      <Badge
                        color={
                          APPROVAL_STATUS_COLOR[row.reviewStatus] ?? "gray"
                        }
                      >
                        {row.reviewStatus}
                      </Badge>
                      {mine && (
                        <Badge color="blue" className="text-[10px]">
                          Của tôi
                        </Badge>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">
                        {row.assetName ?? `Tài sản #${row.assetId}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 font-mono">
                        #{row.checklistId} · {fDateTime(row.checkTime)}
                      </p>
                      {row.checkerName && (
                        <p className="text-xs text-gray-600 mt-1">
                          Người nộp: {row.checkerName}
                        </p>
                      )}
                      {row.notes ? (
                        <p className="text-sm text-gray-700 mt-2 line-clamp-2 whitespace-pre-wrap">
                          {row.notes}
                        </p>
                      ) : null}
                    </div>
                    <span className="text-xs text-blue-600 font-semibold shrink-0 self-center">
                      Chi tiết →
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-4 border-t border-gray-100 mt-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} /> Trước
            </Button>
            <span className="text-sm text-gray-600 tabular-nums">
              Trang {page} / {totalPages}
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau <ChevronRight size={16} />
            </Button>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setDetail(null);
        }}
        title={detail ? `Phiếu #${detail.checklistId}` : "Chi tiết checklist"}
        size="lg"
      >
        {detailLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-gray-400" size={28} />
          </div>
        )}
        {!detailLoading && detail && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="flex flex-wrap gap-2">
              <Badge
                color={CHECKLIST_STATUS_COLOR[detail.overallStatus] ?? "gray"}
              >
                {detail.overallStatus}
              </Badge>
              <Badge
                color={APPROVAL_STATUS_COLOR[detail.reviewStatus] ?? "gray"}
              >
                {detail.reviewStatus}
              </Badge>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-xs text-slate-500">Thiết bị</span>
                <p className="font-semibold text-slate-900 flex items-center gap-1 mt-0.5">
                  <Building2 size={14} className="text-slate-400 shrink-0" />
                  {detail.assetName ?? `Asset #${detail.assetId}`}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-xs text-slate-500">Thời điểm</span>
                <p className="font-semibold text-slate-900 flex items-center gap-1 mt-0.5">
                  <Clock size={14} className="text-slate-400 shrink-0" />
                  {fDateTime(detail.checkTime)}
                </p>
              </div>
              {detail.locationName && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:col-span-2">
                  <span className="text-xs text-slate-500">Vị trí</span>
                  <p className="font-medium text-slate-800 flex items-center gap-1 mt-0.5">
                    <MapPin size={14} className="text-slate-400 shrink-0" />
                    {detail.locationName}
                  </p>
                </div>
              )}
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:col-span-2">
                <span className="text-xs text-slate-500">Người nộp</span>
                <p className="font-medium text-slate-900 flex items-center gap-1 mt-0.5">
                  <User size={14} className="text-slate-400 shrink-0" />
                  {detail.checkerName ?? "—"}
                </p>
              </div>
            </div>
            {detail.readingValue != null && detail.readingValue !== "" && (
              <p className="text-sm text-slate-700">
                <span className="font-semibold">Chỉ số đồng hồ:</span>{" "}
                <span className="tabular-nums font-mono">
                  {fNumber(detail.readingValue)} h
                </span>
              </p>
            )}
            {detail.checklistTemplateName && (
              <p className="text-xs text-slate-600">
                Mẫu: <strong>{detail.checklistTemplateName}</strong>
              </p>
            )}
            {canOpenAsset && detail.assetId != null && (
              <Link
                to={`/assets/${detail.assetId}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline"
              >
                <ExternalLink size={14} /> Mở tài sản #{detail.assetId}
              </Link>
            )}
            {detail.notes && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/85 px-4 py-3 text-sm">
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                  Ghi chú hiện trường
                </span>
                <p className="mt-1 whitespace-pre-wrap text-slate-900">
                  {detail.notes}
                </p>
              </div>
            )}
            {detail.supervisorNotes && (
              <div className="rounded-xl border border-violet-200 bg-violet-50/90 px-4 py-3 text-sm">
                <span className="text-xs font-bold text-violet-900 uppercase tracking-wide">
                  Ghi chú người duyệt
                </span>
                <p className="mt-1 whitespace-pre-wrap">
                  {detail.supervisorNotes}
                </p>
              </div>
            )}
            {photoHref && (
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                <p className="text-xs text-slate-600 px-4 py-2 border-b border-slate-200 bg-white flex items-center gap-2">
                  <ImageIcon size={14} aria-hidden /> Ảnh minh chứng
                </p>
                <a
                  href={photoHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3"
                >
                  <img
                    src={photoHref}
                    alt=""
                    className="max-h-56 w-auto mx-auto rounded-lg border border-slate-200 object-contain"
                  />
                </a>
              </div>
            )}
            {detailRows.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
                  <SlidersHorizontal
                    size={16}
                    className="text-indigo-600 shrink-0"
                    aria-hidden
                  />
                  Chi tiết câu hỏi
                </h3>
                <div className="space-y-3">
                  {detailRows.map(({ d, cmp }) => {
                    const typeLabel =
                      INPUT_TYPE_SHORT[d.inputType] ?? d.inputType;
                    const ans = formatAnswerLabel(
                      d.inputType,
                      d.answerValue,
                      d.isOK,
                    );
                    const safe = d.threshold
                      ? formatSafeBand(d.threshold)
                      : null;
                    const range = d.threshold
                      ? formatInputRangeBand(d.threshold)
                      : null;
                    return (
                      <div
                        key={d.detailId}
                        className={`rounded-xl border border-slate-200/90 shadow-sm overflow-hidden ${rowShellClass(cmp.tone)}`}
                      >
                        <div className="grid sm:grid-cols-2 gap-0 sm:divide-x divide-slate-200/80">
                          <div className="p-4 space-y-2 bg-white/60">
                            <p className="text-sm font-semibold text-gray-900 leading-snug">
                              {d.questionText}
                            </p>
                            <Badge color="gray" className="text-[10px]">
                              {typeLabel}
                            </Badge>
                            <div className="text-xs text-slate-600 space-y-1 pt-1 border-t border-slate-100 mt-2">
                              {d.threshold ? (
                                <>
                                  {safe && (
                                    <p>
                                      <span className="text-slate-500">
                                        Ngưỡng{" "}
                                      </span>
                                      <span className="font-mono text-indigo-900 bg-indigo-50 px-1 rounded">
                                        {safe}
                                      </span>
                                    </p>
                                  )}
                                  {range && (
                                    <p>
                                      <span className="text-slate-500">
                                        Khoảng{" "}
                                      </span>
                                      <span className="font-mono">{range}</span>
                                    </p>
                                  )}
                                </>
                              ) : (
                                <p className="text-slate-400 text-xs">
                                  Không khớp mẫu / chưa cấu ngưỡng
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="p-4 flex flex-col justify-center bg-white/40">
                            <p className="text-xs text-slate-500 mb-1">
                              Trả lời
                            </p>
                            {d.inputType === "Photo" && d.answerValue ? (
                              <a
                                href={
                                  checklistStoredPhotoUrl(d.answerValue) ?? "#"
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-lg border border-slate-200 overflow-hidden bg-white max-w-md"
                              >
                                <img
                                  src={
                                    checklistStoredPhotoUrl(d.answerValue) ?? ""
                                  }
                                  alt=""
                                  className="max-h-56 w-full object-contain"
                                />
                              </a>
                            ) : (
                              <p
                                className={`text-lg font-bold tabular-nums ${cmp.tone === "bad" ? "text-red-700" : cmp.tone === "good" ? "text-emerald-800" : "text-slate-800"}`}
                              >
                                {ans}
                              </p>
                            )}
                            <p
                              className={`text-xs mt-1 ${d.isOK ? "text-emerald-700" : "text-red-700"}`}
                            >
                              {d.isOK ? "OK" : "Không OK"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
