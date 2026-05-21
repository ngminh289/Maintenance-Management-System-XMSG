/**
 * ChecklistPage.jsx — QR: mọi user đăng nhập xem thông tin tài sản + SOP + lịch sử.
 * Nộp checklist: chỉ KTV hiện trường + Trưởng phòng (CHECKLIST_RESULT:CREATE).
 * Đồng hồ: chỉ số máy (LastReading) ≠ tổng delta (TotalAccumulated) ≠ mốc sau PM (LastMaintenanceTotal); nhập mới ≥ LastReading.
 * Vật tư/linh kiện không nhập trên checklist — ghi trên phiếu việc (WO) khi bảo trì.
 * Gợi ý đánh giá tổng thể (WARNING/NG) theo ngưỡng mẫu: Numeric/Range ngoài min-max; PassFail «Không đạt».
 * BFD mục 3: sau khi gửi → TC/TP tiếp nhận tại /checklists/review.
 * Câu kiểu Photo: upload multipart field `item_<itemId>` + lưu đường dẫn trong ChecklistDetails.AnswerValue; xem ảnh tại review/history.
 * Lịch sử trên tab: theo quyền backend (CN: APPROVED mọi người + phiếu của mình); NVKT+ xem 5 bản gần nhất đầy đủ.
 * Query ?assetId=: đồng bộ ô nhập + tự gọi getQRInfo (không cần bấm Tải thông tin).
 * Query ?woId=: gắn checklist với WO SCHEDULE — sau khi tải xong mở thẳng tab Checklist.
 * Mở file tài liệu: POST /digital-assets/:id/view-log (Báo cáo sử dụng tài nguyên); không chặn mở tab mới nếu log lỗi.
 */
