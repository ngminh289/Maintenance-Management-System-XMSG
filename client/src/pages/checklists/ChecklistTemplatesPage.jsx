/**
 * ChecklistTemplatesPage.jsx — BFD §5.1: Quản lý mẫu checklist theo loại tài sản (AssetType).
 * Chuyên viên KTS + Trưởng ca/Trưởng phòng: tạo/sửa mẫu và câu hỏi (một loại — tối đa một mẫu).
 * Ngưỡng an toàn (Numeric/Range) + gợi ý OK/WARNING/NG khi vi phạm; PassFail: gợi ý khi «Không đạt».
 * KTV hiện trường không vào trang này; kiểm tra hiện trường tại Checklist / QR.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { Layers, Plus, Pencil, Trash2, Save, ChevronRight, AlertTriangle, Sliders } from 'lucide-react';
import { assetApi } from '../../api/asset.api.js';
import { checklistApi } from '../../api/checklist.api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { canAccess, canDo } from '../../utils/rbac.js';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input, Textarea, Select } from '../../components/ui/Input.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import toast from 'react-hot-toast';

const INPUT_TYPES = [
  { value: 'PassFail', label: 'Đạt / Không đạt' },
  { value: 'Numeric', label: 'Nhập số' },
  { value: 'Text', label: 'Ghi chú' },
  { value: 'Range', label: 'Khoảng giá trị' },
  { value: 'Photo', label: 'Ảnh minh chứng' },
];

/** Gợi ý đánh giá tổng thể khi vi phạm ngưỡng / không đạt */
const SUGGEST_OPTS = [
  { value: '', label: '— Không gợi ý —' },
  { value: 'WARNING', label: 'CẢNH BÁO' },
  { value: 'NG', label: 'NG' },
];

