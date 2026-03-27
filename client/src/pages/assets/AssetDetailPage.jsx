/**
 * AssetDetailPage.jsx — Chi tiết tài sản: thông tin, bộ đếm giờ, QR, checklist gần đây.
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Pencil, QrCode, ArrowLeft, Gauge, History, Clock } from 'lucide-react';
import { assetApi }    from '../../api/asset.api.js';
import { Badge }       from '../../components/ui/Badge.jsx';
import { Card }        from '../../components/ui/Card.jsx';
import { Button }      from '../../components/ui/Button.jsx';
import { Modal }       from '../../components/ui/Modal.jsx';
import { Input }       from '../../components/ui/Input.jsx';
import { PageLoader }  from '../../components/ui/Spinner.jsx';
import { AssetForm }   from './AssetForm.jsx';
import { ASSET_STATUS_LABEL, ASSET_STATUS_COLOR, fDate, fDateTime, fNumber } from '../../utils/format.js';
import toast from 'react-hot-toast';

export function AssetDetailPage() {
  const { id } = useParams();
  const [asset,          setAsset]          = useState(null);
  const [counter,        setCounter]        = useState(null);
  const [hourlySchedules, setHourlySchedules] = useState([]);
  const [history,        setHistory]        = useState([]);
  const [types,          setTypes]          = useState([]);
  const [locs,           setLocs]           = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [editOpen,    setEditOpen]    = useState(false);
  const [qrOpen,      setQrOpen]      = useState(false);
  const [readingOpen, setReadingOpen] = useState(false);
  const [reading,     setReading]     = useState('');
  const [readLoading, setReadLoading] = useState(false);

  const load = async () => {
    try {
      const [ar, cr, hr] = await Promise.all([
        assetApi.getById(id),
        assetApi.getCounter(id),
        assetApi.getHistory(id),
      ]);
      setAsset(ar.data.data);
      setCounter(cr.data.data?.counter ?? null);
      setHourlySchedules(cr.data.data?.hourlySchedules ?? []);
      setHistory(hr.data.data ?? []);
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

  if (loading) return <PageLoader />;
  if (!asset)  return <div className="text-center py-20 text-gray-400">Không tìm thấy tài sản</div>;

  const c = counter;
  const hasHourlySchedule = hourlySchedules.length > 0;
  const pmDateDisplay = c?.estimatedNextPMDate
    ? fDate(c.estimatedNextPMDate)
    : hasHourlySchedule
      ? 'Chưa đủ dữ liệu giờ chạy'
      : 'Chưa có lịch theo giờ (HOURS)';

  return (
    <div className="space-y-5">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Link to="/assets" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <h2 className="text-lg font-bold text-gray-900">{asset.assetName}</h2>
          <Badge color={ASSET_STATUS_COLOR[asset.status]}>{ASSET_STATUS_LABEL[asset.status]}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setQrOpen(true)}>
            <QrCode size={14} /> QR Code
          </Button>
          <Button size="sm" onClick={() => setEditOpen(true)}>
            <Pencil size={14} /> Chỉnh sửa
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Thông tin cơ bản */}
        <Card title="Thông tin thiết bị" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            {[
              ['Mã tài sản',     `#${asset.assetId}`],
              ['Loại thiết bị',  asset.typeName],
              ['Vị trí',         asset.locationName],
              ['Nhà sản xuất',   asset.manufacturer || '—'],
              ['Số Serial',      asset.serialNumber || '—'],
              ['Ngày đưa vào SD', fDate(asset.commissionDate)],
              ['Tạo lúc',        fDateTime(asset.createdAt)],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                <p className="font-semibold text-gray-900 mt-1">{val}</p>
              </div>
            ))}
            {asset.description && (
              <div className="col-span-2">
                <p className="text-gray-400 text-xs">Mô tả</p>
                <p className="text-gray-700 mt-0.5">{asset.description}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Bộ đếm giờ */}
        <Card
          title="Bộ đếm giờ chạy"
          action={
            <Button size="xs" variant="secondary" onClick={() => setReadingOpen(true)}>
              <Gauge size={12} /> Nhập giờ
            </Button>
          }
        >
          {c ? (
            <div className="space-y-3 text-sm">
              {[
                ['Tổng giờ tích lũy',    `${fNumber(c.totalAccumulatedHours)} h`],
                ['Giá trị đồng hồ cuối', `${fNumber(c.lastReadingValue)} h`],
                ['Trung bình/ngày',      `${c.averageHoursPerDay ?? 0} h/ngày`],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
                  <span className="font-medium text-gray-600">{l}</span>
                  <span className="font-bold text-gray-900">{v}</span>
                </div>
              ))}
              {/* PM date: hiển thị khác nhau tùy có lịch HOURS hay không */}
              <div className="flex justify-between items-start py-1">
                <span className="font-medium text-gray-600">Ngày PM dự báo</span>
                <span className={`font-bold text-right text-xs max-w-[55%] ${
                  c.estimatedNextPMDate ? 'text-gray-900' : 'text-amber-600'
                }`}>
                  {pmDateDisplay}
                </span>
              </div>
              {!hasHourlySchedule && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1.5 leading-relaxed">
                  Tạo lịch bảo trì với đơn vị <strong>HOURS</strong> để hệ thống tự dự báo ngày PM.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">Chưa có dữ liệu đồng hồ</p>
          )}
        </Card>
      </div>

      {/* Runtime history */}
      {history.length > 0 && (
        <Card title="Lịch sử ghi nhận giờ chạy">
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

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Chỉnh sửa tài sản" size="lg">
        <AssetForm
          asset={asset} types={types} locations={locs}
          onSuccess={() => { setEditOpen(false); load(); toast.success('Đã cập nhật'); }}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>

      {/* QR modal */}
      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="QR Code" size="sm">
        <div className="flex flex-col items-center gap-4">
          <img src={assetApi.getQRUrl(id)} alt="QR" className="w-52 h-52 border rounded-xl" />
          <a href={assetApi.getQRUrl(id)} download className="text-sm text-blue-600 hover:underline">
            Tải ảnh QR (PNG)
          </a>
        </div>
      </Modal>

      {/* Record reading modal */}
      <Modal open={readingOpen} onClose={() => setReadingOpen(false)} title="Nhập giờ chạy đồng hồ" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Nhập giá trị đồng hồ hiện tại trên màn hình máy (số giờ tích lũy).
          </p>
          <Input
            label="Giá trị đồng hồ (giờ)"
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
    </div>
  );
}
