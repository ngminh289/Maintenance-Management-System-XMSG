/**
 * ChecklistPage.jsx — QR Scan simulation + Submit checklist.
 * luongxulykiemtra.rule: Quét QR → hiển thị 2 Tab (Checklist + Tài liệu SOP) → Submit → Auto-logic.
 * QR: mã gắn với tài sản — quét (hoặc nhập mã) để mở đúng thiết bị, xem tài liệu SOP + checklist.
 * Không phải “mở khóa” vật lý trừ khi nhà máy tích hợp cổng/PLC; trong app = mở ngữ cảnh làm việc an toàn.
 * RBAC: gửi kết quả chỉ khi CHECKLIST_RESULT:CREATE (Công nhân, Trưởng ca); NV KT xem mẫu, không nộp.
 */
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QrCode, FileText, CheckSquare, AlertTriangle, XCircle, CheckCircle, ExternalLink, Tag } from 'lucide-react';
import { checklistApi } from '../../api/checklist.api.js';
import { Button }  from '../../components/ui/Button.jsx';
import { Input, Textarea, Select } from '../../components/ui/Input.jsx';
import { Badge }   from '../../components/ui/Badge.jsx';
import { Card }    from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { CHECKLIST_STATUS_COLOR, fDateTime } from '../../utils/format.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { canDo } from '../../utils/rbac.js';
import toast from 'react-hot-toast';

const INPUT_TYPE_LABEL = {
  PassFail:  'Đạt / Không đạt',
  Numeric:   'Nhập số',
  Text:      'Ghi chú',
  Photo:     'Ảnh bằng chứng',
  Range:     'Giá trị trong khoảng',
  Selection: 'Lựa chọn',
};