import { useState, useMemo, useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  QrCode,
  FileText,
  CheckSquare,
  AlertTriangle,
  XCircle,
  CheckCircle,
  ExternalLink,
  MessageSquare,
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
import { api } from "../../api/index.js";
import { checklistApi } from "../../api/checklist.api.js";
import { assetApi } from "../../api/asset.api.js";
import { Button } from "../../components/ui/Button.jsx";
import { Input, Textarea, Select } from "../../components/ui/Input.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
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
import { documentFilePublicUrl } from "../../utils/documentUrl.js";
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
  const { assetId: assetIdFromPath } = useParams();
  const [searchParams] = useSearchParams();
  const canSubmitChecklist = canDo(user, "CHECKLIST_RESULT:CREATE");
  const canSubmitDocFeedback = canDo(user, "DOCUMENT_FEEDBACK:CREATE");
  const canReviewDocFeedback = canDo(user, "DOCUMENT_FEEDBACK:REVIEW");
  const canOpenAssetPage = canAccess(user, "assets");
  const [assetInput, setAssetInput] = useState("");
  const [qrData, setQrData] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState("device");
  const [maintHistory, setMaintHistory] = useState(null);
  const [maintLoading, setMaintLoading] = useState(false);
  const [overallStatus, setOverallStatus] = useState("OK");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [notes, setNotes] = useState("");
  const [readingValue, setReadingValue] = useState("");
  const [readingInputError, setReadingInputError] = useState("");
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [evidencePhoto, setEvidencePhoto] = useState(null);
  /** Map TemplateItemID → File cho câu inputType Photo */
  const [itemPhotos, setItemPhotos] = useState({});
  const [activeTagFilter, setActiveTagFilter] = useState("ALL");
  const [fbDoc, setFbDoc] = useState(null);
  const [fbBody, setFbBody] = useState("");
  const [fbList, setFbList] = useState([]);
  const [fbLoading, setFbLoading] = useState(false);
  const [fbSending, setFbSending] = useState(false);
  /** WO từ lịch — truyền từ WorkOrderDetail (?woId=) để nộp checklist gắn phiếu. */
  const linkedWoId = searchParams.get("woId")?.trim() || "";
  const templateIdFromQuery = searchParams.get("templateId")?.trim() || "";
  const canSubmitLinkedWoChecklist = useMemo(() => {
    if (!linkedWoId) return true;
    return qrData?.woChecklist?.canSubmit !== false;
  }, [linkedWoId, qrData?.woChecklist?.canSubmit]);

  const templatesForSubmit = useMemo(() => {
    const all = qrData?.checklistTemplates ?? [];
    if (!linkedWoId) return all;
    const openIds = qrData?.woChecklist?.openTemplateIds;
    if (Array.isArray(openIds) && openIds.length > 0) {
      return all.filter((tpl) =>
        openIds.includes(Number(tpl.templateId)),
      );
    }
    return all;
  }, [qrData, linkedWoId]);

  const assetIdFromQuery = searchParams.get("assetId")?.trim() || "";
  const assetIdFromUrl = (assetIdFromPath || assetIdFromQuery || "").trim();

  useEffect(() => {
    if (assetIdFromUrl) setAssetInput(assetIdFromUrl);
  }, [assetIdFromUrl]);

  /** Deep link: ?assetId= — tải thông tin tài sản giống bấm «Tải thông tin»; có ?woId= → tab Checklist. */
  useEffect(() => {
    if (!assetIdFromUrl) return;
    let cancelled = false;
    setScanning(true);
    setQrData(null);
    setSubmitted(null);
    setAnswers({});
    setReadingValue("");
    setReadingInputError("");
    (async () => {
      try {
        const res = await checklistApi.getQRInfo(assetIdFromUrl, {
          ...(linkedWoId ? { woId: linkedWoId } : {}),
        });
        if (cancelled) return;
        setQrData(res.data.data);
        const openTpl = res.data.data?.woChecklist?.openTemplateIds?.[0];
        setSelectedTemplateId(
          String(
            templateIdFromQuery ||
              openTpl ||
              res.data.data?.preferredTemplateId ||
              res.data.data?.checklistTemplate?.templateId ||
              "",
          ),
        );
        setActiveTab(linkedWoId ? "checklist" : "device");
        setMaintHistory(null);
        toast.success(`Đã tải thông tin: ${res.data.data.asset.assetName}`);
      } catch (err) {
        if (!cancelled)
          toast.error(err.response?.data?.message ?? "Không tìm thấy tài sản");
      } finally {
        if (!cancelled) setScanning(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assetIdFromUrl, linkedWoId, templateIdFromQuery]);

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

  const openDocFeedback = async (doc) => {
    setFbDoc(doc);
    setFbBody("");
    setFbLoading(true);
    setFbList([]);
    try {
      const res = await api.get(
        `/digital-assets/${doc.digitalAssetId}/feedback`,
      );
      setFbList(Array.isArray(res.data.data) ? res.data.data : []);
    } catch {
      toast.error("Không tải được danh sách phản hồi");
    } finally {
      setFbLoading(false);
    }
  };

  const sendDocFeedback = async (e) => {
    e.preventDefault();
    if (!fbDoc || !canSubmitDocFeedback) return;
    const t = fbBody.trim();
    if (!t) {
      toast.error("Nhập nội dung góp ý");
      return;
    }
    setFbSending(true);
    try {
      await api.post(`/digital-assets/${fbDoc.digitalAssetId}/feedback`, {
        body: t,
      });
      toast.success("Đã gửi phản hồi từ hiện trường");
      setFbBody("");
      const res = await api.get(
        `/digital-assets/${fbDoc.digitalAssetId}/feedback`,
      );
      setFbList(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Không gửi được phản hồi");
    } finally {
      setFbSending(false);
    }
  };

  const activeChecklistTemplate = useMemo(() => {
    const allTemplates =
      templatesForSubmit.length > 0
        ? templatesForSubmit
        : qrData?.checklistTemplates;
    if (Array.isArray(allTemplates) && allTemplates.length > 0) {
      return (
        allTemplates.find(
          (tpl) => Number(tpl.templateId) === Number(selectedTemplateId),
        ) || allTemplates[0]
      );
    }
    return qrData?.checklistTemplate ?? null;
  }, [qrData, selectedTemplateId, templatesForSubmit]);

  const overallSuggestion = useMemo(
    () =>
      deriveChecklistOverallSuggestion(activeChecklistTemplate?.items, answers),
    [activeChecklistTemplate, answers],
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
    setItemPhotos({});
    setReadingValue("");
    setReadingInputError("");
    try {
      const res = await checklistApi.getQRInfo(assetInput.trim());
      setQrData(res.data.data);
      setSelectedTemplateId(
        String(
          res.data.data?.preferredTemplateId ??
            res.data.data?.checklistTemplate?.templateId ??
            "",
        ),
      );
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
    if (linkedWoId && !canSubmitLinkedWoChecklist) {
      toast.error(
        "Checklist gắn phiếu chỉ trưởng nhóm được thực hiện. Bạn chỉ có thể xem khi checklist hoàn thành.",
      );
      return;
    }

    if (!activeChecklistTemplate?.templateId) {
      toast.error("Thiết bị chưa có mẫu checklist để nộp.");
      return;
    }

    // Ảnh minh chứng bắt buộc
    if (!evidencePhoto) {
      toast.error("Vui lòng chụp và đính kèm ảnh minh chứng trước khi gửi.");
      return;
    }

    const photoItems = (activeChecklistTemplate?.items || []).filter(
      (it) => String(it.inputType).toLowerCase() === "photo",
    );
    for (const it of photoItems) {
      if (!itemPhotos[it.itemId]) {
        toast.error(
          `Vui lòng đính ảnh hiện trường cho câu: ${it.questionText || `#${it.itemId}`}`,
        );
        return;
      }
    }

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
      let details = Object.entries(answers).map(([questionId, value]) => ({
        questionId: Number(questionId),
        answerValue: String(value),
        isOk: value !== "false" && value !== "0" && value !== "NG",
      }));
      for (const it of photoItems) {
        if (!details.some((d) => Number(d.questionId) === Number(it.itemId))) {
          details.push({
            questionId: Number(it.itemId),
            answerValue: "",
            isOk: true,
          });
        }
      }

      // Luôn dùng FormData vì ảnh bắt buộc
      let res;
      const fd = new FormData();
      fd.append("photo", evidencePhoto);
      fd.append("assetId", qrData.asset.assetId);
      if (selectedTemplateId) fd.append("templateId", selectedTemplateId);
      if (linkedWoId) fd.append("woId", linkedWoId);
      fd.append("overallStatus", overallStatus);
      fd.append("notes", notes);
      if (readingValue) fd.append("readingValue", readingValue);
      fd.append("details", JSON.stringify(details));
      for (const it of photoItems) {
        const f = itemPhotos[it.itemId];
        if (f) fd.append(`item_${it.itemId}`, f);
      }
      res = await checklistApi.submitWithPhoto(fd);

      setSubmitted(res.data.data);
      toast.success("Đã gửi — chờ Trưởng ca / Trưởng phòng xác nhận.");
      setReadingValue("");
      setNotes("");
      setAnswers({});
      setEvidencePhoto(null);
      setItemPhotos({});
      setOverallStatus("OK");
      try {
        const refresh = await checklistApi.getQRInfo(
          String(qrData.asset.assetId),
          { ...(linkedWoId ? { woId: linkedWoId } : {}) },
        );
        setQrData(refresh.data.data);
        setSelectedTemplateId(
          String(
            refresh.data.data?.preferredTemplateId ??
              refresh.data.data?.checklistTemplate?.templateId ??
              "",
          ),
        );
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
        {/* <p className="font-bold text-indigo-900 mb-1">
          Quét QR — xem đúng thiết bị
        </p>
        <p className="leading-relaxed text-indigo-900/90">
          <strong>Mọi người</strong> có thể nhập mã / quét QR để xem{" "}
          <strong>thông tin tài sản</strong>, tài liệu SOP và lịch sử. Chỉ{" "}
          <strong>KTV hiện trường</strong> và <strong>trưởng phòng</strong> mới{" "}
          <strong>gửi checklist</strong> kiểm tra từ đây. Sau khi gửi,{" "}
          <strong>trưởng ca hoặc trưởng phòng</strong> xử lý tại &quot;Tiếp nhận
          checklist&quot; rồi hệ thống mới cập nhật trạng thái / phiếu việc.
        </p> */}
        <p className="mt-2 text-xm text-indigo-800/90 leading-">
          <Link
            to="/checklists/history"
            className="font-semibold underline hover:no-underline"
          >
            Danh sách checklist
          </Link>{" "}
          {/* — KTV hiện trường chỉ thấy phiếu đã duyệt + phiếu của mình. */}
        </p>
      </div>

      {linkedWoId ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950 space-y-1">
          <p className="font-semibold text-emerald-900">
            Checklist gắn với WO #{linkedWoId}.
          </p>
          {Array.isArray(qrData?.woChecklist?.checklistSlots) &&
            qrData.woChecklist.checklistSlots.length > 1 && (
              <p className="text-emerald-800">
                Phiếu yêu cầu{" "}
                <strong>{qrData.woChecklist.checklistSlots.length}</strong> mẫu
                checklist — nộp từng mẫu còn thiếu.
              </p>
            )}
          {templatesForSubmit.length === 0 && qrData?.woChecklist && (
            <p className="text-emerald-800">
              Tất cả checklist bắt buộc trên phiếu đã hoàn thành hoặc phiếu không
              gắn mẫu cố định.
            </p>
          )}
        </div>
      ) : null}

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
              label: `Tài liệu liên quan (${qrData.documents?.length ?? 0})`,
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
                        lastMaintenanceTotal: 0,
                        averageHoursPerDay: 0,
                        estimatedNextPMDate: null,
                        lastUpdated: null,
                      };
                      const hoursSincePm = Math.max(
                        0,
                        Number(rc.totalAccumulatedHours) -
                          Number(rc.lastMaintenanceTotal),
                      );
                      return (
                        <div className="sm:col-span-2 flex gap-3 rounded-xl border-2 border-sky-300/80 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm">
                          <Gauge
                            size={22}
                            className="text-sky-600 shrink-0 mt-0.5"
                            aria-hidden
                          />
                          <div className="flex-1 min-w-0 space-y-2">
                            <p className="text-xs font-semibold text-sky-900 uppercase tracking-wide">
                              Bộ đếm giờ chạy
                            </p>
                            <div>
                              <p className="text-[11px] font-medium text-sky-800/90">
                                Chỉ số đồng hồ máy (lần ghi cuối)
                              </p>
                              <p className="text-2xl font-bold text-sky-950 tabular-nums leading-tight">
                                {fNumber(rc.lastReadingValue)}{" "}
                                <span className="text-base font-semibold">
                                  giờ
                                </span>
                              </p>
                            </div>
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-sky-950">
                              <div className="rounded-lg bg-white/70 border border-sky-100/80 px-2 py-1.5">
                                <dt className="text-[10px] font-semibold text-sky-700 uppercase">
                                  Tổng tích lũy (delta)
                                </dt>
                                <dd className="font-bold tabular-nums">
                                  {fNumber(rc.totalAccumulatedHours)} h
                                </dd>
                                <dd className="text-[10px] text-sky-800/80 mt-0.5 leading-snug">
                                  Cộng dồn mỗi lần nhập chỉ số mới
                                </dd>
                              </div>
                              <div className="rounded-lg bg-white/70 border border-sky-100/80 px-2 py-1.5">
                                <dt className="text-[10px] font-semibold text-sky-700 uppercase">
                                  Mốc sau PM (theo giờ)
                                </dt>
                                <dd className="font-bold tabular-nums">
                                  {fNumber(rc.lastMaintenanceTotal)} h
                                </dd>
                                <dd className="text-[10px] text-sky-800/80 mt-0.5 leading-snug">
                                  Reset khi hoàn thành PM định kỳ/dự báo
                                </dd>
                              </div>
                              <div className="sm:col-span-2 rounded-lg bg-sky-100/50 border border-sky-200/80 px-2 py-1.5">
                                <dt className="text-[10px] font-semibold text-sky-800 uppercase">
                                  Giờ chạy kể từ mốc PM (dùng so ngưỡng lịch
                                  giờ)
                                </dt>
                                <dd className="font-bold tabular-nums text-sky-950">
                                  {fNumber(hoursSincePm)} h
                                </dd>
                              </div>
                            </dl>
                            {rc.estimatedNextPMDate ? (
                              <p className="text-[11px] text-sky-900/90">
                                PM dự báo:{" "}
                                <strong>{fDate(rc.estimatedNextPMDate)}</strong>
                                {Number(rc.averageHoursPerDay) > 0
                                  ? ` · TB ${fNumber(rc.averageHoursPerDay)} h/ngày`
                                  : ""}
                              </p>
                            ) : null}
                            <p className="text-xs text-sky-900/85 leading-relaxed">
                              {rc.lastUpdated
                                ? `Cập nhật lần cuối: ${fDateTime(rc.lastUpdated)}. Khi nộp checklist, chỉ số máy phải ≥ ${fNumber(rc.lastReadingValue)} h.`
                                : "Chưa có lần ghi trước — có thể nhập chỉ số ≥ 0 ở tab Checklist."}
                            </p>
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
                        Nhập chỉ số đồng hồ máy (tuỳ chọn)
                      </p>
                      <p className="text-xs text-sky-900/90 leading-relaxed">
                        Đây là <strong>chỉ số tổng trên màn hình máy</strong>,
                        khác với <strong>tổng tích lũy (delta)</strong> và{" "}
                        <strong>mốc sau PM</strong> ở tab Tài sản phía trên.
                        Trong hệ thống đang lưu chỉ số cuối:{" "}
                        <strong className="tabular-nums text-sky-950">
                          {fNumber(runtimeMinReading)} h
                        </strong>
                        . Nếu nhập, giá trị mới{" "}
                        <strong>không được nhỏ hơn</strong> số này.
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
                    {activeChecklistTemplate?.items?.length > 0 ? (
                      <div className="space-y-4">
                        {(templatesForSubmit.length > 1 ||
                          (linkedWoId &&
                            (qrData?.woChecklist?.scheduleTemplateIds?.length ??
                              0) > 1)) && (
                          <Select
                            label="Mẫu checklist áp dụng"
                            value={selectedTemplateId}
                            onChange={(e) => {
                              setSelectedTemplateId(e.target.value);
                              setAnswers({});
                              setItemPhotos({});
                            }}
                          >
                            {templatesForSubmit.map((tpl) => (
                              <option
                                key={tpl.templateId}
                                value={tpl.templateId}
                              >
                                {tpl.templateName}
                              </option>
                            ))}
                          </Select>
                        )}
                        <h4 className="font-semibold text-gray-800 text-sm">
                          {activeChecklistTemplate.templateName}
                        </h4>
                        {activeChecklistTemplate.items.map((item) => (
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
                            {item.inputType === "Photo" &&
                              canSubmitChecklist && (
                                <div
                                  className={`rounded-lg border p-3 ${
                                    itemPhotos[item.itemId]
                                      ? "border-green-300 bg-green-50/50"
                                      : "border-amber-200 bg-amber-50/60"
                                  }`}
                                >
                                  <label className="text-xs font-semibold text-gray-800 block mb-1.5">
                                    Tải ảnh hiện trường{" "}
                                    <span className="text-red-600">*</span>
                                  </label>
                                  <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.webp"
                                    className="w-full text-sm text-gray-700 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0] ?? null;
                                      setItemPhotos((p) => ({
                                        ...p,
                                        [item.itemId]: f,
                                      }));
                                    }}
                                  />
                                  {itemPhotos[item.itemId] ? (
                                    <p className="text-xs text-green-700 mt-1.5 font-medium">
                                      Đã chọn: {itemPhotos[item.itemId].name}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-amber-800 mt-1.5">
                                      Bắt buộc có ảnh cho câu này trước khi gửi.
                                    </p>
                                  )}
                                </div>
                              )}
                            {item.inputType === "Photo" &&
                              !canSubmitChecklist && (
                                <p className="text-xs text-gray-500 italic">
                                  Bạn không được phép upload
                                </p>
                              )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">
                        Không có câu hỏi checklist cho loại tài sản này.
                      </p>
                    )}

                    {canSubmitChecklist && canSubmitLinkedWoChecklist ? (
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

                        <div
                          className={`rounded-xl border-2 p-4 transition-colors ${evidencePhoto ? "border-green-400 bg-green-50/50" : "border-red-300 bg-red-50/40"}`}
                        >
                          <label className="text-sm font-semibold text-gray-800 flex items-center gap-1.5 mb-2">
                            Ảnh minh chứng
                            <span className="text-red-500 font-bold">*</span>
                            <span className="text-xs font-normal text-red-600 ml-1">
                              (Bắt buộc)
                            </span>
                          </label>
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp"
                            onChange={(e) =>
                              setEvidencePhoto(e.target.files[0] ?? null)
                            }
                            className="w-full text-sm text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium hover:file:bg-blue-100"
                          />
                          {evidencePhoto ? (
                            <p className="text-xs text-green-700 mt-2 font-semibold flex items-center gap-1">
                              <CheckCircle
                                size={13}
                                className="text-green-500"
                              />
                              Đã chọn: {evidencePhoto.name}
                            </p>
                          ) : (
                            <p className="text-xs text-red-600 mt-2 font-medium">
                              Chưa có ảnh — bắt buộc chụp ảnh hiện trường trước
                              khi gửi
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            Hỗ trợ: JPG / PNG / WEBP, tối đa 10 MB
                          </p>
                        </div>

                        <Button
                          className="w-full justify-center"
                          loading={submitting}
                          onClick={handleSubmit}
                          disabled={!evidencePhoto}
                          title={
                            !evidencePhoto
                              ? "Cần đính kèm ảnh minh chứng trước khi gửi"
                              : undefined
                          }
                        >
                          Gửi kết quả kiểm tra
                        </Button>
                        {!evidencePhoto && (
                          <p className="text-xs text-center text-red-500 font-medium -mt-1">
                            Vui lòng đính kèm ảnh minh chứng để gửi
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                        {linkedWoId && !canSubmitLinkedWoChecklist ? (
                          <>
                            Checklist gắn phiếu việc chỉ{" "}
                            <strong>trưởng nhóm</strong> được nộp. Thành viên
                            khác xem sau khi checklist hoàn thành.
                          </>
                        ) : (
                          <>Bạn không có quyền kiểm tra hiện trường</>
                        )}
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
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                {(canSubmitDocFeedback || canReviewDocFeedback) && (
                                  <button
                                    type="button"
                                    title="Phản hồi / góp ý từ hiện trường"
                                    onClick={() => openDocFeedback(doc)}
                                    className="p-1.5 hover:bg-teal-50 rounded-lg text-teal-600 transition-colors"
                                  >
                                    <MessageSquare size={15} />
                                  </button>
                                )}
                                <a
                                  href={documentFilePublicUrl(
                                    doc.filePath,
                                    import.meta.env.VITE_API_BASE,
                                  )}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500"
                                  onClick={() => {
                                    const id = doc.digitalAssetId;
                                    if (id == null) return;
                                    void api
                                      .post(`/digital-assets/${id}/view-log`)
                                      .catch(() => {});
                                  }}
                                >
                                  <ExternalLink size={15} />
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )}

              {activeTab === "histChecklist" &&
                (() => {
                  const recent = qrData.recentResults ?? [];
                  const isWorker = (user?.positionLevel ?? 0) <= 1;
                  const myId = user?.employeeId;
                  const mine = isWorker
                    ? recent.filter(
                        (r) =>
                          myId != null && Number(r.checkerId) === Number(myId),
                      )
                    : [];
                  const others = isWorker
                    ? recent.filter(
                        (r) =>
                          myId == null || Number(r.checkerId) !== Number(myId),
                      )
                    : recent;

                  const Row = ({ r }) => (
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-4 py-3 flex flex-wrap gap-2 items-start">
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Badge color={CHECKLIST_STATUS_COLOR[r.overallStatus]}>
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
                        {isWorker &&
                          myId != null &&
                          Number(r.checkerId) === Number(myId) && (
                            <Badge color="blue" className="text-[10px]">
                              Của tôi
                            </Badge>
                          )}
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <p className="text-xs font-mono text-gray-500">
                          #{r.checklistId}
                        </p>
                        <p className="text-sm font-semibold text-gray-800">
                          {fDateTime(r.checkTime)}
                        </p>
                        {r.checkerName && (
                          <p className="text-xs text-gray-600 mt-0.5">
                            Người nộp: {r.checkerName}
                          </p>
                        )}
                        {r.readingValue != null && r.readingValue !== "" && (
                          <p className="text-xs text-gray-600 tabular-nums mt-0.5">
                            Đồng hồ: {fNumber(r.readingValue)} h
                          </p>
                        )}
                        {r.notes && (
                          <p className="text-sm text-gray-800 mt-2 whitespace-pre-wrap leading-relaxed border-t border-gray-100 pt-2">
                            {r.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );

                  return (
                    <Card title="Lịch sử kiểm tra checklist (5 bản gần nhất)">
                      <p className="text-xs text-gray-600 mb-4 -mt-1 leading-relaxed">
                        {isWorker ? (
                          <>
                            <strong>KTV hiện trường:</strong> danh sách gồm
                            phiếu <strong>đã duyệt (APPROVED)</strong> của mọi
                            người và <strong>mọi phiếu do bạn nộp</strong> (kể
                            cả chờ / từ chối).{" "}
                          </>
                        ) : (
                          <>
                            <strong>NVKT / giám sát:</strong> xem 5 phiếu mới
                            nhất trên thiết bị này.{" "}
                          </>
                        )}
                        <Link
                          to={`/checklists/history?assetId=${asset.assetId}`}
                          className="font-semibold text-blue-700 underline"
                        >
                          Mở danh sách đầy đủ + chi tiết
                        </Link>
                        .
                      </p>
                      {recent.length === 0 ? (
                        <p className="text-sm text-gray-400 py-6 text-center">
                          Chưa có phiếu checklist ghi nhận (theo quyền của bạn)
                        </p>
                      ) : (
                        <div className="space-y-6">
                          {isWorker && mine.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-blue-900 uppercase tracking-wide mb-2">
                                Phiếu của tôi
                              </p>
                              <div className="space-y-3">
                                {mine.map((r) => (
                                  <Row key={r.checklistId} r={r} />
                                ))}
                              </div>
                            </div>
                          )}
                          {isWorker && others.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                                Đã duyệt — tham khảo (người khác)
                              </p>
                              <div className="space-y-3">
                                {others.map((r) => (
                                  <Row key={r.checklistId} r={r} />
                                ))}
                              </div>
                            </div>
                          )}
                          {!isWorker && (
                            <div className="space-y-3">
                              {others.map((r) => (
                                <Row key={r.checklistId} r={r} />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })()}

              {activeTab === "maint" && (
                <Card title="Lịch sử bảo trì trên thiết bị">
                  <p className="text-xs text-gray-500 mb-3 -mt-1">
                    Ghi lại khi hoàn thành bảo trì; xem ghi chú và vật tư từng
                    lần bên dưới.
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

      <Modal
        open={!!fbDoc}
        onClose={() => {
          setFbDoc(null);
          setFbList([]);
          setFbBody("");
        }}
        title={fbDoc ? `Phản hồi: ${fbDoc.fileName}` : ""}
        size="lg"
      >
        {fbDoc && (
          <div className="space-y-4">
            {canReviewDocFeedback && (
              <p className="text-sm bg-teal-50 border border-teal-200 text-teal-900 rounded-lg px-3 py-2">
                Bạn đang xem toàn bộ phản hồi cho tài liệu này. Cập nhật trạng
                thái tại{" "}
                <Link
                  to="/documents/feedback-inbox"
                  className="font-bold underline"
                >
                  hàng đợi Chuyên viên KTS
                </Link>
                .
              </p>
            )}
            {canSubmitDocFeedback && (
              <form
                onSubmit={sendDocFeedback}
                className="space-y-2 border-b border-gray-200 pb-4"
              >
                <label className="text-sm font-semibold text-gray-800 block">
                  Gửi góp ý / phản hồi từ hiện trường
                </label>
                <textarea
                  value={fbBody}
                  onChange={(e) => setFbBody(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900
                    placeholder:text-gray-600 placeholder:opacity-100
                    focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                  placeholder="Mô tả vấn đề hoặc đề xuất cập nhật nội dung SOP…"
                />
                <div className="flex justify-end">
                  <Button type="submit" size="sm" loading={fbSending}>
                    <MessageSquare size={13} /> Gửi phản hồi
                  </Button>
                </div>
              </form>
            )}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                {canReviewDocFeedback ? "Tất cả phản hồi" : "Phản hồi của bạn"}
              </h4>
              {fbLoading ? (
                <p className="text-sm text-gray-400 py-4 text-center">
                  Đang tải…
                </p>
              ) : fbList.length === 0 ? (
                <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  Chưa có phản hồi nào.
                </p>
              ) : (
                <ul className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {fbList.map((f) => (
                    <li
                      key={f.feedbackId}
                      className="border border-gray-100 rounded-lg p-3 bg-gray-50/80"
                    >
                      <div className="flex flex-wrap justify-between gap-2 text-xs text-gray-500 mb-1">
                        <span className="font-semibold text-gray-800">
                          {f.authorName}
                        </span>
                        <span>{fDateTime(f.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {f.body}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 items-center">
                        <Badge
                          color={
                            f.status === "RESOLVED"
                              ? "green"
                              : f.status === "DISMISSED"
                                ? "gray"
                                : f.status === "IN_REVIEW"
                                  ? "blue"
                                  : "yellow"
                          }
                        >
                          {f.status === "OPEN"
                            ? "Chờ xử lý"
                            : f.status === "IN_REVIEW"
                              ? "Đang xem xét"
                              : f.status === "RESOLVED"
                                ? "Đã xử lý"
                                : f.status === "DISMISSED"
                                  ? "Không xử lý"
                                  : f.status}
                        </Badge>
                        {f.reviewNote && (
                          <span className="text-xs text-gray-600">
                            <span className="font-semibold">KT:</span>{" "}
                            {f.reviewNote}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