export function ChecklistTemplatesPage() {
  const { user } = useAuth();
  const allowed = canAccess(user, 'checklist-manage');
  const canCreate = canDo(user, 'CHECKLIST_TEMPLATE:CREATE');
  const canUpdate = canDo(user, 'CHECKLIST_TEMPLATE:UPDATE');

  const [types, setTypes] = useState([]);
  const [templateRows, setTemplateRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');

  const [newQuestion, setNewQuestion] = useState('');
  const [newInputType, setNewInputType] = useState('PassFail');
  const [newRangeMin, setNewRangeMin] = useState('');
  const [newRangeMax, setNewRangeMax] = useState('');
  const [newSafeMin, setNewSafeMin] = useState('');
  const [newSafeMax, setNewSafeMax] = useState('');
  const [newOutSuggest, setNewOutSuggest] = useState('');
  const [newPassFailSuggest, setNewPassFailSuggest] = useState('');
  const [adding, setAdding] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, tplRes] = await Promise.all([
        assetApi.getTypes(),
        checklistApi.getTemplates(),
      ]);
      setTypes(tRes.data.data ?? []);
      setTemplateRows(tplRes.data.data ?? []);
    } catch {
      toast.error('Không tải được danh sách loại / mẫu checklist');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const byType = useMemo(() => {
    const m = new Map();
    templateRows.forEach((row) => {
      const id = Number(row.assetTypeId);
      if (!m.has(id)) m.set(id, []);
      m.get(id).push(row);
    });
    return m;
  }, [templateRows]);

  const openType = async (assetTypeId) => {
    setCreateOpen(false);
    const list = byType.get(Number(assetTypeId)) || [];
    if (list.length === 0) {
      setSelectedTypeId(assetTypeId);
      setDetail(null);
      return;
    }
    setSelectedTypeId(assetTypeId);
    setDetailLoading(true);
    setDetail(null);
    try {
      const primary = list.sort((a, b) => Number(a.templateId) - Number(b.templateId))[0];
      const res = await checklistApi.getTemplateById(primary.templateId);
      setDetail(res.data.data);
      if (list.length > 1) {
        toast(`Loại này có ${list.length} mẫu trong CSDL — đang sửa mẫu #${primary.templateId}. Nên gộp còn một mẫu/loại.`, { icon: '⚠️' });
      }
    } catch {
      toast.error('Không tải chi tiết mẫu');
      setSelectedTypeId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const saveMeta = async () => {
    if (!detail || !canUpdate) return;
    setSavingMeta(true);
    try {
      const res = await checklistApi.updateTemplate(detail.templateId, {
        templateName: detail.templateName,
        description: detail.description ?? '',
      });
      setDetail(res.data.data);
      await loadAll();
      toast.success('Đã lưu thông tin mẫu');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Lỗi lưu');
    } finally {
      setSavingMeta(false);
    }
  };

  const createTemplate = async () => {
    if (!selectedTypeId || !createName.trim()) {
      toast.error('Nhập tên mẫu');
      return;
    }
    try {
      const res = await checklistApi.createTemplate({
        assetTypeId: selectedTypeId,
        templateName: createName.trim(),
        description: createDesc.trim() || undefined,
      });
      setDetail(res.data.data);
      setCreateOpen(false);
      setCreateName('');
      setCreateDesc('');
      await loadAll();
      toast.success('Đã tạo mẫu — thêm câu hỏi bên dưới');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Không tạo được (có thể loại này đã có mẫu)');
    }
  };

  const addItem = async () => {
    if (!detail || !newQuestion.trim()) {
      toast.error('Nhập nội dung câu hỏi');
      return;
    }
    setAdding(true);
    try {
      const body = {
        questionText: newQuestion.trim(),
        inputType: newInputType,
        sortOrder: (detail.items?.length ?? 0),
        isRequired: true,
      };
      if (newInputType === 'Range') {
        body.rangeMin = newRangeMin !== '' ? Number(newRangeMin) : null;
        body.rangeMax = newRangeMax !== '' ? Number(newRangeMax) : null;
      }
      if (newInputType === 'PassFail' && newPassFailSuggest) {
        body.passFailFailSuggest = newPassFailSuggest;
      }
      if (newInputType === 'Numeric' || newInputType === 'Range') {
        if (newSafeMin !== '') body.safeNumericMin = Number(newSafeMin);
        if (newSafeMax !== '') body.safeNumericMax = Number(newSafeMax);
        if (newOutSuggest) body.outOfRangeSuggest = newOutSuggest;
      }
      const res = await checklistApi.addTemplateItem(detail.templateId, body);
      setDetail(res.data.data);
      setNewQuestion('');
      setNewRangeMin('');
      setNewRangeMax('');
      setNewSafeMin('');
      setNewSafeMax('');
      setNewOutSuggest('');
      setNewPassFailSuggest('');
      await loadAll();
      toast.success('Đã thêm câu hỏi');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Lỗi thêm câu');
    } finally {
      setAdding(false);
    }
  };

  const removeItem = async (itemId) => {
    if (!detail || !canUpdate) return;
    if (!window.confirm('Xóa câu hỏi này?')) return;
    try {
      await checklistApi.deleteTemplateItem(itemId);
      const res = await checklistApi.getTemplateById(detail.templateId);
      setDetail(res.data.data);
      await loadAll();
      toast.success('Đã xóa');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Lỗi xóa');
    }
  };

  const updateItemField = async (item, patch) => {
    if (!detail || !canUpdate) return;
    try {
      await checklistApi.updateTemplateItem(item.itemId, patch);
      const res = await checklistApi.getTemplateById(detail.templateId);
      setDetail(res.data.data);
      await loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Lỗi cập nhật');
    }
  };

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  if (!canCreate && !canUpdate) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center text-gray-600">
        <p>Tài khoản của bạn chỉ xem danh mục — không có quyền sửa mẫu checklist.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-800">
        <p className="font-bold text-slate-900 flex items-center gap-2 mb-1">
          <Layers size={18} /> Quản lý mẫu checklist theo loại tài sản (§5.1)
        </p>
        <p className="leading-relaxed text-slate-700">
          Mỗi <strong>loại tài sản</strong> chỉ nên có <strong>một</strong> mẫu checklist. Chuyên viên KTS và Trưởng ca/Trưởng phòng soạn nội dung;
          tại <strong>Checklist / QR</strong> mọi người xem thiết bị; <strong>KTV hiện trường</strong> hoặc <strong>trưởng phòng</strong> mới gửi phiếu kiểm tra.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Loại tài sản & mẫu">
            <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
              {types.map((t) => {
                const list = byType.get(Number(t.assetTypeId)) || [];
                const has = list.length > 0;
                const active = Number(selectedTypeId) === Number(t.assetTypeId);
                return (
                  <li key={t.assetTypeId}>
                    <button
                      type="button"
                      onClick={() => openType(t.assetTypeId)}
                      className={`w-full text-left py-3 px-2 flex items-center gap-2 rounded-lg transition-colors
                        ${active ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50'}`}
                    >
                      <ChevronRight size={16} className={active ? 'text-blue-600' : 'text-gray-400'} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{t.typeName}</p>
                        <p className="text-xs text-gray-500">ID loại: {t.assetTypeId}</p>
                      </div>
                      {list.length > 1 && (
                        <Badge color="yellow" className="shrink-0">{list.length} mẫu</Badge>
                      )}
                      {has && list.length === 1 && (
                        <Badge color="green" className="shrink-0">Có mẫu</Badge>
                      )}
                      {!has && (
                        <Badge color="gray" className="shrink-0">Chưa có</Badge>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title={selectedTypeId ? `Chi tiết loại #${selectedTypeId}` : 'Chọn một loại'}>
            {!selectedTypeId && (
              <p className="text-sm text-gray-500 py-8 text-center">Chọn loại tài sản bên trái.</p>
            )}
            {selectedTypeId && !detail && !detailLoading && (byType.get(Number(selectedTypeId)) || []).length === 0 && (
              <div className="space-y-4 py-4">
                <p className="text-sm text-gray-600">Chưa có mẫu cho loại này.</p>
                {canCreate && (
                  <>
                    {!createOpen ? (
                      <Button variant="secondary" onClick={() => setCreateOpen(true)}>
                        <Plus size={16} /> Tạo mẫu checklist
                      </Button>
                    ) : (
                      <div className="space-y-3 border border-gray-200 rounded-xl p-4 bg-white">
                        <Input label="Tên mẫu *" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="VD: Kiểm tra hàng ngày — Máy nén" />
                        <Textarea label="Mô tả" value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} rows={2} />
                        <div className="flex gap-2">
                          <Button onClick={createTemplate}>Lưu mẫu mới</Button>
                          <Button variant="ghost" onClick={() => setCreateOpen(false)}>Huỷ</Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {detailLoading && (
              <div className="flex justify-center py-12"><Spinner /></div>
            )}

            {detail && !detailLoading && (
              <div className="space-y-5">
                <div className="flex items-start gap-2">
                  <Pencil size={16} className="text-gray-500 mt-1 shrink-0" />
                  <div className="flex-1 space-y-3">
                    <Input
                      label="Tên mẫu"
                      value={detail.templateName}
                      onChange={(e) => setDetail({ ...detail, templateName: e.target.value })}
                      disabled={!canUpdate}
                    />
                    <Textarea
                      label="Mô tả"
                      value={detail.description ?? ''}
                      onChange={(e) => setDetail({ ...detail, description: e.target.value })}
                      rows={2}
                      disabled={!canUpdate}
                    />
                    {canUpdate && (
                      <Button variant="secondary" size="sm" loading={savingMeta} onClick={saveMeta}>
                        <Save size={14} /> Lưu tên & mô tả
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Câu hỏi checklist</h4>
                  <div className="space-y-2 max-h-[32rem] overflow-y-auto border border-gray-100 rounded-xl">
                    {(detail.items || []).length === 0 && (
                      <p className="text-sm text-gray-400 p-4">Chưa có câu hỏi — thêm bên dưới.</p>
                    )}
                    {(detail.items || []).map((item) => (
                      <div key={item.itemId} className="p-3 border-b border-gray-50 last:border-0 space-y-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            className="flex-1"
                            value={item.questionText}
                            onChange={(e) => setDetail({
                              ...detail,
                              items: detail.items.map((i) =>
                                i.itemId === item.itemId ? { ...i, questionText: e.target.value } : i),
                            })}
                            onBlur={() => {
                              const cur = detail.items.find((i) => i.itemId === item.itemId);
                              if (cur && cur.questionText?.trim()) {
                                updateItemField(item, { questionText: cur.questionText.trim() });
                              }
                            }}
                            disabled={!canUpdate}
                          />
                          <div className="flex gap-2 items-center">
                            <Select
                              value={item.inputType}
                              onChange={(e) => updateItemField(item, { inputType: e.target.value })}
                              disabled={!canUpdate}
                              className="min-w-[140px]"
                            >
                              {INPUT_TYPES.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </Select>
                            {canUpdate && (
                              <button
                                type="button"
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                aria-label="Xóa câu"
                                onClick={() => removeItem(item.itemId)}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                        {item.inputType === 'Range' && (
                          <div className="flex flex-wrap gap-2">
                            <Input
                              label="Khoảng cho phép — Min"
                              type="number"
                              className="w-28"
                              value={item.rangeMin ?? ''}
                              onChange={(e) => setDetail({
                                ...detail,
                                items: detail.items.map((i) =>
                                  i.itemId === item.itemId ? { ...i, rangeMin: e.target.value } : i),
                              })}
                              onBlur={() => {
                                const cur = detail.items.find((i) => i.itemId === item.itemId);
                                const raw = cur?.rangeMin;
                                const n = raw === '' || raw == null ? null : Number(raw);
                                updateItemField(item, { rangeMin: n != null && Number.isNaN(n) ? null : n });
                              }}
                              disabled={!canUpdate}
                            />
                            <Input
                              label="Khoảng cho phép — Max"
                              type="number"
                              className="w-28"
                              value={item.rangeMax ?? ''}
                              onChange={(e) => setDetail({
                                ...detail,
                                items: detail.items.map((i) =>
                                  i.itemId === item.itemId ? { ...i, rangeMax: e.target.value } : i),
                              })}
                              onBlur={() => {
                                const cur = detail.items.find((i) => i.itemId === item.itemId);
                                const raw = cur?.rangeMax;
                                const n = raw === '' || raw == null ? null : Number(raw);
                                updateItemField(item, { rangeMax: n != null && Number.isNaN(n) ? null : n });
                              }}
                              disabled={!canUpdate}
                            />
                          </div>
                        )}
                        {item.inputType === 'PassFail' && (
                          <Select
                            label="Gợi ý đánh giá tổng thể khi chọn «Không đạt»"
                            value={item.passFailFailSuggest ?? ''}
                            onChange={(e) => updateItemField(item, { passFailFailSuggest: e.target.value || null })}
                            disabled={!canUpdate}
                            className="max-w-xs"
                          >
                            {SUGGEST_OPTS.map((o) => (
                              <option key={o.value || 'none'} value={o.value}>{o.label}</option>
                            ))}
                          </Select>
                        )}
                        {(item.inputType === 'Numeric' || item.inputType === 'Range') && (
                          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 space-y-2">
                            <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                              <Sliders size={14} /> Ngưỡng an toàn (so với giá trị KTV hiện trường nhập)
                            </p>
                            <div className="flex flex-wrap gap-2 items-end">
                              <Input
                                label="Min an toàn"
                                type="number"
                                className="w-28"
                                value={item.safeNumericMin ?? ''}
                                onChange={(e) => setDetail({
                                  ...detail,
                                  items: detail.items.map((i) =>
                                    i.itemId === item.itemId ? { ...i, safeNumericMin: e.target.value } : i),
                                })}
                                onBlur={() => {
                                  const cur = detail.items.find((i) => i.itemId === item.itemId);
                                  const raw = cur?.safeNumericMin;
                                  const n = raw === '' || raw == null ? null : Number(raw);
                                  updateItemField(item, { safeNumericMin: n != null && Number.isNaN(n) ? null : n });
                                }}
                                disabled={!canUpdate}
                              />
                              <Input
                                label="Max an toàn"
                                type="number"
                                className="w-28"
                                value={item.safeNumericMax ?? ''}
                                onChange={(e) => setDetail({
                                  ...detail,
                                  items: detail.items.map((i) =>
                                    i.itemId === item.itemId ? { ...i, safeNumericMax: e.target.value } : i),
                                })}
                                onBlur={() => {
                                  const cur = detail.items.find((i) => i.itemId === item.itemId);
                                  const raw = cur?.safeNumericMax;
                                  const n = raw === '' || raw == null ? null : Number(raw);
                                  updateItemField(item, { safeNumericMax: n != null && Number.isNaN(n) ? null : n });
                                }}
                                disabled={!canUpdate}
                              />
                              <Select
                                label="Gợi ý khi ngoài ngưỡng"
                                value={item.outOfRangeSuggest ?? ''}
                                onChange={(e) => updateItemField(item, { outOfRangeSuggest: e.target.value || null })}
                                disabled={!canUpdate}
                                className="min-w-[200px]"
                              >
                                {SUGGEST_OPTS.map((o) => (
                                  <option key={o.value || 'none'} value={o.value}>{o.label}</option>
                                ))}
                              </Select>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {canUpdate && (
                  <div className="border border-dashed border-blue-200 rounded-xl p-4 bg-blue-50/30 space-y-3">
                    <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">Thêm câu hỏi</p>
                    <Input
                      placeholder="Nội dung câu hỏi *"
                      value={newQuestion}
                      onChange={(e) => setNewQuestion(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2 items-end">
                      <Select label="Kiểu nhập" value={newInputType} onChange={(e) => setNewInputType(e.target.value)}>
                        {INPUT_TYPES.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </Select>
                      {newInputType === 'Range' && (
                        <>
                          <Input label="Min khoảng" type="number" className="w-24" value={newRangeMin} onChange={(e) => setNewRangeMin(e.target.value)} />
                          <Input label="Max khoảng" type="number" className="w-24" value={newRangeMax} onChange={(e) => setNewRangeMax(e.target.value)} />
                        </>
                      )}
                      {newInputType === 'PassFail' && (
                        <Select label="Gợi ý khi không đạt" value={newPassFailSuggest} onChange={(e) => setNewPassFailSuggest(e.target.value)}>
                          {SUGGEST_OPTS.map((o) => (
                            <option key={o.value || 'none'} value={o.value}>{o.label}</option>
                          ))}
                        </Select>
                      )}
                      {(newInputType === 'Numeric' || newInputType === 'Range') && (
                        <>
                          <Input label="Min an toàn" type="number" className="w-24" value={newSafeMin} onChange={(e) => setNewSafeMin(e.target.value)} />
                          <Input label="Max an toàn" type="number" className="w-24" value={newSafeMax} onChange={(e) => setNewSafeMax(e.target.value)} />
                          <Select label="Gợi ý ngoài ngưỡng" value={newOutSuggest} onChange={(e) => setNewOutSuggest(e.target.value)}>
                            {SUGGEST_OPTS.map((o) => (
                              <option key={o.value || 'none'} value={o.value}>{o.label}</option>
                            ))}
                          </Select>
                        </>
                      )}
                      <Button loading={adding} onClick={addItem} className="mt-5">
                        <Plus size={16} /> Thêm
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    Quyền <strong>Phê duyệt</strong> mẫu (A) gán trong hệ thống cho Trưởng ca/phòng — có thể mở rộng luồng duyệt riêng sau.
                    Hiện mẫu sau khi lưu đã dùng được khi quét QR. <strong>Ngưỡng an toàn</strong> và gợi ý WARNING/NG hiển thị cho KTV hiện trường tại tab Checklist khi điền phiếu.
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
