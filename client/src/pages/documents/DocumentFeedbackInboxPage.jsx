/**
 * DocumentFeedbackInboxPage.jsx — Chuyên viên KTS: hàng đợi phản hồi / góp ý tài liệu, cập nhật trạng thái.
 * API: GET/PATCH /api/document-feedback. Liên quan: rbac DOCUMENT_FEEDBACK:REVIEW, migration 038.
 * Điều hướng về kho tài liệu: link "← Về kho tài liệu" ở đầu trang (không lặp link "Mở kho" trên từng dòng).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/index.js';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { MessageSquare, FileText, ExternalLink, FileSpreadsheet } from 'lucide-react';
import { fDateTime } from '../../utils/format.js';
import { documentFilePublicUrl } from '../../utils/documentUrl.js';
import { exportRowsToExcel } from '../../utils/excelExport.js';
import toast from 'react-hot-toast';

const FILE_BASE = import.meta.env.VITE_API_BASE;

const STATUS_LABEL = {
  OPEN: 'Chờ xử lý',
  IN_REVIEW: 'Đang xem xét',
  RESOLVED: 'Đã xử lý',
  DISMISSED: 'Không xử lý',
};

const STATUS_COLOR = {
  OPEN: 'yellow',
  IN_REVIEW: 'blue',
  RESOLVED: 'green',
  DISMISSED: 'gray',
};

export function DocumentFeedbackInboxPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [editRow, setEditRow] = useState(null);
  const [reviewStatus, setReviewStatus] = useState('IN_REVIEW');
  const [reviewNote, setReviewNote] = useState('');
  const [saving, setSaving] = useState(false);

  const limit = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/document-feedback', { params });
      const d = res.data.data;
      setItems(d?.items ?? []);
      setTotal(d?.total ?? 0);
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Không tải được hàng đợi');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (row) => {
    setEditRow(row);
    setReviewStatus(row.status === 'OPEN' ? 'IN_REVIEW' : row.status);
    setReviewNote(row.reviewNote ?? '');
  };

  const saveReview = async (e) => {
    e.preventDefault();
    if (!editRow) return;
    setSaving(true);
    try {
      await api.patch(`/document-feedback/${editRow.feedbackId}`, {
        status: reviewStatus,
        reviewNote: reviewNote.trim() || null,
      });
      toast.success('Đã cập nhật phản hồi');
      setEditRow(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Lỗi lưu');
    } finally {
      setSaving(false);
    }
  };

  const fileUrl = (filePath) => documentFilePublicUrl(filePath, FILE_BASE);

  const handleExportExcel = () => {
    const ok = exportRowsToExcel({
      rows: items.map((row) => ({
        'ID phản hồi': row.feedbackId,
        'ID tài liệu': row.digitalAssetId ?? '',
        'Tài liệu': row.fileName ?? '',
        'Người góp ý': row.authorName ?? '',
        'Nội dung': row.body ?? '',
        'Trạng thái phản hồi': STATUS_LABEL[row.status] ?? row.status ?? '',
        'Trạng thái tài liệu': row.documentStatus ?? '',
        'Ghi chú kỹ thuật': row.reviewNote ?? '',
        'Thời gian gửi': fDateTime(row.createdAt) ?? '',
      })),
      sheetName: 'Phan hoi tai lieu',
      fileName: `phan-hoi-tai-lieu-trang-${page}.xlsx`,
    });
    if (!ok) {
      toast.error('Không có dữ liệu để xuất Excel');
      return;
    }
    toast.success('Đã xuất Excel phản hồi tài liệu');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="text-blue-600" size={22} />
            Phản hồi & góp ý tài liệu
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Tiếp nhận góp ý từ KTV hiện trường, Trưởng ca, Trưởng phòng, Admin, Ban GĐ — cập nhật trạng thái và ghi chú xử lý.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleExportExcel}
            disabled={loading || items.length === 0}
            title={
              items.length === 0
                ? 'Không có dữ liệu để xuất'
                : 'Xuất Excel theo danh sách đang hiển thị'
            }
          >
            <FileSpreadsheet size={15} /> Xuất Excel
          </Button>
          <Link
            to="/documents"
            className="text-sm font-semibold text-blue-600 hover:text-blue-800"
          >
            ← Về kho tài liệu
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-52">
          <Select
            label="Lọc trạng thái"
            value={statusFilter}
            onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
          >
            <option value="">Tất cả</option>
            <option value="OPEN">Chờ xử lý</option>
            <option value="IN_REVIEW">Đang xem xét</option>
            <option value="RESOLVED">Đã xử lý</option>
            <option value="DISMISSED">Không xử lý</option>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : items.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Không có phản hồi"
            description="Khi có góp ý mới về tài liệu, chúng sẽ hiển thị tại đây."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Tài liệu', 'Người góp ý', 'Nội dung', 'Trạng thái tài liệu', 'Gửi lúc', ''].map((h) => (
                    <th key={h} className="text-left text-xs font-bold text-gray-700 uppercase tracking-wide px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((row) => (
                  <tr key={row.feedbackId} className="hover:bg-blue-50/40">
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-start gap-2">
                        <FileText size={16} className="text-blue-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-gray-900">{row.fileName}</p>
                          <Badge color={STATUS_COLOR[row.status] ?? 'gray'}>
                            {STATUS_LABEL[row.status] ?? row.status}
                          </Badge>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top font-medium text-gray-800">{row.authorName}</td>
                    <td className="px-4 py-3 align-top text-gray-700 max-w-md">
                      <p className="whitespace-pre-wrap break-words">{row.body}</p>
                      {row.reviewNote && (
                        <p className="mt-2 text-xs text-gray-500 border-l-2 border-blue-200 pl-2">
                          <span className="font-semibold">Ghi chú KT:</span> {row.reviewNote}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-gray-600 text-xs">{row.documentStatus}</td>
                    <td className="px-4 py-3 align-top text-gray-700 whitespace-nowrap">{fDateTime(row.createdAt)}</td>
                    <td className="px-4 py-3 align-top">
                      <Button type="button" size="sm" onClick={() => openEdit(row)}>
                        Cập nhật
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && total > limit && (
        <Pagination page={page} totalPages={Math.ceil(total / limit) || 1} onChange={setPage} />
      )}

      <Modal open={!!editRow} onClose={() => setEditRow(null)} title="Xử lý phản hồi" size="md">
        {editRow && (
          <form onSubmit={saveReview} className="space-y-4">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Tài liệu:</span> {editRow.fileName}
            </p>
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{editRow.body}</p>
            <Select
              label="Trạng thái xử lý"
              value={reviewStatus}
              onChange={(e) => setReviewStatus(e.target.value)}
            >
              <option value="OPEN">Chờ xử lý</option>
              <option value="IN_REVIEW">Đang xem xét</option>
              <option value="RESOLVED">Đã xử lý</option>
              <option value="DISMISSED">Không xử lý</option>
            </Select>
            <Input
              label="Ghi chú (phản hồi cho người góp ý / nội bộ)"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="VD: Đã cập nhật phiên bản 2, đang chờ phê duyệt…"
            />
            <div className="flex flex-wrap gap-2 justify-between pt-2">
              {editRow.filePath ? (
                <a
                  href={fileUrl(editRow.filePath)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink size={14} /> Xem file (tab mới)
                </a>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setEditRow(null)}>
                  Hủy
                </Button>
                <Button type="submit" loading={saving}>
                  Lưu
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
