/**
 * DocumentsPage.jsx — Kho tài liệu số: danh sách, upload, gửi phê duyệt.
 * project.rule Phân hệ 3: Upload, phân loại (tag), liên kết tài sản, kiểm soát phiên bản.
 */
import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/index.js';
import { approvalApi } from '../../api/approval.api.js';
import { Badge }   from '../../components/ui/Badge.jsx';
import { Button }  from '../../components/ui/Button.jsx';
import { Modal }   from '../../components/ui/Modal.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { FileText, Upload, Send, ExternalLink } from 'lucide-react';
import { assetApi } from '../../api/asset.api.js';
import { fDateTime } from '../../utils/format.js';
import toast from 'react-hot-toast';

const DA_STATUS_COLOR = { DRAFT: 'gray', PENDING: 'yellow', APPROVED: 'green', REJECTED: 'red', ARCHIVED: 'gray' };
const DA_STATUS_LABEL = { DRAFT: 'Bản nháp', PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', ARCHIVED: 'Lưu trữ' };

export function DocumentsPage() {
  const [docs,    setDocs]    = useState([]);
  const [assets,  setAssets]  = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file,       setFile]       = useState(null);
  const [meta,       setMeta]       = useState({ description: '', assetId: '' });
  const [uploading,  setUploading]  = useState(false);
  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/digital-assets', { params: { page, limit: LIMIT } });
      setDocs(res.data.data?.items ?? []);
      setTotal(res.data.data?.total ?? 0);
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => {
    load();
    assetApi.getAll({ limit: 200 }).then(r => setAssets(r.data.data?.items ?? [])).catch(() => {});
  }, [load]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) { toast.error('Chọn file trước'); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    if (meta.description) fd.append('description', meta.description);
    if (meta.assetId)     fd.append('assetId', meta.assetId);
    try {
      await api.post('/digital-assets', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Đã upload tài liệu');
      setUploadOpen(false);
      setFile(null);
      setMeta({ description: '', assetId: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Lỗi upload');
    } finally { setUploading(false); }
  };

  const handleSubmitApproval = async (docId) => {
    try {
      await approvalApi.submit({ resourceId: docId, resourceType: 'DIGITAL_ASSET' });
      toast.success('Đã gửi yêu cầu phê duyệt');
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Lỗi gửi phê duyệt'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => setUploadOpen(true)}>
          <Upload size={15} /> Upload tài liệu
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? <PageLoader />
          : docs.length === 0 ? <EmptyState icon={FileText} title="Chưa có tài liệu" description="Upload tài liệu kỹ thuật, SOP, bản vẽ..." />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Tài liệu', 'Tài sản', 'Phiên bản', 'Ngày upload', 'Trạng thái', ''].map(h => (
                      <th key={h} className="text-left text-xs font-bold text-gray-700 uppercase tracking-wide px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {docs.map(doc => (
                    <tr key={doc.digitalAssetId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-blue-400 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-gray-900 truncate max-w-[200px]">{doc.fileName}</p>
                            {doc.description && <p className="text-xs font-medium text-gray-600 truncate max-w-[200px]">{doc.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{doc.assetName ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge color="blue">v{doc.currentVersion}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">{fDateTime(doc.uploadDate)}</td>
                      <td className="px-4 py-3">
                        <Badge color={DA_STATUS_COLOR[doc.status]}>{DA_STATUS_LABEL[doc.status] ?? doc.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {doc.status === 'DRAFT' && (
                            <button
                              onClick={() => handleSubmitApproval(doc.digitalAssetId)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors" title="Gửi phê duyệt"
                            >
                              <Send size={14} />
                            </button>
                          )}
                          <a
                            href={`${import.meta.env.VITE_API_BASE?.replace('/api', '') || 'http://localhost:4000'}/uploads/documents/${doc.filePath?.split('/').pop() ?? ''}`}
                            target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="Mở file"
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / LIMIT)} onChange={setPage} />

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload tài liệu kỹ thuật" size="md">
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Chọn file *</label>
            <input
              type="file"
              onChange={e => setFile(e.target.files[0] ?? null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-600 file:font-medium hover:file:bg-blue-100 transition-colors"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.dwg,.zip"
            />
            <p className="text-xs text-gray-400 mt-1">Hỗ trợ: PDF, Word, Excel, PowerPoint, ảnh, DWG, ZIP. Tối đa 50MB.</p>
          </div>
          <Select label="Gắn với tài sản" value={meta.assetId} onChange={e => setMeta(p => ({ ...p, assetId: e.target.value }))}>
            <option value="">— Không gắn —</option>
            {assets.map(a => <option key={a.assetId} value={a.assetId}>{a.assetName}</option>)}
          </Select>
          <Input label="Mô tả" value={meta.description} onChange={e => setMeta(p => ({ ...p, description: e.target.value }))} placeholder="VD: Bản vẽ kỹ thuật lò nung #1" />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setUploadOpen(false)}>Hủy</Button>
            <Button type="submit" loading={uploading}><Upload size={14} /> Upload</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