export function ChecklistPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const canSubmitChecklist = canDo(user, 'CHECKLIST_RESULT:CREATE');
  const [assetInput,  setAssetInput]  = useState('');
  const [qrData,      setQrData]      = useState(null);
  const [scanning,    setScanning]    = useState(false);
  const [activeTab,   setActiveTab]   = useState('checklist');
  const [overallStatus, setOverallStatus] = useState('OK');
  const [notes,       setNotes]       = useState('');
  const [readingValue, setReadingValue] = useState('');
  const [answers,     setAnswers]     = useState({});
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(null);
  const [evidencePhoto, setEvidencePhoto] = useState(null);
  const [activeTagFilter, setActiveTagFilter] = useState('ALL');

  useEffect(() => {
    const aid = searchParams.get('assetId')?.trim();
    if (aid) setAssetInput(aid);
  }, [searchParams]);

  // Tập hợp tất cả tags từ documents để hiển thị bộ lọc
  const allDocTags = useMemo(() => {
    if (!qrData?.documents?.length) return [];
    const map = new Map();
    qrData.documents.forEach(doc =>
      doc.tags?.forEach(t => map.set(t.tagId, t.tagName)),
    );
    return [...map.entries()].map(([tagId, tagName]) => ({ tagId, tagName }));
  }, [qrData]);

  const filteredDocs = useMemo(() => {
    if (!qrData?.documents) return [];
    if (activeTagFilter === 'ALL') return qrData.documents;
    return qrData.documents.filter(doc =>
      doc.tags?.some(t => String(t.tagId) === String(activeTagFilter)),
    );
  }, [qrData, activeTagFilter]);

  const handleScan = async () => {
    if (!assetInput.trim()) return;
    setScanning(true);
    setQrData(null);
    setSubmitted(null);
    setAnswers({});
    try {
      const res = await checklistApi.getQRInfo(assetInput.trim());
      setQrData(res.data.data);
      toast.success(`Đã tải thông tin: ${res.data.data.asset.assetName}`);
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Không tìm thấy tài sản');
    } finally { setScanning(false); }
  };

  const setAnswer = (questionId, value) =>
    setAnswers(p => ({ ...p, [questionId]: value }));

  const handleSubmit = async () => {
    if (!qrData) return;
    setSubmitting(true);
    try {
      const details = Object.entries(answers).map(([questionId, value]) => ({
        questionId: Number(questionId),
        answerValue: String(value),
        isOk: value !== 'false' && value !== '0' && value !== 'NG',
      }));

      // Nếu có ảnh minh chứng → dùng FormData (multipart)
      let res;
      if (evidencePhoto) {
        const fd = new FormData();
        fd.append('photo',         evidencePhoto);
        fd.append('assetId',       qrData.asset.assetId);
        fd.append('overallStatus', overallStatus);
        fd.append('notes',         notes);
        if (readingValue) fd.append('readingValue', readingValue);
        fd.append('details', JSON.stringify(details));
        res = await checklistApi.submitWithPhoto(fd);
      } else {
        res = await checklistApi.submit({
          assetId: qrData.asset.assetId, overallStatus, notes,
          ...(readingValue && { readingValue: Number(readingValue) }),
          details,
        });
      }

      setSubmitted(res.data.data);
      toast.success('Đã gửi kết quả kiểm tra thành công!');
      setQrData(null);
      setEvidencePhoto(null);
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Lỗi gửi checklist');
    } finally { setSubmitting(false); }
  };

  const OVERALL_OPTIONS = [
    { value: 'OK',      label: 'OK — Máy chạy tốt',          icon: CheckCircle, color: 'green' },
    { value: 'WARNING', label: 'Cảnh báo — Có dấu hiệu lạ',  icon: AlertTriangle, color: 'yellow' },
    { value: 'NG',      label: 'NG — Máy ngừng / hỏng',      icon: XCircle, color: 'red' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-950">
        <p className="font-bold text-indigo-900 mb-1">Quét QR trong quy trình bảo trì là gì?</p>
        <p className="leading-relaxed text-indigo-900/90">
          Mã QR (hoặc <strong>mã tài sản</strong>) gắn với <strong>đúng một thiết bị</strong> trong hệ thống. Quét hoặc nhập mã để mở{' '}
          <strong>checklist kiểm tra</strong> và <strong>tài liệu SOP</strong> đúng máy — tránh làm nhầm tài liệu giữa nhiều tài sản.
          Đây là bước <em>an toàn nghiệp vụ</em>; <strong>không</strong> thay cho khóa cửa / PLC trừ khi nhà máy tích hợp thêm thiết bị vật lý.
        </p>
      </div>

      {/* QR Input */}
      <Card title="Quét mã QR tài sản">
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              placeholder="Nhập mã tài sản (AssetID) hoặc quét QR..."
              value={assetInput}
              onChange={e => setAssetInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleScan()}
            />
          </div>
          <Button onClick={handleScan} loading={scanning}>
            <QrCode size={15} /> Tải thông tin
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Nhập ID tài sản từ mã QR hoặc nhập trực tiếp để mô phỏng quét QR trên hiện trường.
        </p>
      </Card>

      {/* Kết quả submit */}
      {submitted && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-3">
          <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-800">Kết quả đã được ghi nhận!</p>
            <p className="text-sm text-green-700 mt-1">
              {submitted.workOrderId
                ? `Đã tự động tạo phiếu việc WO-${String(submitted.workOrderId).padStart(4, '0')} chờ phê duyệt.`
                : 'Tài sản đang hoạt động bình thường.'}
            </p>
            <button className="text-sm text-green-700 underline mt-2" onClick={() => setSubmitted(null)}>
              Kiểm tra tài sản khác
            </button>
          </div>
        </div>
      )}

      {/* 2-Tab Panel */}
      {qrData && (
        <>
          {/* Asset header */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <QrCode size={22} className="text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900">{qrData.asset.assetName}</p>
              <p className="text-sm text-gray-500">{qrData.asset.typeName} · {qrData.asset.locationName}</p>
            </div>
            <Badge color={CHECKLIST_STATUS_COLOR[qrData.asset.status] ?? 'gray'} className="ml-auto">
              {qrData.asset.status}
            </Badge>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden -mb-[1px]">
            {[
              { key: 'checklist', label: 'Checklist', icon: CheckSquare },
              { key: 'docs',      label: `Tài liệu SOP (${qrData.documents?.length ?? 0})`, icon: FileText },
              { key: 'history',   label: 'Lịch sử', icon: CheckCircle },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors
                  ${activeTab === key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {/* Tab: Checklist */}
          {activeTab === 'checklist' && (
            <Card>
              <div className="space-y-5">
                {/* Đồng hồ giờ chạy */}
                <Input
                  label="Giá trị đồng hồ giờ chạy (tuỳ chọn)"
                  type="number" min={0}
                  placeholder="Nhập số giờ hiện tại trên màn hình máy"
                  value={readingValue}
                  onChange={e => setReadingValue(e.target.value)}
                />

                {/* Danh sách câu hỏi */}
                {qrData.checklistTemplate?.items?.length > 0 ? (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800 text-sm">
                      {qrData.checklistTemplate.templateName}
                    </h4>
                    {qrData.checklistTemplate.items.map((item) => (
                      <div key={item.itemId} className="border border-gray-100 rounded-xl p-4">
                        <p className="text-sm font-medium text-gray-800 mb-2">{item.questionText}</p>
                        <p className="text-xs text-gray-400 mb-3">{INPUT_TYPE_LABEL[item.inputType] ?? item.inputType}</p>
                        {item.inputType === 'PassFail' && (
                          <div className="flex gap-2">
                            {['true', 'false'].map(v => (
                              <button
                                key={v}
                                onClick={() => setAnswer(item.itemId, v)}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors
                                  ${answers[item.itemId] === v
                                    ? (v === 'true' ? 'bg-green-600 text-white border-green-600' : 'bg-red-500 text-white border-red-500')
                                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                              >
                                {v === 'true' ? '✓ Đạt' : '✗ Không đạt'}
                              </button>
                            ))}
                          </div>
                        )}
                        {(item.inputType === 'Numeric' || item.inputType === 'Range') && (
                          <Input
                            type="number"
                            placeholder={item.rangeMin != null ? `${item.rangeMin} – ${item.rangeMax}` : 'Nhập giá trị'}
                            value={answers[item.itemId] ?? ''}
                            onChange={e => setAnswer(item.itemId, e.target.value)}
                          />
                        )}
                        {item.inputType === 'Text' && (
                          <Textarea
                            placeholder="Nhập ghi chú..."
                            value={answers[item.itemId] ?? ''}
                            onChange={e => setAnswer(item.itemId, e.target.value)}
                            rows={2}
                          />
                        )}
                        {item.inputType === 'Selection' && (
                          <Select
                            value={answers[item.itemId] ?? ''}
                            onChange={e => setAnswer(item.itemId, e.target.value)}
                          >
                            <option value="">— Chọn —</option>
                            {item.options?.map(o => <option key={o} value={o}>{o}</option>)}
                          </Select>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Không có câu hỏi checklist cho loại tài sản này.</p>
                )}

                {canSubmitChecklist ? (
                  <>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 mb-3">Đánh giá tổng thể *</p>
                      <div className="grid grid-cols-3 gap-2">
                        {OVERALL_OPTIONS.map(({ value, label, icon: Icon, color }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setOverallStatus(value)}
                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-colors
                              ${overallStatus === value
                                ? (color === 'green' ? 'border-green-500 bg-green-50 text-green-700'
                                  : color === 'yellow' ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                                  : 'border-red-500 bg-red-50 text-red-700')
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                          >
                            <Icon size={20} />
                            <span className="text-xs text-center leading-tight">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <Textarea
                      label="Ghi chú hiện trường"
                      placeholder="Mô tả tình trạng máy, tiếng kêu, rò rỉ..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />

                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-1">
                        Ảnh minh chứng (tuỳ chọn)
                      </label>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        onChange={e => setEvidencePhoto(e.target.files[0] ?? null)}
                        className="w-full text-sm text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium hover:file:bg-blue-100"
                      />
                      {evidencePhoto && (
                        <p className="text-xs text-green-600 mt-1 font-medium">✓ Đã chọn: {evidencePhoto.name}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">JPG/PNG/WEBP, tối đa 10MB</p>
                    </div>

                    <Button className="w-full justify-center" loading={submitting} onClick={handleSubmit}>
                      Gửi kết quả kiểm tra
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                    Tài khoản của bạn chỉ xem mẫu checklist / tài liệu. Nộp kết quả kiểm tra do <strong>Công nhân</strong> hoặc <strong>Trưởng ca</strong> thực hiện trên hiện trường.
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* Tab: Tài liệu SOP */}
          {activeTab === 'docs' && (
            <Card title="Tài liệu hướng dẫn / SOP">
              {qrData.documents?.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">Chưa có tài liệu đã duyệt cho tài sản này</p>
              ) : (
                <div className="space-y-4">
                  {/* Bộ lọc theo tag — BFD 1.3/3.3 */}
                  {allDocTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setActiveTagFilter('ALL')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors
                          ${activeTagFilter === 'ALL'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}
                      >
                        <Tag size={11} /> Tất cả ({qrData.documents.length})
                      </button>
                      {allDocTags.map(t => (
                        <button
                          key={t.tagId}
                          onClick={() => setActiveTagFilter(String(t.tagId))}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors
                            ${activeTagFilter === String(t.tagId)
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}
                        >
                          <Tag size={11} /> {t.tagName}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Danh sách tài liệu đã lọc */}
                  {filteredDocs.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Không có tài liệu với tag này</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredDocs.map(doc => (
                        <div key={doc.digitalAssetId} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                          <FileText size={18} className="text-blue-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{doc.fileName}</p>
                            <p className="text-xs font-medium text-gray-600">{doc.fileType?.toUpperCase()} · v{doc.currentVersion}</p>
                            {doc.description && <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>}
                            {doc.tags?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {doc.tags.map(t => (
                                  <span key={t.tagId} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                                    <Tag size={9} /> {t.tagName}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <a
                            href={`${import.meta.env.VITE_API_BASE?.replace('/api', '') || 'http://localhost:4000'}/uploads/documents/${doc.filePath?.split('/').pop()}`}
                            target="_blank" rel="noopener noreferrer"
                            className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 flex-shrink-0"
                          >
                            <ExternalLink size={15} />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Tab: History */}
          {activeTab === 'history' && (
            <Card title="Lịch sử kiểm tra gần đây">
              {qrData.recentResults?.length === 0
                ? <p className="text-sm text-gray-400 py-6 text-center">Chưa có lịch sử</p>
                : (
                  <div className="space-y-2">
                    {qrData.recentResults.map(r => (
                      <div key={r.checklistId} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                        <Badge color={CHECKLIST_STATUS_COLOR[r.overallStatus]}>{r.overallStatus}</Badge>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-700">{fDateTime(r.checkTime)}</p>
                          {r.notes && <p className="text-sm font-medium text-gray-800 mt-0.5">{r.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </Card>
          )}
        </>
      )}
    </div>
  );
}
