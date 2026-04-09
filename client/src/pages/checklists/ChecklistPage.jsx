/**
 * ChecklistPage.jsx — QR: mọi user đăng nhập xem thông tin tài sản + SOP + lịch sử.
 * Nộp checklist: chỉ Công nhân + Trưởng phòng (CHECKLIST_RESULT:CREATE).
 * Đồng hồ chạy: hiển thị rõ LastReadingValue từ API; nhập mới phải ≥ giá trị đó (client + server submitResult).
 * Gợi ý đánh giá tổng thể (WARNING/NG) theo ngưỡng mẫu: Numeric/Range ngoài min-max; PassFail «Không đạt».
 * BFD mục 3: sau khi gửi → TC/TP tiếp nhận tại /checklists/review.
 */
import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  QrCode,
  FileText,
  CheckSquare,
  AlertTriangle,
  XCircle,
  CheckCircle,
  ExternalLink,
  Tag,
  Cpu,
  MapPin,
  Hash,
  Calendar,
  Building2,
  ClipboardList,
  Wrench,
  Lightbulb,
  Gauge,
} from "lucide-react";
import { checklistApi } from "../../api/checklist.api.js";
import { assetApi } from "../../api/asset.api.js";
import { Button } from "../../components/ui/Button.jsx";
import { Input, Textarea, Select } from "../../components/ui/Input.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import {
  CHECKLIST_STATUS_COLOR,
  APPROVAL_STATUS_COLOR,
  ASSET_STATUS_LABEL,
  WO_SOURCE_LABEL,
  fDate,
  fDateTime,
  fNumber,
} from "../../utils/format.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { canAccess, canDo } from "../../utils/rbac.js";
import { deriveChecklistOverallSuggestion } from "../../utils/checklistSuggest.js";
import toast from "react-hot-toast";

const INPUT_TYPE_LABEL = {
  PassFail: "Đạt / Không đạt",
  Numeric: "Nhập số",
  Text: "Ghi chú",
  Photo: "Ảnh bằng chứng",
  Range: "Giá trị trong khoảng",
  Selection: "Lựa chọn",
};

