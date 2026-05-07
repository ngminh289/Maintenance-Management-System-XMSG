/**
 * AssetListPage.jsx — Danh sách tài sản với filter, tạo mới, xem QR.
 * Loại tài sản: dropdown chỉ loại con (leaf). Dây chuyền: load từ API.
 * RBAC: ASSET:CREATE (thêm), ASSET:UPDATE (sửa), ASSET:DELETE (xoá/loại biên).
 * Chuẩn UX: Xem (Eye) → giao diện chỉ đọc · Sửa (Pencil) → mở modal sửa, popup
 * xác nhận lưu · Xoá (Trash2) → popup "Bạn có muốn xoá tài sản này không?".
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  QrCode,
  Eye,
  Pencil,
  Trash2,
  Filter,
  Calendar,
  FileSpreadsheet,
} from "lucide-react";
import { assetApi } from "../../api/asset.api.js";
import { scheduleApi } from "../../api/schedule.api.js";
import { assetTypeApi } from "../../api/assetType.api.js";
import { productionLineApi } from "../../api/productionLine.api.js";
import { Button } from "../../components/ui/Button.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Select } from "../../components/ui/Input.jsx";
import { Pagination } from "../../components/ui/Pagination.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { PageLoader } from "../../components/ui/Spinner.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import {
  ScheduleFormFields,
  buildScheduleFormForAsset,
  buildSchedulePayload,
  validateScheduleForm,
} from "../../components/schedules/ScheduleFormFields.jsx";
import {
  ASSET_STATUS_LABEL,
  ASSET_STATUS_COLOR,
  fDate,
} from "../../utils/format.js";
import { AssetForm } from "./AssetForm.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { canDo } from "../../utils/rbac.js";
import { exportRowsToExcel } from "../../utils/excelExport.js";
import toast from "react-hot-toast";

export function AssetListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [types, setTypes] = useState([]);
  const [locs, setLocs] = useState([]);
  const [productionLines, setProductionLines] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    assetTypeId: "",
    productionLine: "",
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [deleteAsset, setDeleteAsset] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [quickScheduleOpen, setQuickScheduleOpen] = useState(false);
  const [quickScheduleAsset, setQuickScheduleAsset] = useState(null);
  const [quickScheduleSaving, setQuickScheduleSaving] = useState(false);
  const [quickScheduleForm, setQuickScheduleForm] = useState(
    buildScheduleFormForAsset(null),
  );
  const [qrAsset, setQrAsset] = useState(null);
  const LIMIT = 15;
  const canUpdateAsset = canDo(user, "ASSET:UPDATE");
  const canDeleteAsset = canDo(user, "ASSET:DELETE");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await assetApi.getAll({
        page,
        limit: LIMIT,
        ...(filters.search && { search: filters.search }),
        ...(filters.status && { status: filters.status }),
        ...(filters.assetTypeId && { assetTypeId: filters.assetTypeId }),
        ...(filters.productionLine && {
          productionLine: filters.productionLine,
        }),
      });
      setAssets(res.data.data?.items ?? []);
      setTotal(res.data.data?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    Promise.all([
      assetTypeApi.getLeaves(), // chỉ loại con (leaf) cho filter
      assetApi.getLocations(),
      productionLineApi.getAll(),
    ])
      .then(([t, l, pl]) => {
        setTypes(t.data.data ?? []);
        setLocs(l.data.data ?? []);
        setProductionLines(pl.data.data ?? []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleFilter = (key, val) => {
    setFilters((p) => ({ ...p, [key]: val }));
    setPage(1);
  };

  const handleDeleteAsset = async () => {
    if (!deleteAsset) return;
    setDeleting(true);
    try {
      await assetApi.remove(deleteAsset.assetId);
      toast.success(`Đã xoá tài sản "${deleteAsset.assetName}"`);
      setDeleteAsset(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi xoá tài sản");
    } finally {
      setDeleting(false);
    }
  };
  const canCreateSchedule =
    canDo(user, "SCHEDULE:CREATE") || (user?.positionLevel ?? 0) >= 4;

  const openQuickSchedule = (asset) => {
    setQuickScheduleAsset(asset);
    setQuickScheduleForm(buildScheduleFormForAsset(asset));
    setQuickScheduleOpen(true);
  };

  const submitQuickSchedule = async (e) => {
    e.preventDefault();
    if (!quickScheduleAsset) return;
    if (!validateScheduleForm(quickScheduleForm, toast.error)) return;
    setQuickScheduleSaving(true);
    try {
      await scheduleApi.create(buildSchedulePayload(quickScheduleForm));
      toast.success("Đã tạo lịch bảo trì từ tài sản");
      setQuickScheduleOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi tạo lịch bảo trì");
    } finally {
      setQuickScheduleSaving(false);
    }
  };

  const handleExportExcel = () => {
    const ok = exportRowsToExcel({
      rows: assets.map((a) => ({
        "ID tài sản": a.assetId,
        "Mã tài sản": a.assetCode ?? "",
        "Tên tài sản": a.assetName ?? "",
        "Loại tài sản": a.assetTypeName ?? "",
        "Dây chuyền": a.productionLineName ?? "",
        "Vị trí": a.locationName ?? "",
        "Trạng thái": ASSET_STATUS_LABEL[a.status] ?? a.status ?? "",
        "Ngày đưa vào sử dụng": fDate(a.commissionDate) ?? "",
      })),
      sheetName: "Tai san thiet bi",
      fileName: `tai-san-thiet-bi-trang-${page}.xlsx`,
    });
    if (!ok) {
      toast.error("Không có dữ liệu để xuất Excel");
      return;
    }
    toast.success("Đã xuất Excel danh sách tài sản");
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            placeholder="Tìm tên, mã tài sản..."
            value={filters.search}
            onChange={(e) => handleFilter("search", e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400
              focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none bg-white"
          />
        </div>
        <Select
          value={filters.status}
          onChange={(e) => handleFilter("status", e.target.value)}
          className="w-44"
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(ASSET_STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Select
          value={filters.assetTypeId}
          onChange={(e) => handleFilter("assetTypeId", e.target.value)}
          className="w-52"
        >
          <option value="">Tất cả loại</option>
          {types.map((t) => (
            <option key={t.assetTypeId} value={t.assetTypeId}>
              {t.parentTypeName
                ? `${t.parentTypeName} › ${t.typeName}`
                : t.typeName}
            </option>
          ))}
        </Select>
        <Select
          value={filters.productionLine ?? ""}
          onChange={(e) => handleFilter("productionLine", e.target.value)}
          className="w-44"
        >
          <option value="">Tất cả dây chuyền</option>
          {productionLines.map((l) => (
            <option key={l.lineId} value={l.lineId}>
              {l.lineName}
            </option>
          ))}
        </Select>
        {canDo(user, "ASSET:CREATE") && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={15} /> Thêm tài sản
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={handleExportExcel}
          disabled={loading || assets.length === 0}
          title={
            assets.length === 0
              ? "Không có dữ liệu để xuất"
              : "Xuất Excel theo danh sách đang hiển thị"
          }
        >
          <FileSpreadsheet size={15} /> Xuất Excel
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : assets.length === 0 ? (
          <EmptyState title="Không tìm thấy tài sản" icon={Filter} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-300">
                <tr>
                  {[
                    "Mã",
                    "Tên thiết bị",
                    "Loại",
                    "Phân loại",
                    "Vị trí",
                    "Trạng thái",
                    "Ngày đưa vào SD",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-bold text-gray-700 px-4 py-3 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assets.map((a) => (
                  <tr
                    key={a.assetId}
                    className="hover:bg-blue-50/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-sm font-bold text-gray-700">
                      #{a.assetId}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/assets/${a.assetId}`}
                        className="font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                      >
                        {a.assetName}
                      </Link>
                      {a.serialNumber && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          S/N: {a.serialNumber}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-700">
                      {a.assetTypeName}
                    </td>
                    <td className="px-4 py-3">
                      {a.productionLineName ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-100">
                          {a.productionLineName}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {a.locationName}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={ASSET_STATUS_COLOR[a.status]}>
                        {ASSET_STATUS_LABEL[a.status] ?? a.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {fDate(a.commissionDate)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/assets/${a.assetId}`)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                          title="Xem chi tiết"
                        >
                          <Eye size={16} />
                        </button>
                        {canUpdateAsset && (
                          <button
                            type="button"
                            onClick={() => setEditAsset(a)}
                            className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-600 transition-colors"
                            title="Sửa tài sản"
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setQrAsset(a)}
                          className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors"
                          title="Xem QR"
                        >
                          <QrCode size={16} />
                        </button>
                        {canCreateSchedule && (
                          <button
                            type="button"
                            onClick={() => openQuickSchedule(a)}
                            className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-600 transition-colors"
                            title="Tạo lịch bảo trì cho tài sản này"
                          >
                            <Calendar size={16} />
                          </button>
                        )}
                        {canDeleteAsset && a.status !== "DECOMMISSIONED" && (
                          <button
                            type="button"
                            onClick={() => setDeleteAsset(a)}
                            className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors"
                            title="Xoá tài sản"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Thêm tài sản mới"
        size="lg"
      >
        <AssetForm
          locations={locs}
          canUploadPhoto={canUpdateAsset}
          onSuccess={() => {
            setCreateOpen(false);
            load();
            toast.success("Đã thêm tài sản");
          }}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      <Modal
        open={!!editAsset}
        onClose={() => setEditAsset(null)}
        title={`Chỉnh sửa tài sản — ${editAsset?.assetName ?? ""}`}
        size="lg"
      >
        {editAsset && (
          <AssetForm
            asset={editAsset}
            locations={locs}
            canUploadPhoto={canUpdateAsset}
            onSuccess={() => {
              setEditAsset(null);
              load();
              toast.success("Đã cập nhật tài sản");
            }}
            onCancel={() => setEditAsset(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteAsset}
        title="Xác nhận xoá tài sản"
        message={`Bạn có muốn xoá tài sản "${deleteAsset?.assetName ?? ""}" này không?`}
        confirmLabel="Có"
        cancelLabel="Không"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteAsset}
        onCancel={() => (deleting ? null : setDeleteAsset(null))}
      />

      <Modal
        open={quickScheduleOpen}
        onClose={() => setQuickScheduleOpen(false)}
        title={`Tạo lịch bảo trì — ${quickScheduleAsset?.assetName ?? ""}`}
        size="lg"
      >
        <form onSubmit={submitQuickSchedule} className="space-y-4">
          <ScheduleFormFields
            form={quickScheduleForm}
            setF={(key, value) =>
              setQuickScheduleForm((prev) => ({ ...prev, [key]: value }))
            }
            patchForm={(patch) =>
              setQuickScheduleForm((prev) => ({ ...prev, ...patch }))
            }
            assets={assets}
            fixedAsset={quickScheduleAsset}
          />
          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setQuickScheduleOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" loading={quickScheduleSaving}>
              Tạo lịch
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!qrAsset}
        onClose={() => setQrAsset(null)}
        title={`QR Code — ${qrAsset?.assetName}`}
        size="sm"
      >
        {qrAsset && (
          <div className="flex flex-col items-center gap-4">
            <img
              src={assetApi.getQRUrl(qrAsset.assetId)}
              alt="QR"
              className="w-52 h-52 border border-gray-200 rounded-xl"
            />
            <p className="text-sm text-gray-600 text-center">
              Quét mã để mở Checklist trên thiết bị di động.
            </p>
            <a
              href={assetApi.getQRUrl(qrAsset.assetId)}
              download={`qr-asset-${qrAsset.assetId}.png`}
              className="text-sm font-semibold text-blue-600 hover:underline"
            >
              Tải ảnh QR
            </a>
          </div>
        )}
      </Modal>
    </div>
  );
}
