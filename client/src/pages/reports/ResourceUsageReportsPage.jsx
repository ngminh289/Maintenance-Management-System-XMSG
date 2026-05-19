/**
 * ResourceUsageReportsPage.jsx — Báo cáo sử dụng tài nguyên (6 tab).
 * RBAC: CV KTS (L2), Trưởng/Phó hai phòng (L3), Admin (L4+), Ban GĐ.
 * Dữ liệu: ChecklistResults, AssetQrAccessLogs, DigitalAssetViewLogs, DigitalAssetFeedback, AssetVersions.
 * Liên quan: api/stats.api.js, rbac (report-resource-usage).
 */
import { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  QrCode,
  ClipboardList,
  FileText,
  Flame,
  History,
  MessageCircle,
  Inbox,
  ArrowLeft,
  Printer,
} from "lucide-react";
import { statsApi } from "../../api/stats.api.js";
import { Card } from "../../components/ui/Card.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { PageLoader } from "../../components/ui/Spinner.jsx";
import { fDateTime } from "../../utils/format.js";
import toast from "react-hot-toast";

const TABS = [
  { key: "qr", label: "QR & phiếu checklist", short: "QR", icon: QrCode },
  {
    key: "docfreq",
    label: "Tần suất mở tài liệu",
    short: "Mở file",
    icon: FileText,
  },
  {
    key: "dochot",
    label: "Tài liệu nhiều lượt xem",
    short: "Hot",
    icon: Flame,
  },
  {
    key: "stale",
    label: "Tài liệu 12–24 tháng (lỗi thời)",
    short: "Lỗi thời",
    icon: History,
  },
  {
    key: "feedback",
    label: "Góp ý / phiên bản (kỳ)",
    short: "Tỷ lệ",
    icon: MessageCircle,
  },
  { key: "pending", label: "Góp ý chưa có bản mới", short: "Mở", icon: Inbox },
];