export function ChecklistPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const canSubmitChecklist = canDo(user, "CHECKLIST_RESULT:CREATE");
  const canOpenAssetPage = canAccess(user, "assets");
  const [assetInput, setAssetInput] = useState("");
  const [qrData, setQrData] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState("device");
  const [maintHistory, setMaintHistory] = useState(null);
  const [maintLoading, setMaintLoading] = useState(false);
  const [overallStatus, setOverallStatus] = useState("OK");
  const [notes, setNotes] = useState("");
  const [partsNotes, setPartsNotes] = useState("");
  const [readingValue, setReadingValue] = useState("");
  const [readingInputError, setReadingInputError] = useState("");
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [evidencePhoto, setEvidencePhoto] = useState(null);
  const [activeTagFilter, setActiveTagFilter] = useState("ALL");

  useEffect(() => {
    const aid = searchParams.get("assetId")?.trim();
    if (aid) setAssetInput(aid);
  }, [searchParams]);

  const assetIdForMaint = qrData?.asset?.assetId;

  useEffect(() => {
    if (activeTab !== "maint" || !assetIdForMaint) return;
    let cancelled = false;
    (async () => {
      setMaintLoading(true);
      try {
        const res = await assetApi.getMaintenanceHistory(assetIdForMaint, {
          limit: 50,
        });
        if (!cancelled) setMaintHistory(res.data.data ?? []);
      } catch {
        if (!cancelled) setMaintHistory([]);
      } finally {
        if (!cancelled) setMaintLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, assetIdForMaint]);

  // Tập hợp tất cả tags từ documents để hiển thị bộ lọc
  const allDocTags = useMemo(() => {
    if (!qrData?.documents?.length) return [];
    const map = new Map();
    qrData.documents.forEach((doc) =>
      doc.tags?.forEach((t) => map.set(t.tagId, t.tagName)),
    );
    return [...map.entries()].map(([tagId, tagName]) => ({ tagId, tagName }));
  }, [qrData]);

  const filteredDocs = useMemo(() => {
    if (!qrData?.documents) return [];
    if (activeTagFilter === "ALL") return qrData.documents;
    return qrData.documents.filter((doc) =>
      doc.tags?.some((t) => String(t.tagId) === String(activeTagFilter)),
    );
  }, [qrData, activeTagFilter]);

  const overallSuggestion = useMemo(
    () =>
      deriveChecklistOverallSuggestion(
        qrData?.checklistTemplate?.items,
        answers,
      ),
    [qrData, answers],
  );

  /** Ngưỡng tối thiểu chỉ số đồng hồ (đồng bộ AssetCounters.LastReadingValue) */
  const runtimeMinReading = useMemo(() => {
    const v = qrData?.runtimeCounter?.lastReadingValue;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }, [qrData?.runtimeCounter?.lastReadingValue]);

  const handleScan = async () => {
    if (!assetInput.trim()) return;
    setScanning(true);
    setQrData(null);
    setSubmitted(null);
    setAnswers({});
    setReadingValue("");
    setReadingInputError("");
    setPartsNotes("");
    try {
      const res = await checklistApi.getQRInfo(assetInput.trim());
      setQrData(res.data.data);
      setActiveTab("device");
      setMaintHistory(null);
      toast.success(`Đã tải thông tin: ${res.data.data.asset.assetName}`);
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Không tìm thấy tài sản");
    } finally {
      setScanning(false);
    }
  };

  const setAnswer = (questionId, value) =>
    setAnswers((p) => ({ ...p, [questionId]: value }));

  const handleSubmit = async () => {
    if (!qrData) return;
    const rawRv = readingValue.trim();
    if (rawRv !== "") {
      const n = Number(rawRv.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Giá trị đồng hồ không hợp lệ");
        setReadingInputError("Nhập số ≥ 0");
        return;
      }
      if (n < runtimeMinReading) {
        toast.error(
          `Giá trị đồng hồ phải ≥ ${runtimeMinReading} giờ (đã lưu lần trước trong hệ thống).`,
        );
        setReadingInputError(
          `Phải nhập ≥ ${fNumber(runtimeMinReading)} giờ (chỉ số đã lưu).`,
        );
        return;
      }
    }
    setReadingInputError("");
    setSubmitting(true);
    try {
      const details = Object.entries(answers).map(([questionId, value]) => ({
        questionId: Number(questionId),
        answerValue: String(value),
        isOk: value !== "false" && value !== "0" && value !== "NG",
      }));

      // Nếu có ảnh minh chứng → dùng FormData (multipart)
      let res;
      if (evidencePhoto) {
        const fd = new FormData();
        fd.append("photo", evidencePhoto);
        fd.append("assetId", qrData.asset.assetId);
        fd.append("overallStatus", overallStatus);
        fd.append("notes", notes);
        if (readingValue) fd.append("readingValue", readingValue);
        if (partsNotes.trim()) fd.append("partsNotes", partsNotes.trim());
        fd.append("details", JSON.stringify(details));
        res = await checklistApi.submitWithPhoto(fd);
      } else {
        res = await checklistApi.submit({
          assetId: qrData.asset.assetId,
          overallStatus,
          notes,
          ...(partsNotes.trim() && { partsNotes: partsNotes.trim() }),
          ...(readingValue && { readingValue: Number(readingValue) }),
          details,
        });
      }

      setSubmitted(res.data.data);
      toast.success("Đã gửi — chờ Trưởng ca / Trưởng phòng xác nhận.");
      setReadingValue("");
      setNotes("");
      setPartsNotes("");
      setAnswers({});
      setEvidencePhoto(null);
      setOverallStatus("OK");
      try {
        const refresh = await checklistApi.getQRInfo(
          String(qrData.asset.assetId),
        );
        setQrData(refresh.data.data);
      } catch {
        /* giữ qrData cũ */
      }
      setActiveTab("histChecklist");
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi gửi checklist");
    } finally {
      setSubmitting(false);
    }
  };

  const OVERALL_OPTIONS = [
    {
      value: "OK",
      label: "OK — Máy chạy tốt",
      icon: CheckCircle,
      color: "green",
    },
    {
      value: "WARNING",
      label: "Cảnh báo — Có dấu hiệu lạ",
      icon: AlertTriangle,
      color: "yellow",
    },
    {
      value: "NG",
      label: "NG — Máy ngừng / hỏng",
      icon: XCircle,
      color: "red",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-950">
        <p className="font-bold text-indigo-900 mb-1">
          Quét QR — xem đúng thiết bị
        </p>
        <p className="leading-relaxed text-indigo-900/90">
          <strong>Mọi người</strong> có thể nhập mã / quét QR để xem{" "}
          <strong>thông tin tài sản</strong>, tài liệu SOP và lịch sử. Chỉ{" "}
          <strong>công nhân</strong> và <strong>trưởng phòng</strong> mới{" "}
          <strong>gửi checklist</strong> kiểm tra từ đây. Sau khi gửi,{" "}
          <strong>trưởng ca hoặc trưởng phòng</strong> xử lý tại &quot;Tiếp nhận
          checklist&quot; rồi hệ thống mới cập nhật trạng thái / phiếu việc.
        </p>
      </div>

      {/* QR Input */}
      <Card title="Quét mã QR tài sản">
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              placeholder="Nhập mã tài sản (AssetID) hoặc quét QR..."
              value={assetInput}
              onChange={(e) => setAssetInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
            />
          </div>
          <Button onClick={handleScan} loading={scanning}>
            <QrCode size={15} /> Tải thông tin
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Nhập ID tài sản từ mã QR hoặc nhập trực tiếp để mô phỏng quét QR trên
          hiện trường.
        </p>
      </Card>

      {/* Kết quả submit */}
      {submitted && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
          <CheckCircle
            size={20}
            className="text-amber-600 flex-shrink-0 mt-0.5"
          />
          <div>
            <p className="font-semibold text-amber-900">
              Đã gửi kết quả kiểm tra
            </p>
            <p className="text-sm text-amber-800 mt-1">
              {submitted.message ??
                "Trưởng ca / Trưởng phòng sẽ xác nhận OK / theo dõi / NG. Sau khi phê duyệt, hệ thống mới đổi trạng thái tài sản và tạo phiếu việc (nếu có)."}
            </p>
            {submitted.checklistId != null && (
              <p className="text-xs text-amber-700 mt-2">
                Mã phiếu checklist: #{submitted.checklistId}
              </p>
            )}
            <button
              type="button"
              className="text-sm text-amber-800 underline mt-2"
              onClick={() => setSubmitted(null)}
            >
              Kiểm tra tài sản khác
            </button>
          </div>
        </div>
      )}

      {qrData &&
        (() => {
          const asset = qrData.asset;
          const typeName = asset.typeName || asset.assetTypeName;
          const statusLabel = ASSET_STATUS_LABEL[asset.status] ?? asset.status;
          const tabDefs = [
            { key: "device", label: "Thiết bị", icon: Cpu },
            { key: "checklist", label: "Checklist", icon: CheckSquare },
            {
              key: "docs",
              label: `SOP (${qrData.documents?.length ?? 0})`,
              icon: FileText,
            },
            {
              key: "histChecklist",
              label: "Lịch sử checklist",
              icon: ClipboardList,
            },
            { key: "maint", label: "Lịch sử bảo trì", icon: Wrench },
          ];
          return (
            <>
              <div className="flex flex-wrap items-center gap-3 justify-between bg-slate-900 text-white rounded-xl px-4 py-3 shadow-md">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-white/10 rounded-lg shrink-0">
                    <QrCode size={22} className="text-sky-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate text-base">
                      {asset.assetName}
                    </p>
                    <p className="text-xs text-slate-300 truncate">
                      Mã tài sản{" "}
                      <span className="font-mono text-white">
                        #{asset.assetId}
                      </span>
                      {typeName ? ` · ${typeName}` : ""}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full bg-white/15 text-white border border-white/20">
                  {statusLabel}
                </span>
              </div>

              <div className="flex flex-wrap border-b border-gray-200 bg-white rounded-t-xl overflow-x-auto -mb-[1px] gap-0">
                {tabDefs.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                  ${
                    activeTab === key
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                  >
                    <Icon size={15} /> {label}
                  </button>
                ))}
              </div>

              {activeTab === "device" && (
                <Card title="Thông tin thiết bị">
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                      <Hash
                        size={18}
                        className="text-gray-400 shrink-0 mt-0.5"
                      />
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Mã hệ thống
                        </p>
                        <p className="font-mono font-semibold text-gray-900 mt-0.5">
                          #{asset.assetId}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                      <Building2
                        size={18}
                        className="text-gray-400 shrink-0 mt-0.5"
                      />
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Loại
                        </p>
                        <p className="font-medium text-gray-900 mt-0.5">
                          {typeName ?? "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                      <MapPin
                        size={18}
                        className="text-gray-400 shrink-0 mt-0.5"
                      />
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Vị trí
                        </p>
                        <p className="font-medium text-gray-900 mt-0.5">
                          {asset.locationName ?? "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                      <Calendar
                        size={18}
                        className="text-gray-400 shrink-0 mt-0.5"
                      />
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Ngày đưa vào vận hành
                        </p>
                        <p className="font-medium text-gray-900 mt-0.5">
                          {asset.commissionDate
                            ? fDate(asset.commissionDate)
                            : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4 sm:col-span-2">
                      <Cpu
                        size={18}
                        className="text-gray-400 shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Hãng / Số seri
                        </p>
                        <p className="font-medium text-gray-900 mt-0.5">
                          {[asset.manufacturer, asset.serialNumber]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </p>
                      </div>
                    </div>
                    {(() => {
                      const rc = qrData.runtimeCounter ?? {
                        lastReadingValue: 0,
                        totalAccumulatedHours: 0,
                        lastUpdated: null,
                      };
                      return (
                        <div className="sm:col-span-2 flex gap-3 rounded-xl border-2 border-sky-300/80 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm">
                          <Gauge
                            size={22}
                            className="text-sky-600 shrink-0 mt-0.5"
                            aria-hidden
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-sky-900 uppercase tracking-wide">
                              Đồng hồ giờ chạy — chỉ số đang lưu
                            </p>
                            <p className="text-2xl font-bold text-sky-950 tabular-nums mt-1 leading-tight">
                              {fNumber(rc.lastReadingValue)}{" "}
                              <span className="text-base font-semibold">
                                giờ
                              </span>
                            </p>
                            <p className="text-xs text-sky-900/85 mt-2 leading-relaxed">
                              {rc.lastUpdated
                                ? `Cập nhật lần cuối: ${fDateTime(rc.lastUpdated)}. Khi nộp checklist, nhập chỉ số trên máy phải ≥ ${fNumber(rc.lastReadingValue)} giờ.`
                                : "Chưa có lần ghi trước — có thể nhập chỉ số ≥ 0 ở tab Checklist."}
                            </p>
                            {Number(rc.totalAccumulatedHours) > 0 ? (
                              <p className="text-xs text-sky-800/70 mt-1">
                                Tích lũy hệ thống (delta):{" "}
                                {fNumber(rc.totalAccumulatedHours)} giờ
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })()}
                    {asset.description ? (
                      <div className="sm:col-span-2 rounded-xl border border-gray-100 bg-white p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Mô tả
                        </p>
                        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                          {asset.description}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    {canOpenAssetPage && (
                      <Link
                        to={`/assets/${asset.assetId}`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        <ExternalLink size={16} /> Mở trang chi tiết tài sản
                      </Link>
                    )}
                    {!canOpenAssetPage && (
                      <p className="text-xs text-gray-500">
                        Bạn chỉ xem nhanh tại đây — không có quyền mở module Tài
                        sản.
                      </p>
                    )}
                  </div>
                </Card>
              )}

              {/* Tab: Checklist */}
              {activeTab === "checklist" && (
                <Card>
                  <div className="space-y-5">
                    {/* Đồng hồ giờ chạy */}
                    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 space-y-3">
                      <p className="text-sm font-semibold text-sky-950">
                        Chỉ số đồng hồ trên máy (tuỳ chọn)
                      </p>
                      <p className="text-xs text-sky-900/90 leading-relaxed">
                        Trong hệ thống đang lưu:{" "}
                        <strong className="tabular-nums text-sky-950">
                          {fNumber(runtimeMinReading)} giờ
                        </strong>
                        . Nếu nhập, giá trị mới{" "}
                        <strong>không được nhỏ hơn</strong> số này (đồng bộ với
                        lần ghi trước).
                      </p>
                      <Input
                        label={`Nhập chỉ số hiện tại trên màn hình máy (tối thiểu ${fNumber(runtimeMinReading)})`}
                        type="number"
                        min={runtimeMinReading}
                        step={1}
                        inputMode="numeric"
                        placeholder={`Ví dụ: ${fNumber(Math.max(runtimeMinReading, 0) + 1)} hoặc để trống`}
                        value={readingValue}
                        error={readingInputError}
                        onChange={(e) => {
                          setReadingValue(e.target.value);
                          setReadingInputError("");
                        }}
                        onBlur={() => {
                          const t = readingValue.trim();
                          if (t === "") return;
                          const n = Number(t.replace(",", "."));
                          if (!Number.isFinite(n)) {
                            setReadingInputError("Nhập số hợp lệ");
                            return;
                          }
                          if (n < runtimeMinReading) {
                            setReadingInputError(
                              `Tối thiểu ${fNumber(runtimeMinReading)} giờ`,
                            );
                          }
                        }}
                      />
                    </div>

                    {/* Danh sách câu hỏi */}
                    {qrData.checklistTemplate?.items?.length > 0 ? (
                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-800 text-sm">
                          {qrData.checklistTemplate.templateName}
                        </h4>
                        {qrData.checklistTemplate.items.map((item) => (
                          <div
                            key={item.itemId}
                            className="border border-gray-100 rounded-xl p-4"
                          >
                            <p className="text-sm font-medium text-gray-800 mb-2">
                              {item.questionText}
                            </p>
                            <p className="text-xs text-gray-400 mb-3">
                              {INPUT_TYPE_LABEL[item.inputType] ??
                                item.inputType}
                            </p>
                            {item.inputType === "PassFail" && (
                              <div className="flex gap-2">
                                {["true", "false"].map((v) => (
                                  <button
                                    key={v}
                                    onClick={() => setAnswer(item.itemId, v)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors
                                  ${
                                    answers[item.itemId] === v
                                      ? v === "true"
                                        ? "bg-green-600 text-white border-green-600"
                                        : "bg-red-500 text-white border-red-500"
                                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                                  }`}
                                  >
                                    {v === "true" ? "✓ Đạt" : "✗ Không đạt"}
                                  </button>
                                ))}
                              </div>
                            )}
                            {(item.inputType === "Numeric" ||
                              item.inputType === "Range") && (
                              <Input
                                type="number"
                                placeholder={
                                  item.rangeMin != null
                                    ? `${item.rangeMin} – ${item.rangeMax}`
                                    : "Nhập giá trị"
                                }
                                value={answers[item.itemId] ?? ""}
                                onChange={(e) =>
                                  setAnswer(item.itemId, e.target.value)
                                }
                              />
                            )}
                            {item.inputType === "Text" && (
                              <Textarea
                                placeholder="Nhập ghi chú..."
                                value={answers[item.itemId] ?? ""}
                                onChange={(e) =>
                                  setAnswer(item.itemId, e.target.value)
                                }
                                rows={2}
                              />
                            )}
                            {item.inputType === "Selection" && (
                              <Select
                                value={answers[item.itemId] ?? ""}
                                onChange={(e) =>
                                  setAnswer(item.itemId, e.target.value)
                                }
                              >
                                <option value="">— Chọn —</option>
                                {item.options?.map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </Select>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">
                        Không có câu hỏi checklist cho loại tài sản này.
                      </p>
                    )}

                    {canSubmitChecklist ? (
                      <>
                        {overallSuggestion.suggested && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 space-y-3">
                            <p className="text-sm font-semibold text-amber-950 flex items-center gap-2">
                              <Lightbulb
                                size={18}
                                className="text-amber-600 shrink-0"
                              />
                              Gợi ý đánh giá tổng thể (theo ngưỡng trên mẫu
                              checklist)
                            </p>
                            <ul className="text-xs text-amber-900/95 list-disc list-inside space-y-1">
                              {overallSuggestion.reasons.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() =>
                                setOverallStatus(overallSuggestion.suggested)
                              }
                            >
                              Áp dụng gợi ý:{" "}
                              {overallSuggestion.suggested === "NG"
                                ? "NG"
                                : "CẢNH BÁO"}
                            </Button>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-gray-800 mb-3">
                            Đánh giá tổng thể *
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {OVERALL_OPTIONS.map(
                              ({ value, label, icon: Icon, color }) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setOverallStatus(value)}
                                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-colors
                              ${
                                overallStatus === value
                                  ? color === "green"
                                    ? "border-green-500 bg-green-50 text-green-700"
                                    : color === "yellow"
                                      ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                                      : "border-red-500 bg-red-50 text-red-700"
                                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
                              }`}
                                >
                                  <Icon size={20} />
                                  <span className="text-xs text-center leading-tight">
                                    {label}
                                  </span>
                                </button>
                              ),
                            )}
                          </div>
                        </div>

                        <Textarea
                          label="Ghi chú hiện trường"
                          placeholder="Mô tả tình trạng máy, tiếng kêu, rò rỉ, việc đã làm..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={3}
                        />

                        <Textarea
                          label="Linh kiện / vật tư (đã thay, cần thay, dự kiến)"
                          placeholder="Ví dụ: đã thay seal 25mm; cần mua vòng bi SKF; lọc gió còn 20%..."
                          value={partsNotes}
                          onChange={(e) => setPartsNotes(e.target.value)}
                          rows={3}
                        />

                        <div>
                          <label className="text-sm font-semibold text-gray-700 block mb-1">
                            Ảnh minh chứng (tuỳ chọn)
                          </label>
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp"
                            onChange={(e) =>
                              setEvidencePhoto(e.target.files[0] ?? null)
                            }
                            className="w-full text-sm text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium hover:file:bg-blue-100"
                          />
                          {evidencePhoto && (
                            <p className="text-xs text-green-600 mt-1 font-medium">
                              ✓ Đã chọn: {evidencePhoto.name}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            JPG/PNG/WEBP, tối đa 10MB
                          </p>
                        </div>

                        <Button
                          className="w-full justify-center"
                          loading={submitting}
                          onClick={handleSubmit}
                        >
                          Gửi kết quả kiểm tra
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                        Tài khoản của bạn chỉ xem thiết bị / SOP / lịch sử. Soạn
                        mẫu checklist: trang{" "}
                        <strong>Mẫu checklist (theo loại)</strong>.
                        <strong> Gửi kết quả kiểm tra</strong> chỉ dành cho{" "}
                        <strong>công nhân</strong> hoặc{" "}
                        <strong>trưởng phòng</strong>.
                      </p>
                    )}
                  </div>
                </Card>
              )}

              {/* Tab: Tài liệu SOP */}
              {activeTab === "docs" && (
                <Card title="Tài liệu hướng dẫn / SOP">
                  {qrData.documents?.length === 0 ? (
                    <p className="text-sm text-gray-400 py-6 text-center">
                      Chưa có tài liệu đã duyệt cho tài sản này
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {/* Bộ lọc theo tag — BFD 1.3/3.3 */}
                      {allDocTags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setActiveTagFilter("ALL")}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors
                          ${
                            activeTagFilter === "ALL"
                              ? "bg-blue-600 text-white border-blue-600"
                              : "border-gray-300 text-gray-600 hover:border-blue-400"
                          }`}
                          >
                            <Tag size={11} /> Tất cả ({qrData.documents.length})
                          </button>
                          {allDocTags.map((t) => (
                            <button
                              key={t.tagId}
                              onClick={() =>
                                setActiveTagFilter(String(t.tagId))
                              }
                              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors
                            ${
                              activeTagFilter === String(t.tagId)
                                ? "bg-blue-600 text-white border-blue-600"
                                : "border-gray-300 text-gray-600 hover:border-blue-400"
                            }`}
                            >
                              <Tag size={11} /> {t.tagName}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Danh sách tài liệu đã lọc */}
                      {filteredDocs.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">
                          Không có tài liệu với tag này
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {filteredDocs.map((doc) => (
                            <div
                              key={doc.digitalAssetId}
                              className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
                            >
                              <FileText
                                size={18}
                                className="text-blue-500 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">
                                  {doc.fileName}
                                </p>
                                <p className="text-xs font-medium text-gray-600">
                                  {doc.fileType?.toUpperCase()} · v
                                  {doc.currentVersion}
                                </p>
                                {doc.description && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {doc.description}
                                  </p>
                                )}
                                {doc.tags?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {doc.tags.map((t) => (
                                      <span
                                        key={t.tagId}
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium"
                                      >
                                        <Tag size={9} /> {t.tagName}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <a
                                href={`${import.meta.env.VITE_API_BASE?.replace("/api", "") || "http://localhost:4000"}/uploads/documents/${doc.filePath?.split("/").pop()}`}
                                target="_blank"
                                rel="noopener noreferrer"
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

              {activeTab === "histChecklist" && (
                <Card title="Lịch sử kiểm tra checklist">
                  {qrData.recentResults?.length === 0 ? (
                    <p className="text-sm text-gray-400 py-6 text-center">
                      Chưa có phiếu checklist ghi nhận
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {qrData.recentResults.map((r) => (
                        <div
                          key={r.checklistId}
                          className="flex flex-wrap items-center gap-2 py-3 border-b border-gray-100 last:border-0"
                        >
                          <Badge
                            color={CHECKLIST_STATUS_COLOR[r.overallStatus]}
                          >
                            {r.overallStatus}
                          </Badge>
                          {r.reviewStatus && (
                            <Badge
                              color={
                                APPROVAL_STATUS_COLOR[r.reviewStatus] ?? "gray"
                              }
                            >
                              {r.reviewStatus}
                            </Badge>
                          )}
                          <div className="flex-1 min-w-[200px]">
                            <p className="text-sm font-medium text-gray-700">
                              {fDateTime(r.checkTime)}
                            </p>
                            {r.checkerName && (
                              <p className="text-xs text-gray-500">
                                Người nộp: {r.checkerName}
                              </p>
                            )}
                            {r.notes && (
                              <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">
                                <span className="text-xs font-semibold text-gray-500">
                                  Ghi chú:{" "}
                                </span>
                                {r.notes}
                              </p>
                            )}
                            {r.partsNotes && (
                              <p className="text-sm text-amber-900 mt-1 whitespace-pre-wrap rounded-lg bg-amber-50/90 border border-amber-100 px-2 py-1.5">
                                <span className="text-xs font-semibold">
                                  Vật tư / linh kiện:{" "}
                                </span>
                                {r.partsNotes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {activeTab === "maint" && (
                <Card title="Lịch sử bảo trì trên thiết bị">
                  <p className="text-xs text-gray-600 leading-relaxed mb-4 -mt-1">
                    Thông tin được <strong>lưu sẵn</strong> khi hoàn thành bảo
                    trì — <strong>không cần mở phiếu việc cũ</strong> (người làm
                    sau có thể không liên quan WO trước). Ưu tiên đọc ghi chú
                    hiện trường và vật tư bên dưới.
                  </p>
                  {maintLoading && (
                    <div className="flex justify-center py-10">
                      <Spinner />
                    </div>
                  )}
                  {!maintLoading &&
                    (!maintHistory || maintHistory.length === 0) && (
                      <p className="text-sm text-gray-400 py-6 text-center">
                        Chưa có bản ghi bảo trì hoàn thành cho thiết bị này
                      </p>
                    )}
                  {!maintLoading && maintHistory?.length > 0 && (
                    <ul className="space-y-4">
                      {maintHistory.map((row) => (
                        <li
                          key={row.historyId}
                          className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 text-sm"
                        >
                          <div className="flex flex-wrap items-center gap-2 gap-y-1">
                            <span className="text-base font-bold text-gray-900">
                              {fDate(row.completedDate)}
                            </span>
                            <Badge color="gray">
                              {WO_SOURCE_LABEL[row.woSource] ?? row.woSource}
                            </Badge>
                            {row.workOrderId != null && (
                              <span className="text-[11px] text-gray-500 font-mono">
                                Mã tham chiếu nội bộ: WO-
                                {String(row.workOrderId).padStart(4, "0")}
                              </span>
                            )}
                          </div>
                          {row.description ? (
                            <p className="mt-2 font-medium text-gray-800 leading-snug">
                              {row.description}
                            </p>
                          ) : null}
                          {row.technicianSummary ? (
                            <p className="mt-2 text-xs text-gray-700">
                              <span className="font-semibold text-gray-600">
                                Người thực hiện:{" "}
                              </span>
                              {row.technicianSummary}
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                            {row.actualHours != null && (
                              <span>
                                Giờ làm thực tế:{" "}
                                <strong className="tabular-nums">
                                  {fNumber(row.actualHours)} h
                                </strong>
                              </span>
                            )}
                            {row.totalRuntimeHours != null && (
                              <span>
                                Tổng giờ chạy máy (lúc đó):{" "}
                                <strong className="tabular-nums">
                                  {fNumber(row.totalRuntimeHours)} h
                                </strong>
                              </span>
                            )}
                            {row.photoCount != null && row.photoCount > 0 && (
                              <span>
                                Ảnh hiện trường:{" "}
                                <strong>{row.photoCount}</strong> tệp
                              </span>
                            )}
                          </div>
                          {row.fieldNotes ? (
                            <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/80 px-3 py-2 text-gray-800">
                              <p className="text-[11px] font-bold text-blue-900 uppercase tracking-wide mb-1">
                                Ghi chú hiện trường (thợ)
                              </p>
                              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                {row.fieldNotes}
                              </p>
                            </div>
                          ) : null}
                          {row.partsNotes ? (
                            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-amber-950">
                              <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wide mb-1">
                                Linh kiện / vật tư
                              </p>
                              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                {row.partsNotes}
                              </p>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}
            </>
          );
        })()}
    </div>
  );
}
