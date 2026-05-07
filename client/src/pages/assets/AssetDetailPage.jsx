/**
 * AssetDetailPage.jsx — Chi tiết tài sản đầy đủ.
 * Sections: Thông tin cơ bản | Thông tin kỹ thuật | Thời gian & trạng thái | Ảnh thiết bị
 * Bộ đếm: chỉ số máy (LastReading) ≠ tổng delta (TotalAccumulated)
 *         ≠ mốc sau PM (LastMaintenanceTotal — reset khi PM theo giờ xong).
 * Liên quan: AssetForm.jsx, asset.model.js, asset.api.js
 * Ảnh: chỉ role ASSET:UPDATE mới upload/xóa được.
 * Tài liệu số: GET /digital-assets?assetId=… (kho chỉ hiện đã duyệt + nháp của user — server).
 * Nút upload: /documents?upload=1&assetId=… (kho mở modal với tài sản gắn sẵn).
 */
import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Pencil, QrCode, ArrowLeft, Gauge, Bell, Wrench,
  Info, Settings, Clock, Images, Trash2, ImagePlus, X,
  FileText, ExternalLink, Upload,
} from 'lucide-react';
import { api }        from '../../api/index.js';
import { assetApi }   from '../../api/asset.api.js';
import { Badge }      from '../../components/ui/Badge.jsx';
import { Card }       from '../../components/ui/Card.jsx';
import { Button }     from '../../components/ui/Button.jsx';
import { Modal }      from '../../components/ui/Modal.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { Input }      from '../../components/ui/Input.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { AssetForm }  from './AssetForm.jsx';
import {
  ASSET_STATUS_LABEL, ASSET_STATUS_COLOR,
  fDate, fDateTime, fNumber, WO_SOURCE_LABEL, isDateBeforeToday,
} from '../../utils/format.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { canDo }   from '../../utils/rbac.js';
import { documentFilePublicUrl } from '../../utils/documentUrl.js';
import toast from 'react-hot-toast';

const FILE_API_BASE = import.meta.env.VITE_API_BASE;

const PREDICTIVE_EVENT_LABEL = {
  WARN_DUE_SOON:             'Cảnh báo sắp tới ngưỡng PM',
  THRESHOLD_EXCEEDED:        'Vượt ngưỡng giờ chạy',
  AUTO_WO_CREATED:           'Tạo WO dự báo tự động',
  AUTO_WO_SKIPPED_DUPLICATE: 'Không tạo WO (đã có phiếu mở)',
};

const PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp';
const MAX_PHOTOS   = 10;

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="font-semibold text-gray-900 mt-1 break-words">{value ?? '—'}</p>
    </div>
  );
}

function GroupTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-1.5 mb-3 mt-1 first:mt-0">
      {Icon && <Icon size={13} className="text-gray-400" />}
      <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{children}</span>
    </div>
  );
}