export function ResourceUsageReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = TABS.some((t) => t.key === tabParam) ? tabParam : "qr";

  const [months, setMonths] = useState(6);
  const setActiveTab = (key) => {
    setSearchParams({ tab: key, months: String(months) }, { replace: true });
  };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const urlTab = searchParams.get("tab");
  useEffect(() => {
    if (urlTab === "explain") {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set("tab", "qr");
          return p;
        },
        { replace: true },
      );
    }
  }, [urlTab, setSearchParams]);

  useEffect(() => {
    const m = searchParams.get("months");
    if (m) {
      const n = Math.min(24, Math.max(1, parseInt(m, 10) || 6));
      if (n !== months) setMonths(n);
    }
  }, [searchParams, months]);

  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      try {
        const res = await statsApi.resourceUsage(months);
        if (!c) setData(res.data.data);
      } catch (err) {
        if (!c) {
          setData(null);
          const msg =
            err?.response?.data?.message ||
            "Không tải được dữ liệu báo cáo. Vui lòng thử lại hoặc liên hệ quản trị.";
          toast.error(msg);
        }
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [months]);

  const onMonthsChange = (n) => {
    setMonths(n);
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("months", String(n));
        p.set("tab", prev.get("tab") || activeTab);
        return p;
      },
      { replace: true },
    );
  };

  const qrByDay = useMemo(
    () =>
      (data?.qrFieldUsage?.byDay ?? []).map((r) => ({
        day: r.dayKey,
        count: Number(r.accessCount),
      })),
    [data],
  );

  const docByDay = useMemo(
    () =>
      (data?.documentAccess?.byDay ?? []).map((r) => ({
        day: r.dayKey,
        count: Number(r.viewCount),
      })),
    [data],
  );

  const checklistTotal = useMemo(() => {
    const fromApi = data?.checklistSubmissions?.totalSubmissions;
    if (fromApi != null) return Number(fromApi);
    return (data?.checklistSubmissions?.byAssetChecker ?? []).reduce(
      (s, r) => s + Number(r.submissionCount ?? 0),
      0,
    );
  }, [data]);

  const checklistRows = data?.checklistSubmissions?.byAssetChecker ?? [];
  const qrTotal = Number(data?.qrFieldUsage?.totalOpens ?? 0);
  const periodMonths = data?.months ?? months;

  if (loading && !data) return <PageLoader />;

  return (
    <div className="max-w-6xl mx-auto space-y-6 print:space-y-3">
      <div
        className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900
          px-5 py-6 sm:px-8 sm:py-7 text-white shadow-xl shadow-indigo-900/20"
      >
        <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <Link
              to="/"
              className="mt-0.5 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 border border-white/10 transition-colors flex-shrink-0"
              title="Về Dashboard"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Báo cáo sử dụng tài nguyên
              </h1>
              <p className="text-sm text-indigo-100/90 mt-1 max-w-xl">
                QR, mở tài liệu, góp ý tài sản theo dữ liệu vận hành — cập nhật
                theo lượt chuyên viên tại hiện trường và tài khoản có quyền.
              </p>
            </div>
          </div>
          <div className="flex items-center flex-wrap gap-2 sm:justify-end">
            <span className="text-xs sm:text-sm text-indigo-200/90">
              Kỳ thống kê
            </span>
            <select
              value={months}
              onChange={(e) => onMonthsChange(Number(e.target.value))}
              className="rounded-xl border-0 bg-white/15 text-white text-sm font-semibold px-3 py-2
                backdrop-blur-sm ring-1 ring-inset ring-white/20 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              {[1, 3, 6, 9, 12, 18, 24].map((m) => (
                <option key={m} value={m} className="text-slate-900">
                  {m} tháng
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold
                text-white border border-white/15 hover:bg-white/20 transition-colors"
            >
              <Printer size={14} /> In
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-0.5 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 overflow-x-auto shadow-sm">
        {TABS.map(({ key, label, short, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap
              transition-all duration-200
              ${
                activeTab === key
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30 scale-[1.01]"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
          >
            <Icon size={16} className="flex-shrink-0 opacity-90" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{short}</span>
          </button>
        ))}
      </div>

      {!data && !loading && (
        <p className="text-sm text-center text-amber-800 bg-amber-50 border border-amber-100 rounded-xl py-3 px-4">
          Chưa có dữ liệu. Kiểm tra kết nối hoặc cập nhật trang sau vài phút.
        </p>
      )}

      {data && activeTab === "qr" && (
        <div className="space-y-6">
          <Card title={`Tổng quan hiện trường · ${periodMonths} tháng`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-4">
                <div className="flex items-center gap-2 text-indigo-800 mb-2">
                  <QrCode size={18} />
                  <span className="text-xs font-bold uppercase tracking-wide">
                    Quét / mở QR
                  </span>
                </div>
                <p className="text-3xl font-bold text-indigo-600 tabular-nums">
                  {qrTotal}
                </p>
                <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                  Số lần mở màn hình kiểm tra tài sản (quét mã hoặc nhập mã).
                </p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-4">
                <div className="flex items-center gap-2 text-emerald-800 mb-2">
                  <ClipboardList size={18} />
                  <span className="text-xs font-bold uppercase tracking-wide">
                    Nộp checklist
                  </span>
                </div>
                <p className="text-3xl font-bold text-emerald-600 tabular-nums">
                  {checklistTotal}
                </p>
                <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                  Số phiếu đã gửi kết quả kiểm tra hiện trường trong kỳ.
                </p>
              </div>
            </div>
            {qrTotal > 0 && checklistTotal === 0 && (
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5 mt-4">
                Đã có lượt quét QR nhưng chưa có phiếu checklist trong kỳ —
                quét mã chỉ mở trang thông tin; cần bấm{" "}
                <strong>Gửi kết quả kiểm tra</strong> để ghi nhận phiếu.
              </p>
            )}
          </Card>
          {(qrByDay.length > 0 ||
            (data.qrFieldUsage?.topAssets?.length ?? 0) > 0) && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <QrCode size={16} className="text-indigo-600" />
                Hoạt động quét QR
              </h3>
              {qrByDay.length > 0 && (
            <Card title="Lượt mở theo ngày">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={qrByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#6366f1"
                    name="Lượt mở QR"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
              )}
            {(data.qrFieldUsage?.topAssets?.length ?? 0) > 0 && (
              <Card title="Thiết bị được quét nhiều nhất">
                <div className="space-y-1.5">
                  {data.qrFieldUsage.topAssets.map((a) => (
                    <div
                      key={a.assetId}
                      className="flex justify-between py-1 border-b border-gray-100 last:border-0"
                    >
                      <span className="text-sm text-gray-800">
                        {a.assetName}
                      </span>
                      <Badge color="blue">{a.openCount}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            </section>
          )}
          <section className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList size={16} className="text-emerald-600" />
              Phiếu checklist đã nộp
              <Badge color="green">{checklistTotal}</Badge>
            </h3>
            <Card>
              {checklistRows.length > 0 ? (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {["Tài sản", "Người nộp", "Số phiếu"].map((h) => (
                          <th
                            key={h}
                            className="text-left px-3 py-2 text-xs font-bold text-gray-700"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {checklistRows.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50/80">
                          <td className="px-3 py-2 font-medium text-gray-900">
                            {r.assetName}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {r.checkerName}
                          </td>
                          <td className="px-3 py-2">
                            <Badge color="indigo">{r.submissionCount}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 px-4">
                  <ClipboardList
                    size={32}
                    className="mx-auto text-gray-300 mb-3"
                  />
                  <p className="text-sm font-medium text-gray-700">
                    Chưa có phiếu checklist trong {periodMonths} tháng gần nhất
                  </p>
                  <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                    Khi KTV hoặc Trưởng ca gửi kiểm tra hiện trường, bảng xếp
                    hạng theo tài sản và người nộp sẽ hiện tại đây.
                  </p>
                </div>
              )}
            </Card>
          </section>
        </div>
      )}

      {data && activeTab === "docfreq" && (
        <div className="space-y-4">
          <Card title="Tổng lượt mở file từ ứng dụng ">
            <p className="text-3xl font-bold text-emerald-600">
              {data.documentAccess?.totalViews ?? 0}
            </p>
          </Card>
          {docByDay.length > 0 && (
            <Card title="Lượt mở tài liệu theo ngày">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={docByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    fill="#10b981"
                    name="Lượt mở"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}

      {data && activeTab === "dochot" && (
        <div className="space-y-4">
          <Card title="Tài liệu được mở nhiều nhất (kỳ đã chọn)">
            {data.documentHot?.length === 0 ? (
              <p className="text-sm text-gray-400">
                Chưa có log mở file trong kỳ.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["Tài liệu", "Tài sản (nếu có)", "Lượt mở"].map((h) => (
                        <th
                          key={h}
                          className="text-left px-3 py-2 text-xs font-bold text-gray-700"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.documentHot.map((d) => (
                      <tr
                        key={d.digitalAssetId}
                        className="hover:bg-amber-50/40"
                      >
                        <td className="px-3 py-2 font-medium">{d.fileName}</td>
                        <td className="px-3 py-2 text-gray-600">
                          {d.assetName}
                        </td>
                        <td className="px-3 py-2">
                          <Badge color="amber">{d.viewCount}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {data && activeTab === "stale" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 bg-slate-50/80 border border-slate-100 rounded-xl px-4 py-2.5">
            Tiêu chí: tài liệu đã duyệt, tuổi upload từ 12–24 tháng, và chưa có
            thay đổi phiên bản nào trong 12 tháng gần đây
          </p>
          <Card title="Danh sách tài liệu cần ưu tiên rà soát / phiên bản mới">
            {data.staleDocuments?.length === 0 ? (
              <p className="text-sm text-emerald-600">
                Không có tài liệu khớp tiêu chí lỗi thời trong bộ lọc này.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {[
                        "Tài liệu",
                        "v.",
                        "Upload",
                        "Ngày từ upload",
                        "Lần đổi pb gần nhất",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-3 py-2 text-xs font-bold text-gray-700 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.staleDocuments.map((d) => (
                      <tr key={d.digitalAssetId}>
                        <td className="px-3 py-2 font-medium max-w-[200px] truncate">
                          {d.fileName}
                        </td>
                        <td className="px-3 py-2">v{d.currentVersion}</td>
                        <td className="px-3 py-2 text-gray-700">
                          {fDateTime(d.uploadDate)}
                        </td>
                        <td className="px-3 py-2">{d.daysSinceUpload} ngày</td>
                        <td className="px-3 py-2 text-gray-600">
                          {d.lastVersionChangeAt
                            ? fDateTime(d.lastVersionChangeAt)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {data && activeTab === "feedback" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card title="Góp ý tạo trong kỳ">
              <p className="text-2xl font-bold text-gray-900">
                {data.feedbackImprovement?.feedbackInPeriod ?? 0}
              </p>
            </Card>
            <Card title="Số phiên bản tài liệu tạo trong kỳ">
              <p className="text-2xl font-bold text-gray-900">
                {data.feedbackImprovement?.versionAddsInPeriod ?? 0}
              </p>
            </Card>
            <Card title="Tỷ lệ (góp ý / phiên bản)">
              <p className="text-2xl font-bold text-violet-600">
                {data.feedbackImprovement?.ratio != null
                  ? data.feedbackImprovement.ratio
                  : "—"}
              </p>
              {data.feedbackImprovement?.ratio == null && (
                <p className="text-xs text-amber-600 mt-1">
                  Chưa có tài liệu nào có phiên bản khác
                </p>
              )}
            </Card>
          </div>
        </div>
      )}

      {data && activeTab === "pending" && (
        <div className="space-y-4">
          <Card title="Góp ý chưa làm / đang thực hiện, chưa có phiên bản tài liệu sau thời điểm góp ý. ">
            {data.feedbackWithoutNewVersion?.length === 0 ? (
              <p className="text-sm text-emerald-600">
                Không có bản ghi cần theo dõi.
              </p>
            ) : (
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b sticky top-0">
                    <tr>
                      {[
                        "Tài liệu",
                        "Trạng thái",
                        "Gửi lúc",
                        "Nội dung rút gọn",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-3 py-2 text-xs font-bold text-gray-700"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.feedbackWithoutNewVersion.map((f) => (
                      <tr key={f.feedbackId}>
                        <td className="px-3 py-2 font-medium max-w-[180px] truncate">
                          {f.fileName}
                        </td>
                        <td className="px-3 py-2">
                          <Badge color="red">{f.status}</Badge>
                        </td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                          {fDateTime(f.createdAt)}
                        </td>
                        <td className="px-3 py-2 text-gray-700 line-clamp-2 max-w-md">
                          {f.body}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
