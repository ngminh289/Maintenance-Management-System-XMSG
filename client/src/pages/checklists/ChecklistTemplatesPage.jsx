import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  Save,
  ChevronRight,
  Sliders,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { assetApi } from '../../api/asset.api.js';
import { checklistApi } from '../../api/checklist.api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { canAccess, canDo } from '../../utils/rbac.js';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input, Textarea, Select } from '../../components/ui/Input.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';

const INPUT_TYPES = [
  { value: 'PassFail', label: 'Đạt / Không đạt' },
  { value: 'Numeric', label: 'Nhập số' },
  { value: 'Text', label: 'Ghi chú' },
  { value: 'Range', label: 'Khoảng giá trị' },
  { value: 'Photo', label: 'Ảnh minh chứng' },
];

const SUGGEST_OPTS = [
  { value: '', label: '-- Không gợi ý --' },
  { value: 'WARNING', label: 'CẢNH BÁO' },
  { value: 'NG', label: 'NG' },
];

export function ChecklistTemplatesPage() {
  const { user } = useAuth();
  const canRead = canDo(user, 'CHECKLIST_TEMPLATE:READ');
  const allowed = canAccess(user, 'checklist-manage') && canRead;
  const canCreate = canDo(user, 'CHECKLIST_TEMPLATE:CREATE');
  const canUpdate = canDo(user, 'CHECKLIST_TEMPLATE:UPDATE');
  const canDelete = canDo(user, 'CHECKLIST_TEMPLATE:DELETE');

  const [types, setTypes] = useState([]);
  const [templateRows, setTemplateRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
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
      toast.error('Không tải được danh sách loại tài sản và mẫu checklist');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const byType = useMemo(() => {
    const map = new Map();
    templateRows.forEach((row) => {
      const assetTypeId = Number(row.assetTypeId);
      if (!map.has(assetTypeId)) map.set(assetTypeId, []);
      map.get(assetTypeId).push(row);
    });
    return map;
  }, [templateRows]);

  const openTemplate = async (templateId) => {
    if (!templateId) {
      setDetail(null);
      setSelectedTemplateId(null);
      return;
    }
    setDetailLoading(true);
    setDetail(null);
    setSelectedTemplateId(Number(templateId));
    try {
      const res = await checklistApi.getTemplateById(templateId);
      setDetail(res.data.data);
    } catch {
      toast.error('Không tải được chi tiết mẫu');
      setSelectedTemplateId(null);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const openType = async (assetTypeId) => {
    setCreateOpen(false);
    const list = byType.get(Number(assetTypeId)) || [];
    setSelectedTypeId(Number(assetTypeId));
    setDetail(null);
    setSelectedTemplateId(null);
    if (list.length === 0) {
      return;
    }
    const primary = [...list].sort(
      (a, b) => Number(a.templateId) - Number(b.templateId),
    )[0];
    await openTemplate(primary.templateId);
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
      toast.error(err.response?.data?.message ?? 'Lỗi lưu thông tin mẫu');
    } finally {
      setSavingMeta(false);
    }
  };

  const createTemplate = async () => {
    if (!selectedTypeId || !createName.trim()) {
      toast.error('Vui lòng nhập tên mẫu');
      return;
    }
    try {
      const res = await checklistApi.createTemplate({
        assetTypeId: selectedTypeId,
        templateName: createName.trim(),
        description: createDesc.trim() || undefined,
      });
      setDetail(res.data.data);
      setSelectedTemplateId(Number(res.data.data?.templateId));
      setCreateOpen(false);
      setCreateName('');
      setCreateDesc('');
      await loadAll();
      toast.success('Đã tạo mẫu checklist');
    } catch (err) {
      toast.error(
        err.response?.data?.message ??
          'Không tạo được mẫu checklist cho loại tài sản này',
      );
    }
  };

  const addItem = async () => {
    if (!detail || !newQuestion.trim() || !canUpdate) {
      toast.error('Vui lòng nhập nội dung câu hỏi');
      return;
    }
    setAdding(true);
    try {
      const body = {
        questionText: newQuestion.trim(),
        inputType: newInputType,
        sortOrder: detail.items?.length ?? 0,
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
      toast.error(err.response?.data?.message ?? 'Lỗi thêm câu hỏi');
    } finally {
      setAdding(false);
    }
  };

  const removeTemplate = async () => {
    if (!detail || !canDelete) return;
    if (!window.confirm('Xóa toàn bộ mẫu checklist này?')) return;
    try {
      await checklistApi.deleteTemplate(detail.templateId);
      await loadAll();
      const nextList = byType.get(Number(selectedTypeId)) || [];
      const remain = nextList.filter(
        (row) => Number(row.templateId) !== Number(detail.templateId),
      );
      if (remain.length > 0) {
        await openTemplate(remain[0].templateId);
      } else {
        setDetail(null);
        setSelectedTemplateId(null);
      }
      toast.success('Đã xóa mẫu checklist');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Lỗi xóa mẫu checklist');
    }
  };

  const removeItem = async (itemId) => {
    if (!detail || !canDelete) return;
    if (!window.confirm('Xóa câu hỏi này?')) return;
    try {
      await checklistApi.deleteTemplateItem(itemId);
      const res = await checklistApi.getTemplateById(detail.templateId);
      setDetail(res.data.data);
      await loadAll();
      toast.success('Đã xóa câu hỏi');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Lỗi xóa câu hỏi');
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-amber-50 shadow-sm">
        <div className="flex items-start gap-3 px-5 py-5">
          <div className="mt-0.5 rounded-xl bg-sky-600 p-2 text-white shadow-sm">
            <Layers size={18} />
          </div>
          <div className="space-y-1">
            <p className="text-base font-bold text-slate-900">
              Mẫu checklist theo loại tài sản
            </p>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-700">
              Mỗi loại tài sản có thể có nhiều mẫu checklist theo ngữ cảnh vận hành
              (đầu ca, cuối ca, định kỳ, sau sự cố). Người có quyền chỉnh sửa có
              thể cập nhật tên mẫu, câu hỏi và ngưỡng an toàn; các bộ phận còn
              lại dùng trang này để tra cứu nội dung vận hành.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card
            title="Loại tài sản và mẫu checklist"
            className="border-slate-200 shadow-sm"
          >
            <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
              {types.map((type) => {
                const list = byType.get(Number(type.assetTypeId)) || [];
                const hasTemplate = list.length > 0;
                const active =
                  Number(selectedTypeId) === Number(type.assetTypeId);

                return (
                  <li key={type.assetTypeId}>
                    <button
                      type="button"
                      onClick={() => openType(type.assetTypeId)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                        active
                          ? 'border border-sky-200 bg-sky-50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <ChevronRight
                        size={16}
                        className={active ? 'text-sky-600' : 'text-slate-400'}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900">
                          {type.typeName}
                        </p>
                        <p className="text-xs text-slate-500">
                          ID loại: {type.assetTypeId}
                        </p>
                      </div>

                      {list.length > 1 && (
                        <Badge color="yellow" className="shrink-0">
                          {list.length} mẫu
                        </Badge>
                      )}
                      {hasTemplate && list.length === 1 && (
                        <Badge color="green" className="shrink-0">
                          Có mẫu
                        </Badge>
                      )}
                      {!hasTemplate && (
                        <Badge color="gray" className="shrink-0">
                          Chưa có
                        </Badge>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card
            title={
              selectedTypeId
                ? `Chi tiết loại #${selectedTypeId}`
                : 'Chọn một loại tài sản'
            }
            className="border-slate-200 shadow-sm"
          >
            {!selectedTypeId && (
              <p className="py-8 text-center text-sm text-slate-500">
                Chọn một loại tài sản ở cột bên trái để xem chi tiết.
              </p>
            )}

            {selectedTypeId && (
              <div className="space-y-4 py-1">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Danh sách mẫu của loại #{selectedTypeId}
                  </p>
                  {(byType.get(Number(selectedTypeId)) || []).length > 0 ? (
                    <Select
                      value={selectedTemplateId ?? ''}
                      onChange={(e) => openTemplate(Number(e.target.value))}
                    >
                      {(byType.get(Number(selectedTypeId)) || []).map((tpl) => (
                        <option key={tpl.templateId} value={tpl.templateId}>
                          #{tpl.templateId} — {tpl.templateName}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <p className="text-sm text-slate-600">Loại tài sản này chưa có mẫu checklist.</p>
                  )}

                  {canCreate && (
                    <>
                      {!createOpen ? (
                        <Button variant="secondary" onClick={() => setCreateOpen(true)}>
                          <Plus size={16} /> Tạo thêm template
                        </Button>
                      ) : (
                        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                          <Input
                            label="Tên mẫu *"
                            value={createName}
                            onChange={(e) => setCreateName(e.target.value)}
                            placeholder="Ví dụ: Kiểm tra đầu ca - Máy nén"
                          />
                          <Textarea
                            label="Mô tả"
                            value={createDesc}
                            onChange={(e) => setCreateDesc(e.target.value)}
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button onClick={createTemplate}>Lưu mẫu mới</Button>
                            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                              Hủy
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {detailLoading && (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            )}

            {detail && !detailLoading && (
              <div className="space-y-5">
                <div className="flex items-start gap-2">
                  <Pencil size={16} className="mt-1 shrink-0 text-slate-500" />
                  <div className="flex-1 space-y-3">
                    <Input
                      label="Tên mẫu"
                      value={detail.templateName}
                      onChange={(e) =>
                        setDetail({
                          ...detail,
                          templateName: e.target.value,
                        })
                      }
                      disabled={!canUpdate}
                    />
                    <Textarea
                      label="Mô tả"
                      value={detail.description ?? ''}
                      onChange={(e) =>
                        setDetail({
                          ...detail,
                          description: e.target.value,
                        })
                      }
                      rows={2}
                      disabled={!canUpdate}
                    />
                    {canUpdate && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={savingMeta}
                          onClick={saveMeta}
                        >
                          <Save size={14} /> Lưu tên và mô tả
                        </Button>
                        {canDelete && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={removeTemplate}
                          >
                            <Trash2 size={14} /> Xóa template
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-800">
                    Câu hỏi checklist
                  </h4>
                  <div className="max-h-[32rem] space-y-2 overflow-y-auto rounded-xl border border-slate-100">
                    {(detail.items || []).length === 0 && (
                      <p className="p-4 text-sm text-slate-400">
                        Mẫu này chưa có câu hỏi.
                      </p>
                    )}

                    {(detail.items || []).map((item) => (
                      <div
                        key={item.itemId}
                        className="space-y-3 border-b border-slate-50 p-3 last:border-0"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            className="flex-1"
                            value={item.questionText}
                            onChange={(e) =>
                              setDetail({
                                ...detail,
                                items: detail.items.map((row) =>
                                  row.itemId === item.itemId
                                    ? {
                                        ...row,
                                        questionText: e.target.value,
                                      }
                                    : row,
                                ),
                              })
                            }
                            onBlur={() => {
                              const current = detail.items.find(
                                (row) => row.itemId === item.itemId,
                              );
                              if (current?.questionText?.trim()) {
                                updateItemField(item, {
                                  questionText: current.questionText.trim(),
                                });
                              }
                            }}
                            disabled={!canUpdate}
                          />

                          <div className="flex items-center gap-2">
                            <Select
                              value={item.inputType}
                              onChange={(e) =>
                                updateItemField(item, {
                                  inputType: e.target.value,
                                })
                              }
                              disabled={!canUpdate}
                              className="min-w-[160px]"
                            >
                              {INPUT_TYPES.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </Select>

                            {canDelete && (
                              <button
                                type="button"
                                className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50"
                                aria-label="Xóa câu hỏi"
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
                              label="Khoảng cho phép - Min"
                              type="number"
                              className="w-28"
                              value={item.rangeMin ?? ''}
                              onChange={(e) =>
                                setDetail({
                                  ...detail,
                                  items: detail.items.map((row) =>
                                    row.itemId === item.itemId
                                      ? { ...row, rangeMin: e.target.value }
                                      : row,
                                  ),
                                })
                              }
                              onBlur={() => {
                                const current = detail.items.find(
                                  (row) => row.itemId === item.itemId,
                                );
                                const raw = current?.rangeMin;
                                const value =
                                  raw === '' || raw == null ? null : Number(raw);
                                updateItemField(item, {
                                  rangeMin:
                                    value != null && Number.isNaN(value)
                                      ? null
                                      : value,
                                });
                              }}
                              disabled={!canUpdate}
                            />
                            <Input
                              label="Khoảng cho phép - Max"
                              type="number"
                              className="w-28"
                              value={item.rangeMax ?? ''}
                              onChange={(e) =>
                                setDetail({
                                  ...detail,
                                  items: detail.items.map((row) =>
                                    row.itemId === item.itemId
                                      ? { ...row, rangeMax: e.target.value }
                                      : row,
                                  ),
                                })
                              }
                              onBlur={() => {
                                const current = detail.items.find(
                                  (row) => row.itemId === item.itemId,
                                );
                                const raw = current?.rangeMax;
                                const value =
                                  raw === '' || raw == null ? null : Number(raw);
                                updateItemField(item, {
                                  rangeMax:
                                    value != null && Number.isNaN(value)
                                      ? null
                                      : value,
                                });
                              }}
                              disabled={!canUpdate}
                            />
                          </div>
                        )}

                        {item.inputType === 'PassFail' && (
                          <Select
                            label="Gợi ý đánh giá tổng thể khi chọn Không đạt"
                            value={item.passFailFailSuggest ?? ''}
                            onChange={(e) =>
                              updateItemField(item, {
                                passFailFailSuggest: e.target.value || null,
                              })
                            }
                            disabled={!canUpdate}
                            className="max-w-xs"
                          >
                            {SUGGEST_OPTS.map((opt) => (
                              <option
                                key={opt.value || 'none'}
                                value={opt.value}
                              >
                                {opt.label}
                              </option>
                            ))}
                          </Select>
                        )}

                        {(item.inputType === 'Numeric' ||
                          item.inputType === 'Range') && (
                          <div className="space-y-2 rounded-lg border border-sky-100 bg-sky-50/50 p-3">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-sky-800">
                              <Sliders size={14} /> Ngưỡng an toàn
                            </p>
                            <div className="flex flex-wrap items-end gap-2">
                              <Input
                                label="Min an toàn"
                                type="number"
                                className="w-28"
                                value={item.safeNumericMin ?? ''}
                                onChange={(e) =>
                                  setDetail({
                                    ...detail,
                                    items: detail.items.map((row) =>
                                      row.itemId === item.itemId
                                        ? {
                                            ...row,
                                            safeNumericMin: e.target.value,
                                          }
                                        : row,
                                    ),
                                  })
                                }
                                onBlur={() => {
                                  const current = detail.items.find(
                                    (row) => row.itemId === item.itemId,
                                  );
                                  const raw = current?.safeNumericMin;
                                  const value =
                                    raw === '' || raw == null
                                      ? null
                                      : Number(raw);
                                  updateItemField(item, {
                                    safeNumericMin:
                                      value != null && Number.isNaN(value)
                                        ? null
                                        : value,
                                  });
                                }}
                                disabled={!canUpdate}
                              />
                              <Input
                                label="Max an toàn"
                                type="number"
                                className="w-28"
                                value={item.safeNumericMax ?? ''}
                                onChange={(e) =>
                                  setDetail({
                                    ...detail,
                                    items: detail.items.map((row) =>
                                      row.itemId === item.itemId
                                        ? {
                                            ...row,
                                            safeNumericMax: e.target.value,
                                          }
                                        : row,
                                    ),
                                  })
                                }
                                onBlur={() => {
                                  const current = detail.items.find(
                                    (row) => row.itemId === item.itemId,
                                  );
                                  const raw = current?.safeNumericMax;
                                  const value =
                                    raw === '' || raw == null
                                      ? null
                                      : Number(raw);
                                  updateItemField(item, {
                                    safeNumericMax:
                                      value != null && Number.isNaN(value)
                                        ? null
                                        : value,
                                  });
                                }}
                                disabled={!canUpdate}
                              />
                              <Select
                                label="Gợi ý khi ngoài ngưỡng"
                                value={item.outOfRangeSuggest ?? ''}
                                onChange={(e) =>
                                  updateItemField(item, {
                                    outOfRangeSuggest: e.target.value || null,
                                  })
                                }
                                disabled={!canUpdate}
                                className="min-w-[220px]"
                              >
                                {SUGGEST_OPTS.map((opt) => (
                                  <option
                                    key={opt.value || 'none'}
                                    value={opt.value}
                                  >
                                    {opt.label}
                                  </option>
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
                  <div className="space-y-3 rounded-xl border border-dashed border-sky-200 bg-sky-50/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-900">
                      Thêm câu hỏi
                    </p>
                    <Input
                      placeholder="Nội dung câu hỏi *"
                      value={newQuestion}
                      onChange={(e) => setNewQuestion(e.target.value)}
                    />
                    <div className="flex flex-wrap items-end gap-2">
                      <Select
                        label="Kiểu nhập"
                        value={newInputType}
                        onChange={(e) => setNewInputType(e.target.value)}
                      >
                        {INPUT_TYPES.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>

                      {newInputType === 'Range' && (
                        <>
                          <Input
                            label="Min khoảng"
                            type="number"
                            className="w-24"
                            value={newRangeMin}
                            onChange={(e) => setNewRangeMin(e.target.value)}
                          />
                          <Input
                            label="Max khoảng"
                            type="number"
                            className="w-24"
                            value={newRangeMax}
                            onChange={(e) => setNewRangeMax(e.target.value)}
                          />
                        </>
                      )}

                      {newInputType === 'PassFail' && (
                        <Select
                          label="Gợi ý khi không đạt"
                          value={newPassFailSuggest}
                          onChange={(e) =>
                            setNewPassFailSuggest(e.target.value)
                          }
                        >
                          {SUGGEST_OPTS.map((opt) => (
                            <option
                              key={opt.value || 'none'}
                              value={opt.value}
                            >
                              {opt.label}
                            </option>
                          ))}
                        </Select>
                      )}

                      {(newInputType === 'Numeric' ||
                        newInputType === 'Range') && (
                        <>
                          <Input
                            label="Min an toàn"
                            type="number"
                            className="w-24"
                            value={newSafeMin}
                            onChange={(e) => setNewSafeMin(e.target.value)}
                          />
                          <Input
                            label="Max an toàn"
                            type="number"
                            className="w-24"
                            value={newSafeMax}
                            onChange={(e) => setNewSafeMax(e.target.value)}
                          />
                          <Select
                            label="Gợi ý ngoài ngưỡng"
                            value={newOutSuggest}
                            onChange={(e) => setNewOutSuggest(e.target.value)}
                          >
                            {SUGGEST_OPTS.map((opt) => (
                              <option
                                key={opt.value || 'none'}
                                value={opt.value}
                              >
                                {opt.label}
                              </option>
                            ))}
                          </Select>
                        </>
                      )}

                      <Button
                        loading={adding}
                        onClick={addItem}
                        className="mt-5"
                      >
                        <Plus size={16} /> Thêm
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
