/**
 * ChecklistReviewPage.jsx — Duyệt checklist chờ (APPROVE/REJECT); hiển thị ngưỡng mẫu để đối chiếu.
 * Nghiệm thu: ghi chú hiện trường, giờ chạy, ảnh minh chứng, từng câu checklist (vật tư ghi trên phiếu việc, không trên checklist).
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import {
  ClipboardCheck, CheckCircle, XCircle, Loader2, Building2, MapPin, User, Clock,
  SlidersHorizontal, ImageIcon, Package,
} from 'lucide-react';
import { checklistApi } from '../../api/checklist.api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { canAccess, canDo } from '../../utils/rbac.js';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Textarea } from '../../components/ui/Input.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { CHECKLIST_STATUS_COLOR, fDateTime } from '../../utils/format.js';
import { APPROVAL_STATUS_COLOR } from '../../utils/format.js';
import {
  getReviewRowCompare, formatAnswerLabel, formatSafeBand, formatInputRangeBand,
} from '../../utils/checklistReviewCompare.js';
import { checklistStoredPhotoUrl } from '../../utils/checklistPhotoUrl.js';
import toast from 'react-hot-toast';

const INPUT_TYPE_SHORT = {
  PassFail: 'Đạt / Không đạt',
  Numeric: 'Số',
  Text: 'Ghi chú',
  Photo: 'Ảnh',
  Range: 'Khoảng',
  Selection: 'Chọn',
};

function rowShellClass(tone) {
  if (tone === 'bad') return 'border-l-4 border-l-red-500 bg-red-50/40';
  if (tone === 'good') return 'border-l-4 border-l-emerald-500 bg-emerald-50/30';
  if (tone === 'warn') return 'border-l-4 border-l-amber-500 bg-amber-50/35';
  return 'border-l-4 border-l-slate-200 bg-white';
}

export function ChecklistReviewPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const focusChecklistId = searchParams.get("checklistId")?.trim() || "";
  const canReview = canDo(user, 'CHECKLIST_RESULT:APPROVE');
  const canOpenAsset = canAccess(user, 'assets');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [supervisorNotes, setSupervisorNotes] = useState('');
  const [acting, setActing] = useState(false);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await checklistApi.getPendingReview({ limit: 80 });
      setList(res.data.data ?? []);
    } catch {
      toast.error('Không tải được hàng chờ checklist');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  const openDetail = useCallback(async (row) => {
    setSelected(row);
    setSupervisorNotes('');
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await checklistApi.getResultById(row.checklistId);
      setDetail(res.data.data);
    } catch {
      toast.error('Không tải chi tiết checklist');
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!focusChecklistId || loading || list.length === 0 || selected) return;
    const focusIdNum = Number(focusChecklistId);
    if (!Number.isFinite(focusIdNum) || focusIdNum <= 0) return;
    const row = list.find((x) => Number(x.checklistId) === focusIdNum);
    if (row) openDetail(row);
  }, [focusChecklistId, loading, list, selected, openDetail]);

  const submitReview = async (decision) => {
    if (!selected) return;
    setActing(true);
    try {
      const res = await checklistApi.reviewResult(selected.checklistId, {
        decision,
        supervisorNotes: supervisorNotes.trim() || undefined,
      });
      const d = res.data.data;
      toast.success(
        decision === 'APPROVE'
          ? (d.newWorkOrderId
            ? `Đã duyệt · WO #${String(d.newWorkOrderId).padStart(4, '0')}`
            : 'Đã duyệt.')
          : 'Đã từ chối.',
      );
      setSelected(null);
      setDetail(null);
      await loadPending();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Thao tác thất bại');
    } finally {
      setActing(false);
    }
  };

  const photoHref = detail?.evidencePhoto ? checklistStoredPhotoUrl(detail.evidencePhoto) : null;

  const detailRows = useMemo(() => {
    if (!detail?.details?.length) return [];
    return detail.details.map((d) => {
      const cmp = getReviewRowCompare(d);
      return { d, cmp };
    });
  }, [detail]);

  if (!canReview) {
    return <Navigate to="/checklists" replace />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-10">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <ClipboardCheck className="text-indigo-600 shrink-0" size={26} aria-hidden />
        <h1 className="text-xl font-bold text-slate-900">Tiếp nhận checklist</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-4 space-y-3">
          <Card title={null} className="shadow-md border-slate-200/90" noPad>
            <div className="px-5 py-4 border-b border-gray-100 bg-slate-50/80 rounded-t-xl">
              <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Package size={17} className="text-indigo-600" />
                Hàng chờ
                <Badge color="yellow" className="ml-auto">{list.length}</Badge>
              </h2>
            </div>
            <div className="p-3">
              {loading ? (
                <div className="flex justify-center py-14 text-slate-400">
                  <Loader2 className="animate-spin" size={28} />
                </div>
              ) : list.length === 0 ? (
                <p className="text-sm text-slate-500 py-10 text-center px-2">
                  Không có checklist chờ xử lý.
                </p>
              ) : (
                <ul className="space-y-1.5 max-h-[min(70vh,520px)] overflow-y-auto pr-1">
                  {list.map((row) => {
                    const active = selected?.checklistId === row.checklistId;
                    return (
                      <li key={row.checklistId}>
                        <button
                          type="button"
                          onClick={() => openDetail(row)}
                          className={`w-full text-left rounded-xl border transition-all px-3 py-3 flex flex-col gap-1.5
                            ${active
                              ? 'border-indigo-400 bg-indigo-50 shadow-sm ring-1 ring-indigo-200'
                              : 'border-transparent hover:bg-slate-50 hover:border-slate-200'}`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge color={CHECKLIST_STATUS_COLOR[row.overallStatus]}>{row.overallStatus}</Badge>
                            <Badge color={APPROVAL_STATUS_COLOR.PENDING}>Chờ</Badge>
                          </div>
                          <p className="font-semibold text-gray-900 text-sm leading-snug">{row.assetName}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} /> {fDateTime(row.checkTime)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <User size={12} /> {row.checkerName}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        </aside>

        <main className="lg:col-span-8 space-y-4">
          {!selected && (
            <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
              <div className="text-center py-14 px-4 text-slate-500 text-sm">
                <SlidersHorizontal className="mx-auto text-slate-300 mb-2" size={32} aria-hidden />
                Chọn phiếu bên trái
              </div>
            </Card>
          )}

          {selected && (
            <Card className="shadow-md border-slate-200/90 overflow-hidden" noPad>
              <div className="px-5 py-4 sm:px-6 border-b border-gray-100 bg-gradient-to-r from-white to-slate-50/90">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">#{selected.checklistId}</p>
                    <h2 className="text-xl font-bold text-gray-900 mt-0.5">{detail?.assetName ?? selected.assetName}</h2>
                    {detail && (
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        {detail.assetTypeName && (
                          <span className="inline-flex items-center gap-1">
                            <Building2 size={13} className="text-slate-400" /> {detail.assetTypeName}
                          </span>
                        )}
                        {detail.locationName && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={13} className="text-slate-400" /> {detail.locationName}
                          </span>
                        )}
                      </div>
                    )}
                    {detail?.checklistTemplateName && (
                      <p className="text-xs text-slate-600 mt-1">{detail.checklistTemplateName}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {detail && (
                      <Badge color={CHECKLIST_STATUS_COLOR[detail.overallStatus]} className="text-xs px-2.5 py-1">
                        {detail.overallStatus}
                      </Badge>
                    )}
                    {canOpenAsset && detail && (
                      <Link
                        to={`/assets/${detail.assetId}`}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline-offset-2 hover:underline"
                      >
                        Tài sản
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-5">
                {detailLoading && (
                  <p className="text-sm text-slate-500 py-8 flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={18} /> Đang tải chi tiết…
                  </p>
                )}

                {!detailLoading && detail && (
                  <>
                    <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/40 px-4 py-3">
                      <p className="text-sm font-bold text-indigo-950 mb-2">
                        Hồ sơ nghiệm thu — tóm tắt từ hiện trường
                      </p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        {detail.readingValue != null && (
                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
                            <span className="text-slate-500 text-xs">Chỉ số đồng hồ (nộp)</span>
                            <p className="font-bold text-slate-900 tabular-nums">{detail.readingValue}</p>
                          </div>
                        )}
                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
                          <span className="text-slate-500 text-xs">Nộp lúc</span>
                          <p className="font-semibold text-slate-900">{fDateTime(detail.checkTime)}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
                          <span className="text-slate-500 text-xs">Người nộp</span>
                          <p className="font-semibold text-slate-900">{detail.checkerName}</p>
                        </div>
                      </div>
                    </div>

                    {detail.notes && (
                      <div className="rounded-xl border border-blue-200 bg-blue-50/85 px-4 py-3 text-sm text-slate-900">
                        <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">Ghi chú hiện trường</span>
                        <p className="mt-1 whitespace-pre-wrap leading-relaxed">{detail.notes}</p>
                      </div>
                    )}

                    {photoHref && (
                      <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                        <p className="text-xs text-slate-600 px-4 py-2 border-b border-slate-200 flex items-center gap-2 bg-white">
                          <ImageIcon size={14} aria-hidden /> Ảnh minh chứng hiện trường
                        </p>
                        <a href={photoHref} target="_blank" rel="noopener noreferrer" className="block p-3">
                          <img
                            src={photoHref}
                            alt=""
                            className="max-h-64 w-auto mx-auto rounded-lg border border-slate-200 shadow-sm object-contain"
                          />
                        </a>
                      </div>
                    )}

                    {detailRows.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
                          <SlidersHorizontal size={16} className="text-indigo-600 shrink-0" aria-hidden />
                          Chi tiết câu
                        </h3>
                        <div className="space-y-3">
                          {detailRows.map(({ d, cmp }) => {
                            const typeLabel = INPUT_TYPE_SHORT[d.inputType] ?? d.inputType;
                            const ans = formatAnswerLabel(d.inputType, d.answerValue, d.isOK);
                            const safe = d.threshold ? formatSafeBand(d.threshold) : null;
                            const range = d.threshold ? formatInputRangeBand(d.threshold) : null;
                            return (
                              <div
                                key={d.detailId}
                                className={`rounded-xl border border-slate-200/90 shadow-sm overflow-hidden ${rowShellClass(cmp.tone)}`}
                              >
                                <div className="grid sm:grid-cols-2 gap-0 sm:divide-x divide-slate-200/80">
                                  <div className="p-4 space-y-2 bg-white/60">
                                    <p className="text-sm font-semibold text-gray-900 leading-snug">{d.questionText}</p>
                                    <Badge color="gray" className="text-[10px]">{typeLabel}</Badge>
                                    <div className="text-xs text-slate-600 space-y-1 pt-1 border-t border-slate-100 mt-2">
                                      {d.threshold ? (
                                        <>
                                          {safe && (
                                            <p className="text-slate-600">
                                              <span className="text-slate-500">Ngưỡng </span>
                                              <span className="font-mono text-indigo-900 bg-indigo-50 px-1 rounded">{safe}</span>
                                            </p>
                                          )}
                                          {range && (
                                            <p className="text-slate-600">
                                              <span className="text-slate-500">Khoảng </span>
                                              <span className="font-mono">{range}</span>
                                            </p>
                                          )}
                                          {d.inputType === 'PassFail' && (
                                            d.threshold.passFailFailSuggest ? (
                                              <p className="text-slate-600 flex flex-wrap items-center gap-1">
                                                <span className="text-slate-500">Không đạt →</span>
                                                <Badge color={d.threshold.passFailFailSuggest === 'NG' ? 'red' : 'yellow'}>
                                                  {d.threshold.passFailFailSuggest}
                                                </Badge>
                                              </p>
                                            ) : (
                                              <p className="text-slate-400 text-xs">Chưa gợi ý</p>
                                            )
                                          )}
                                          {(d.inputType === 'Numeric' || d.inputType === 'Range') && d.threshold.outOfRangeSuggest && (
                                            <p className="text-slate-600 flex flex-wrap items-center gap-1">
                                              <span className="text-slate-500">Ngoài ngưỡng →</span>
                                              <Badge color={d.threshold.outOfRangeSuggest === 'NG' ? 'red' : 'yellow'}>
                                                {d.threshold.outOfRangeSuggest}
                                              </Badge>
                                            </p>
                                          )}
                                          {!safe && !range && d.inputType !== 'PassFail' && (
                                            <p className="text-slate-400 text-xs">Chưa cấu ngưỡng</p>
                                          )}
                                        </>
                                      ) : (
                                        <p className="text-slate-400 text-xs">Không khớp mẫu</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="p-4 flex flex-col justify-center bg-white/40">
                                    <p className="text-xs text-slate-500 mb-1">Trả lời</p>
                                    {d.inputType === 'Photo' && d.answerValue ? (
                                      <a
                                        href={checklistStoredPhotoUrl(d.answerValue) ?? '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block rounded-lg border border-slate-200 overflow-hidden bg-white max-w-md"
                                      >
                                        <img
                                          src={checklistStoredPhotoUrl(d.answerValue) ?? ''}
                                          alt=""
                                          className="max-h-56 w-full object-contain"
                                        />
                                      </a>
                                    ) : (
                                    <p className={`text-lg font-bold tabular-nums ${cmp.tone === 'bad' ? 'text-red-700' : cmp.tone === 'good' ? 'text-emerald-800' : 'text-slate-800'}`}>
                                      {ans}
                                    </p>
                                    )}
                                    <p className={`text-xs mt-1 ${d.isOK ? 'text-emerald-700' : 'text-red-700'}`}>
                                      {d.isOK ? 'OK' : 'Không OK'}
                                    </p>
                                    {cmp.lines.length > 0 && (
                                      <ul className="mt-3 text-xs text-slate-600 space-y-1 list-disc list-inside">
                                        {cmp.lines.map((line, i) => (
                                          <li key={i}>{line}</li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <Textarea
                      label="Ghi chú duyệt (tuỳ chọn)"
                      placeholder="Tuỳ chọn"
                      value={supervisorNotes}
                      onChange={(e) => setSupervisorNotes(e.target.value)}
                      rows={3}
                    />

                    <div className="flex flex-wrap gap-3 pt-1">
                      <Button
                        variant="success"
                        loading={acting}
                        onClick={() => submitReview('APPROVE')}
                        className="min-w-[200px] justify-center"
                      >
                        <CheckCircle size={17} /> Phê duyệt
                      </Button>
                      <Button variant="danger" loading={acting} onClick={() => submitReview('REJECT')} className="justify-center">
                        <XCircle size={17} /> Từ chối
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => { setSelected(null); setDetail(null); }}
                        disabled={acting}
                      >
                        Đóng
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
