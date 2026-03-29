/**
 * DocumentsPage.jsx — Kho tài liệu số: danh sách, upload, gửi phê duyệt, lịch sử phiên bản.
 * project.rule Phân hệ 3: Upload, phân loại (tag), liên kết tài sản, kiểm soát phiên bản.
 * Liên quan: api/index.js, api/approval.api.js, api/asset.api.js.
 */
import { useEffect, useState, useCallback } from 'react';
import { api }         from '../../api/index.js';
import { approvalApi } from '../../api/approval.api.js';
import { assetApi }    from '../../api/asset.api.js';
import { Badge }       from '../../components/ui/Badge.jsx';
import { Button }      from '../../components/ui/Button.jsx';
import { Modal }       from '../../components/ui/Modal.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import { Pagination }  from '../../components/ui/Pagination.jsx';
import { EmptyState }  from '../../components/ui/EmptyState.jsx';
import { PageLoader }  from '../../components/ui/Spinner.jsx';
import { FileText, Upload, Send, ExternalLink, History, RefreshCw, Tag } from 'lucide-react';
import { fDateTime, fDate } from '../../utils/format.js';
import toast from 'react-hot-toast';

const DA_STATUS_COLOR = { DRAFT: 'gray', PENDING: 'yellow', APPROVED: 'green', REJECTED: 'red', ARCHIVED: 'gray' };
const DA_STATUS_LABEL = { DRAFT: 'Bản nháp', PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', ARCHIVED: 'Lưu trữ' };

const FILE_BASE = import.meta.env.VITE_API_BASE?.replace('/api', '') || 'http://localhost:4000';
const fileUrl = (filePath) => `${FILE_BASE}/uploads/documents/${filePath?.split('/').pop() ?? ''}`;

export function DocumentsPage() {
  const [docs,       setDocs]       = useState([]);
  const [assets,     setAssets]     = useState([]);
  const [tags,       setTags]       = useState([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);

  // Upload new doc
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file,       setFile]       = useState(null);
  const [meta,       setMeta]       = useState({ description: '', assetId: '', tagIds: [] });
  const [uploading,  setUploading]  = useState(false);

  // Version history
  const [verDoc,     setVerDoc]     = useState(null); // doc đang xem versions
  const [versions,   setVersions]   = useState([]);
  const [verLoading, setVerLoading] = useState(false);

  // Upload new version
  const [newVerFile,   setNewVerFile]   = useState(null);
  const [changeNote,   setChangeNote]   = useState('');
  const [verUploading, setVerUploading] = useState(false);

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
    api.get('/tags').then(r => setTags(r.data.data?.items ?? r.data.data ?? [])).catch(() => {});
  }, [load]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) { toast.error('Chọn file trước'); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    if (meta.description)       fd.append('description', meta.description);
    if (meta.assetId)           fd.append('assetId', meta.assetId);
    if (meta.tagIds?.length)    fd.append('tagIds', JSON.stringify(meta.tagIds));
    try {
      await api.post('/digital-assets', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Đã upload tài liệu');
      setUploadOpen(false);
      setFile(null);
      setMeta({ description: '', assetId: '', tagIds: [] });
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

  const openVersions = async (doc) => {
    setVerDoc(doc);
    setVerLoading(true);
    setVersions([]);
    setNewVerFile(null);
    setChangeNote('');
    try {
      const res = await api.get(`/digital-assets/${doc.digitalAssetId}/versions`);
      setVersions(res.data.data ?? []);
    } catch { toast.error('Không tải được lịch sử phiên bản'); }
    finally { setVerLoading(false); }
  };

  const handleUploadVersion = async (e) => {
    e.preventDefault();
    if (!newVerFile) { toast.error('Chọn file mới trước'); return; }
    setVerUploading(true);
    const fd = new FormData();
    fd.append('file', newVerFile);
    if (changeNote) fd.append('changeNote', changeNote);
    try {
      await api.post(`/digital-assets/${verDoc.digitalAssetId}/versions`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Đã upload phiên bản mới — tài liệu về DRAFT');
      setNewVerFile(null);
      setChangeNote('');
      await openVersions(verDoc);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Lỗi upload phiên bản');
    } finally { setVerUploading(false); }
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
          : docs.length === 0
            ? <EmptyState icon={FileText} title="Chưa có tài liệu" description="Upload tài liệu kỹ thuật, SOP, bản vẽ..." />
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
                      <tr key={doc.digitalAssetId} className="hover:bg-blue-50/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-blue-400 flex-shrink-0" />
                            <div>
                              <p className="font-semibold text-gray-900 truncate max-w-[200px]">{doc.fileName}</p>
                              {doc.description && <p className="text-xs font-medium text-gray-500 truncate max-w-[200px]">{doc.description}</p>}
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
                          <div className="flex gap-1.5 items-center">
                            {/* Xem lịch sử phiên bản */}
                            <button
                              onClick={() => openVersions(doc)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="Lịch sử phiên bản"
                            >
                              <History size={14} />
                            </button>
                            {/* Gửi phê duyệt */}
                            {doc.status === 'DRAFT' && (
                              <button
                                onClick={() => handleSubmitApproval(doc.digitalAssetId)}
                                className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors" title="Gửi phê duyệt"
                              >
                                <Send size={14} />
                              </button>
                            )}
                            {/* Mở file */}
                            <a
                              href={fileUrl(doc.filePath)}
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

      {/* Modal upload tài liệu mới */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload tài liệu kỹ thuật" size="md">
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Chọn file *</label>
            <input
              type="file"
              onChange={e => setFile(e.target.files[0] ?? null)}
              className="w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-600 file:font-medium hover:file:bg-blue-100 transition-colors"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.dwg,.zip"
            />
            <p className="text-xs text-gray-500 mt-1">Hỗ trợ: PDF, Word, Excel, ảnh, DWG, ZIP. Tối đa 50MB.</p>
          </div>
          <Select label="Gắn với tài sản" value={meta.assetId} onChange={e => setMeta(p => ({ ...p, assetId: e.target.value }))}>
            <option value="">— Không gắn —</option>
            {assets.map(a => <option key={a.assetId} value={a.assetId}>{a.assetName}</option>)}
          </Select>
          <Input label="Mô tả" value={meta.description} onChange={e => setMeta(p => ({ ...p, description: e.target.value }))} placeholder="VD: Bản vẽ kỹ thuật lò nung #1" />
          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2 flex items-center gap-1.5">
                <Tag size={13} /> Gắn thẻ (tags)
              </label>
              <div className="flex flex-wrap gap-2">
                {tags.map(t => {
                  const sel = meta.tagIds.includes(t.tagId);
                  return (
                    <button
                      key={t.tagId}
                      type="button"
                      onClick={() => setMeta(p => ({
                        ...p,
                        tagIds: sel ? p.tagIds.filter(x => x !== t.tagId) : [...p.tagIds, t.tagId],
                      }))}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                        sel
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      #{t.tagName}
                    </button>
                  );
                })}
              </div>
              {meta.tagIds.length > 0 && (
                <p className="text-xs text-blue-600 mt-1.5">{meta.tagIds.length} thẻ đã chọn</p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setUploadOpen(false)}>Hủy</Button>
            <Button type="submit" loading={uploading}><Upload size={14} /> Upload</Button>
          </div>
        </form>
      </Modal>

      {/* Modal lịch sử phiên bản */}
      <Modal open={!!verDoc} onClose={() => setVerDoc(null)} title={`Phiên bản: ${verDoc?.fileName ?? ''}`} size="lg">
        <div className="space-y-5">
          {/* Danh sách lịch sử */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Lịch sử phiên bản</h4>
            {verLoading ? (
              <p className="text-sm text-gray-400 text-center py-4">Đang tải...</p>
            ) : versions.length === 0 ? (
              <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3">Chưa có lịch sử phiên bản nào.</p>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Phiên bản', 'Ngày thay đổi', 'Người thay đổi', 'Ghi chú', ''].map(h => (
                        <th key={h} className="text-left text-xs font-bold text-gray-600 px-3 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {versions.map(v => (
                      <tr key={v.versionId} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5">
                          <Badge color={v.versionNumber === verDoc?.currentVersion ? 'green' : 'gray'}>
                            v{v.versionNumber}{v.versionNumber === verDoc?.currentVersion ? ' (hiện tại)' : ''}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">{fDateTime(v.changeDate)}</td>
                        <td className="px-3 py-2.5 font-medium text-gray-800">{v.changedByName}</td>
                        <td className="px-3 py-2.5 text-gray-600 max-w-[200px] truncate">{v.changeNote ?? '—'}</td>
                        <td className="px-3 py-2.5">
                          <a
                            href={fileUrl(v.filePath)}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline font-medium"
                          >
                            Tải về
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Upload phiên bản mới */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <RefreshCw size={14} /> Upload phiên bản mới
            </h4>
            <form onSubmit={handleUploadVersion} className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">File mới *</label>
                <input
                  type="file"
                  onChange={e => setNewVerFile(e.target.files[0] ?? null)}
                  className="w-full text-sm text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-600 file:font-medium hover:file:bg-blue-100"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.dwg,.zip"
                />
              </div>
              <Input
                label="Ghi chú thay đổi"
                value={changeNote}
                onChange={e => setChangeNote(e.target.value)}
                placeholder="VD: Cập nhật theo tiêu chuẩn mới ISO 2024"
              />
              <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1.5">
                Sau khi upload, tài liệu sẽ về trạng thái <strong>DRAFT</strong> và cần gửi phê duyệt lại.
              </p>
              <div className="flex justify-end">
                <Button type="submit" loading={verUploading} size="sm">
                  <Upload size={13} /> Upload v{(verDoc?.currentVersion ?? 0) + 1}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Modal>
    </div>
  );
}