export function AssetDetailPage() {
  const { user } = useAuth();
  const { id }   = useParams();
  const navigate = useNavigate();

  const [asset,           setAsset]           = useState(null);
  const [counter,         setCounter]         = useState(null);
  const [hourlySchedules, setHourlySchedules] = useState([]);
  const [history,         setHistory]         = useState([]);
  const [predEvents,      setPredEvents]      = useState([]);
  const [maintHistory,    setMaintHistory]    = useState([]);
  const [types,           setTypes]           = useState([]);
  const [locs,            setLocs]            = useState([]);
  const [linkedDocs,      setLinkedDocs]      = useState([]);
  const [loading,         setLoading]         = useState(true);

  const [editOpen,    setEditOpen]    = useState(false);
  const [qrOpen,      setQrOpen]      = useState(false);
  const [readingOpen, setReadingOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [deleteOpen,  setDeleteOpen]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  const [reading,     setReading]     = useState('');
  const [readLoading, setReadLoading] = useState(false);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState(null);
  const photoInputRef = useRef(null);

  const canEditAsset   = canDo(user, 'ASSET:UPDATE');
  const canDeleteAsset = canDo(user, 'ASSET:DELETE');
  const canLogHours    = canDo(user, 'RUNTIME_LOG:CREATE');
  const canUploadDoc   = canDo(user, 'DOCUMENT:CREATE');

  const load = async () => {
    try {
      const [ar, cr, hr, pe, mh] = await Promise.all([
        assetApi.getById(id),
        assetApi.getCounter(id),
        assetApi.getHistory(id),
        assetApi.getPredictiveEvents(id, { limit: 40 }).catch(() => ({ data: { data: [] } })),
        assetApi.getMaintenanceHistory(id, { limit: 50 }).catch(() => ({ data: { data: [] } })),
      ]);
      setAsset(ar.data.data);
      setCounter(cr.data.data?.counter ?? null);
      setHourlySchedules(cr.data.data?.hourlySchedules ?? []);
      setHistory(hr.data.data ?? []);
      setPredEvents(pe.data.data ?? []);
      setMaintHistory(mh.data.data ?? []);
    } catch { toast.error('Không tải được dữ liệu'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    Promise.all([assetApi.getTypes(), assetApi.getLocations()]).then(([t, l]) => {
      setTypes(t.data.data ?? []);
      setLocs(l.data.data  ?? []);
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/digital-assets', { params: { assetId: id, limit: 100 } });
        if (!cancelled) setLinkedDocs(res.data.data?.items ?? []);
      } catch {
        if (!cancelled) setLinkedDocs([]);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleRecordReading = async () => {
    if (!reading) return;
    setReadLoading(true);
    try {
      await assetApi.recordReading(id, { readingValue: Number(reading) });
      toast.success('Đã ghi nhận giờ chạy');
      setReadingOpen(false);
      setReading('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Lỗi ghi nhận');
    } finally { setReadLoading(false); }
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';

    const currentCount = asset?.photos?.length ?? 0;
    if (currentCount + files.length > MAX_PHOTOS) {
      toast.error(`Tối đa ${MAX_PHOTOS} ảnh. Hiện có ${currentCount} ảnh.`);
      return;
    }

    setPhotoUploading(true);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('photos', f));
      const res = await assetApi.uploadPhotos(id, fd);
      setAsset(p => ({ ...p, photos: res.data.data }));
      toast.success(`Đã thêm ${files.length} ảnh`);
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Lỗi upload ảnh');
    } finally { setPhotoUploading(false); }
  };

  const handleDeleteAsset = async () => {
    setDeleting(true);
    try {
      await assetApi.remove(id);
      toast.success(`Đã xoá tài sản "${asset?.assetName ?? ''}"`);
      setDeleteOpen(false);
      navigate('/assets');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Lỗi xoá tài sản');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeletePhoto = async (photoId) => {
    setDeletingPhotoId(photoId);
    try {
      const res = await assetApi.deletePhoto(id, photoId);
      setAsset(p => ({ ...p, photos: res.data.data }));
      toast.success('Đã xóa ảnh');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Lỗi xóa ảnh');
    } finally { setDeletingPhotoId(null); }
  };

  if (loading) return <PageLoader />;
  if (!asset)  return <div className="text-center py-20 text-gray-400">Không tìm thấy tài sản</div>;

  const c = counter;
  const hasHourlySchedule = hourlySchedules.length > 0;
  const pmDateDisplay = c?.estimatedNextPMDate
    ? fDate(c.estimatedNextPMDate)
    : hasHourlySchedule ? 'Chưa đủ dữ liệu giờ chạy' : 'Chưa có lịch theo giờ chạy';

  const warrantyExpired = asset.warrantyDate && isDateBeforeToday(asset.warrantyDate);
  const warrantyDisplay = asset.warrantyDate
    ? <span className={warrantyExpired ? 'text-red-600' : 'text-green-600'}>
        {fDate(asset.warrantyDate)}{warrantyExpired ? ' (Hết hạn)' : ' (Còn hạn)'}
      </span>
    : '—';

  const photos = asset.photos ?? [];

  return (
    <div className="space-y-5">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Link to="/assets" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <h2 className="text-lg font-bold text-gray-900">{asset.assetName}</h2>
          <Badge color={ASSET_STATUS_COLOR[asset.status]}>
            {ASSET_STATUS_LABEL[asset.status]}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setQrOpen(true)}>
            <QrCode size={14} /> QR Code
          </Button>
          {canEditAsset && (
            <Button size="sm" onClick={() => setEditOpen(true)}>
              <Pencil size={14} /> Sửa
            </Button>
          )}
          {canDeleteAsset && asset.status !== 'DECOMMISSIONED' && (
            <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={14} /> Xoá
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Card thông tin ── */}
        <Card title="Thông tin thiết bị" className="lg:col-span-2">
          <div className="space-y-5">
            <div>
              <GroupTitle icon={Info}>Thông tin cơ bản</GroupTitle>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <InfoRow label="Mã tài sản"    value={`#${asset.assetId}`} />
                <InfoRow label="Loại thiết bị" value={asset.assetTypeName} />
                <InfoRow label="Vị trí"        value={asset.locationName} />
              </div>
            </div>

            <hr className="border-gray-100" />

            <div>
              <GroupTitle icon={Settings}>Thông tin kỹ thuật</GroupTitle>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <InfoRow label="Nhà sản xuất" value={asset.manufacturer} />
                <InfoRow label="Model"         value={asset.model} />
                <InfoRow label="Số serial"     value={asset.serialNumber} />
                <InfoRow label="Năm sản xuất"  value={asset.yearOfManufacture} />
              </div>
              {asset.technicalSpecs && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Đặc tính kỹ thuật</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                    {asset.technicalSpecs}
                  </p>
                </div>
              )}
            </div>

            <hr className="border-gray-100" />

            <div>
              <GroupTitle icon={Clock}>Thời gian & trạng thái</GroupTitle>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <InfoRow label="Ngày mua"              value={fDate(asset.purchaseDate)} />
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hạn bảo hành</p>
                  <p className="font-semibold mt-1">{warrantyDisplay}</p>
                </div>
                <InfoRow label="Ngày đưa vào sử dụng" value={fDate(asset.commissionDate)} />
                <InfoRow label="Ngày ngưng hoạt động" value={fDate(asset.decommissionDate)} />
                {asset.productionLineName && (
                  <InfoRow label="Phân loại sử dụng" value={asset.productionLineName} />
                )}
              </div>
            </div>

            {asset.description && (
              <>
                <hr className="border-gray-100" />
                <div className="text-sm">
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">Mô tả</p>
                  <p className="text-gray-700 whitespace-pre-line">{asset.description}</p>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* ── Bộ đếm giờ ── */}
        <Card
          title="Bộ đếm giờ chạy"
          action={
            canLogHours ? (
              <Button size="xs" variant="secondary" onClick={() => setReadingOpen(true)}>
                <Gauge size={12} /> Nhập giờ
              </Button>
            ) : undefined
          }
        >
          {c ? (
            <div className="space-y-3 text-sm">
              <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 rounded-lg px-2.5 py-2 border border-gray-100">
                <strong>Chỉ số trên máy</strong> là số đồng hồ ghi nhận lần cuối.
                <strong> Tổng tích lũy</strong> là tổng các bước nhảy (delta) trong hệ thống.
                <strong> Mốc sau PM</strong> dùng tính ngưỡng bảo trì theo giờ.
              </p>
              {[
                ['Chỉ số đồng hồ máy (lần ghi cuối)', `${fNumber(c.lastReadingValue)} h`, 'Trùng với giá trị nhập từ màn hình máy'],
                ['Tổng giờ chạy tích lũy (delta)',    `${fNumber(c.totalAccumulatedHours)} h`, 'Cộng dồn mỗi lần nhập chỉ số mới'],
                ['Mốc sau bảo trì theo giờ',          `${fNumber(c.lastMaintenanceTotal ?? 0)} h`, 'Reset về tổng tích lũy hiện tại sau PM'],
              ].map(([label, val, hint]) => (
                <div key={label} className="py-2 border-b border-gray-100 last:border-0">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-medium text-gray-700 text-xs leading-snug max-w-[58%]">{label}</span>
                    <span className="font-bold text-gray-900 tabular-nums shrink-0">{val}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p>
                </div>
              ))}
              {hasHourlySchedule && (
                <div className="flex justify-between items-center py-1.5 rounded-lg bg-sky-50/80 px-2 border border-sky-100">
                  <span className="font-medium text-sky-900 text-xs">Giờ chạy kể từ mốc PM</span>
                  <span className="font-bold text-sky-950 tabular-nums">
                    {fNumber(Math.max(0, Number(c.totalAccumulatedHours ?? 0) - Number(c.lastMaintenanceTotal ?? 0)))} h
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center py-1 border-b border-gray-100">
                <span className="font-medium text-gray-600">Trung bình/ngày</span>
                <span className="font-bold text-gray-900">{fNumber(c.averageHoursPerDay ?? 0)} h/ngày</span>
              </div>
              <div className="flex justify-between items-start py-1">
                <span className="font-medium text-gray-600">Ngày PM dự báo</span>
                <span className={`font-bold text-right text-xs max-w-[55%] ${c.estimatedNextPMDate ? 'text-gray-900' : 'text-amber-600'}`}>
                  {pmDateDisplay}
                </span>
              </div>
              {!hasHourlySchedule && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1.5">
                  Thêm lịch <strong>dự báo (theo giờ)</strong> để dùng ngưỡng PM.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">Chưa có dữ liệu đồng hồ</p>
          )}
        </Card>
      </div>

      <Card
        title={<span className="flex items-center gap-2"><FileText size={16} /> Tài liệu số liên quan</span>}
        action={
          canUploadDoc ? (
            <Link
              to={`/documents?upload=1&assetId=${encodeURIComponent(id)}`}
              className="inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors
                bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm
                px-2 py-1 text-xs"
            >
              <Upload size={12} /> Upload tài liệu
            </Link>
          ) : undefined
        }
      >
        {linkedDocs.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">Chưa có tài liệu đính kèm (hoặc bạn chưa có quyền xem trong kho).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  {['Tài liệu', 'Trạng thái', ''].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 pb-2 pr-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {linkedDocs.map((d) => {
                  const href = documentFilePublicUrl(d.filePath, FILE_API_BASE);
                  const canOpen = href && (d.status === 'APPROVED' || d.status === 'ARCHIVED');
                  return (
                    <tr key={d.digitalAssetId}>
                      <td className="py-2 pr-3 font-medium text-gray-900">{d.fileName}</td>
                      <td className="py-2 pr-3 text-gray-600">{d.status === 'APPROVED' ? 'Đã duyệt' : d.status === 'ARCHIVED' ? 'Lưu trữ' : d.status === 'DRAFT' ? 'Bản nháp' : d.status === 'REJECTED' ? 'Từ chối' : d.status}</td>
                      <td className="py-2 text-right whitespace-nowrap">
                        {canOpen ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                            onClick={() => { void api.post(`/digital-assets/${d.digitalAssetId}/view-log`).catch(() => {}); }}
                          >
                            Mở file <ExternalLink size={12} />
                          </a>
                        ) : (
                          <Link to="/documents" className="text-xs font-semibold text-blue-600 hover:underline">
                            Kho tài liệu
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Ảnh thiết bị ── */}
      <Card
        title={<span className="flex items-center gap-2"><Images size={16} /> Ảnh thiết bị</span>}
        action={
          canEditAsset ? (
            <Button
              size="xs"
              variant="secondary"
              loading={photoUploading}
              onClick={() => photoInputRef.current?.click()}
              disabled={photos.length >= MAX_PHOTOS}
            >
              <ImagePlus size={12} />
              {photos.length >= MAX_PHOTOS ? `Tối đa ${MAX_PHOTOS} ảnh` : 'Thêm ảnh'}
            </Button>
          ) : undefined
        }
      >
        {canEditAsset && (
          <input
            ref={photoInputRef}
            type="file"
            accept={PHOTO_ACCEPT}
            multiple
            className="hidden"
            onChange={handlePhotoUpload}
          />
        )}

        {photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
            <Images size={32} className="opacity-30" />
            <p className="text-sm">Chưa có ảnh nào</p>
            {canEditAsset && (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="text-xs text-blue-600 hover:underline mt-1"
              >
                Thêm ảnh đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {photos.map(p => {
              const src = assetApi.getPhotoUrl(p.filePath);
              const isDeleting = deletingPhotoId === p.photoId;
              return (
                <div
                  key={p.photoId}
                  className="relative group rounded-xl border border-gray-200 overflow-hidden bg-gray-50 aspect-square cursor-pointer"
                  onClick={() => !isDeleting && setLightboxSrc(src)}
                >
                  <img
                    src={src}
                    alt={`Ảnh ${p.photoId}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                  {/* Overlay thông tin */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex flex-col justify-end p-1.5 pointer-events-none">
                    {p.uploadedByName && (
                      <p className="text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity truncate">
                        {p.uploadedByName}
                      </p>
                    )}
                  </div>
                  {/* Nút xóa — chỉ role ASSET:UPDATE */}
                  {canEditAsset && (
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={(e) => { e.stopPropagation(); handleDeletePhoto(p.photoId); }}
                      className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-60 z-10"
                      title="Xóa ảnh"
                    >
                      {isDeleting ? (
                        <span className="block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 size={11} />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
            {/* Ô thêm ảnh nếu còn slot */}
            {canEditAsset && photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoUploading}
                className="aspect-square rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 text-gray-400 hover:text-blue-500 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-40"
              >
                <ImagePlus size={20} />
                <span className="text-[11px]">Thêm ảnh</span>
              </button>
            )}
          </div>
        )}
        {photos.length > 0 && (
          <p className="text-xs text-gray-400 mt-3">{photos.length}/{MAX_PHOTOS} ảnh · Nhấp để xem toàn màn hình</p>
        )}
      </Card>

      {/* Lịch sử bảo trì */}
      <Card title={<span className="flex items-center gap-2"><Wrench size={16} /> Lịch sử bảo trì</span>}>
        <p className="text-xs text-gray-500 mb-3">
          Phiếu định kỳ / dự báo / thủ công hoàn thành sẽ cập nhật lịch và mốc giờ; phiếu sự cố chỉ lưu lịch sử.
        </p>
        {maintHistory.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Chưa có bản ghi sau khi hoàn thành phiếu.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  {['Ngày hoàn thành', 'Nguồn', 'Giờ thực tế', 'Tổng giờ máy (lúc đó)', 'Phiếu', 'Ghi chú'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 pb-2 pr-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {maintHistory.map((row) => (
                  <tr key={row.historyId} className="hover:bg-gray-50">
                    <td className="py-2.5 pr-3 whitespace-nowrap font-medium text-gray-800">{fDate(row.completedDate)}</td>
                    <td className="py-2.5 pr-3">
                      <Badge color={row.woSource === 'CORRECTIVE' ? 'red' : row.woSource === 'PREDICTIVE' ? 'yellow' : 'blue'}>
                        {WO_SOURCE_LABEL[row.woSource] ?? row.woSource}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3">{row.actualHours != null ? `${fNumber(row.actualHours)} h` : '—'}</td>
                    <td className="py-2.5 pr-3">{row.totalRuntimeHours != null ? `${fNumber(row.totalRuntimeHours)} h` : '—'}</td>
                    <td className="py-2.5 pr-3">
                      {row.workOrderId ? (
                        <Link to={`/work-orders/${row.workOrderId}`} className="font-semibold text-blue-700 hover:underline">
                          #{row.workOrderId}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 text-gray-600 text-xs max-w-xs truncate" title={row.description}>
                      {row.description ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Nhật ký dự báo */}
      {predEvents.length > 0 && (
        <Card title={<span className="flex items-center gap-2"><Bell size={16} /> Nhật ký dự báo bảo trì</span>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  {['Thời điểm', 'Loại', 'Chi tiết', 'WO liên quan'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {predEvents.map((ev) => (
                  <tr key={ev.logId} className="hover:bg-gray-50">
                    <td className="py-2.5 pr-4 font-medium text-gray-800 whitespace-nowrap">{fDateTime(ev.createdAt)}</td>
                    <td className="py-2.5 pr-4">
                      <Badge color={ev.eventType === 'THRESHOLD_EXCEEDED' ? 'red' : ev.eventType === 'WARN_DUE_SOON' ? 'orange' : 'blue'}>
                        {PREDICTIVE_EVENT_LABEL[ev.eventType] ?? ev.eventType}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-700 max-w-md">{ev.detail ?? '—'}</td>
                    <td className="py-2.5">
                      {ev.relatedWOId ? (
                        <Link to={`/work-orders/${ev.relatedWOId}`} className="font-semibold text-blue-700 hover:underline">
                          WO #{ev.relatedWOId}
                        </Link>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Lịch sử giờ chạy */}
      {history.length > 0 && (
        <Card title="Lịch sử ghi nhận giờ chạy (RuntimeLogs)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  {['Thời điểm', 'Giá trị đồng hồ', 'Delta (h)', 'Nguồn dữ liệu'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map(h => (
                  <tr key={h.logId} className="hover:bg-gray-50">
                    <td className="py-2.5 pr-4 font-medium text-gray-800">{fDateTime(h.captureTime)}</td>
                    <td className="py-2.5 pr-4 font-mono font-bold text-gray-900">{fNumber(h.readingValue)} h</td>
                    <td className="py-2.5 pr-4">
                      <Badge color={h.deltaHours > 0 ? 'blue' : 'gray'}>+{h.deltaHours} h</Badge>
                    </td>
                    <td className="py-2.5 font-medium text-gray-700">{h.dataSource}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal chỉnh sửa */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Chỉnh sửa tài sản" size="lg">
        <AssetForm
          asset={asset} locations={locs}
          canUploadPhoto={canEditAsset}
          onSuccess={() => { setEditOpen(false); load(); toast.success('Đã cập nhật tài sản'); }}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="Xác nhận xoá tài sản"
        message={`Bạn có muốn xoá tài sản "${asset.assetName}" này không?`}
        confirmLabel="Có"
        cancelLabel="Không"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteAsset}
        onCancel={() => (deleting ? null : setDeleteOpen(false))}
      />

      {/* Modal QR */}
      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="QR Code" size="sm">
        <div className="flex flex-col items-center gap-4">
          <img src={assetApi.getQRUrl(id)} alt="QR" className="w-52 h-52 border rounded-xl" />
          <a href={assetApi.getQRUrl(id)} download className="text-sm text-blue-600 hover:underline">
            Tải ảnh QR (PNG)
          </a>
        </div>
      </Modal>

      {/* Modal nhập giờ chạy */}
      <Modal open={readingOpen} onClose={() => setReadingOpen(false)} title="Nhập chỉ số đồng hồ máy" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            Nhập <strong>chỉ số hiện tại</strong> đang hiển thị trên màn hình máy, không phải "số giờ thêm trong ngày".
            Hệ thống sẽ tính bước nhảy so với lần ghi trước để cộng vào <strong>tổng tích lũy (delta)</strong>.
          </p>
          <Input
            label="Chỉ số đồng hồ máy (giờ)"
            type="number" min={counter?.lastReadingValue ?? 0}
            placeholder={`Tối thiểu ${counter?.lastReadingValue ?? 0}`}
            value={reading}
            onChange={e => setReading(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setReadingOpen(false)}>Hủy</Button>
            <Button onClick={handleRecordReading} loading={readLoading}>Ghi nhận</Button>
          </div>
        </div>
      </Modal>

      {/* Lightbox xem ảnh toàn màn hình */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white"
            onClick={() => setLightboxSrc(null)}
          >
            <X size={28} />
          </button>
          <img
            src={lightboxSrc}
            alt="Ảnh thiết bị"
            className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
