/**
 * format.js — Tiện ích định dạng ngày, giờ, số, trạng thái.
 * QUAN TRỌNG: Chuẩn hóa parse ngày theo local timezone để tránh lỗi lệch -1 ngày.
 */
import { addDays, format, formatDistanceToNow, parseISO, startOfDay } from "date-fns";
import { vi } from "date-fns/locale";

function parseDateLike(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value;
  const s = String(value).trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dateOnly) {
    return new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
    );
  }
  const normalized = s.includes("T") ? s : s.replace(" ", "T");
  // Chuỗi datetime không có timezone từ backend được hiểu là UTC.
  // Nếu parse local sẽ lệch ~7h với người dùng GMT+7.
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized);
  return new Date(hasTimezone ? normalized : `${normalized}Z`);
}

/** Ngày thuần YYYY-MM-DD: parse theo lịch local — tránh lùi 1 ngày khi chuỗi ISO được hiểu là UTC nửa đêm. */
export const fDate = (d) => {
  if (d == null || d === "") return "—";
  const head = String(d).split("T")[0];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(head);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const day = Number(m[3]);
    return format(new Date(y, mo, day), "dd/MM/yyyy");
  }
  return format(parseISO(head), "dd/MM/yyyy");
};
export const fDateTime = (d) => {
  const parsed = parseDateLike(d);
  if (!parsed || Number.isNaN(parsed.getTime())) return "—";
  return format(parsed, "dd/MM/yyyy HH:mm");
};
export const fFromNow = (d) => {
  const parsed = parseDateLike(d);
  if (!parsed || Number.isNaN(parsed.getTime())) return "—";
  return formatDistanceToNow(parsed, { addSuffix: true, locale: vi });
};
export const fNumber = (n) =>
  n == null ? "—" : Number(n).toLocaleString("vi-VN");

/** YYYY-MM-DD local dùng cho input type=date / query API, không bị lệch UTC. */
export const toDateInputValue = (value) => {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  const direct = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;
  const parsed = parseDateLike(value);
  if (!parsed || Number.isNaN(parsed.getTime())) return "";
  return format(parsed, "yyyy-MM-dd");
};

/** Lấy ngày local hôm nay dạng YYYY-MM-DD (không dùng toISOString để tránh lệch ngày). */
export const todayDateInput = () => format(new Date(), "yyyy-MM-dd");

/** Lấy ngày local +/- N ngày dạng YYYY-MM-DD. */
export const dateInputWithOffset = (daysOffset, baseDate = new Date()) =>
  format(addDays(baseDate, daysOffset), "yyyy-MM-dd");

/** So sánh theo ngày local: true nếu ngày đã qua trước hôm nay. */
export const isDateBeforeToday = (value) => {
  const d = parseDateLike(value);
  if (!d || Number.isNaN(d.getTime())) return false;
  return startOfDay(d).getTime() < startOfDay(new Date()).getTime();
};

export const ASSET_STATUS_LABEL = {
  AVAILABLE: "Hoạt động bình thường",
  MONITORING: "Đang giám sát",
  CAUTION: "Cần chú ý",
  MAINTENANCE: "Đang bảo trì",
  BROKEN: "Hỏng hóc",
  DECOMMISSIONED: "Ngưng hoạt động",
};

export const ASSET_STATUS_COLOR = {
  AVAILABLE: "green",
  MONITORING: "blue",
  CAUTION: "yellow",
  MAINTENANCE: "orange",
  BROKEN: "red",
  DECOMMISSIONED: "gray",
};

export const WO_STATUS_LABEL = {
  PENDING_APPROVAL: "Chờ duyệt",
  WAITING: "Chờ thực hiện",
  IN_PROGRESS: "Đang thực hiện",
  PAUSED: "Tạm dừng",
  AWAITING_CLOSURE: "Chờ nghiệm thu",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

export const WO_STATUS_COLOR = {
  PENDING_APPROVAL: "yellow",
  WAITING: "blue",
  IN_PROGRESS: "indigo",
  PAUSED: "orange",
  AWAITING_CLOSURE: "purple",
  COMPLETED: "green",
  CANCELLED: "gray",
};

export const WO_PRIORITY_LABEL = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  EMERGENCY: "Khẩn cấp",
};

export const WO_PRIORITY_COLOR = {
  LOW: "gray",
  MEDIUM: "blue",
  HIGH: "orange",
  EMERGENCY: "red",
};

/** Nguồn phiếu việc — nhãn ngắn cho lịch sử bảo trì tài sản. */
export const WO_SOURCE_LABEL = {
  SCHEDULE: "Theo lịch",
  PREDICTIVE: "Dự báo giờ",
  PREDICTIVE_SCHEDULE: "Dự báo từ lịch",
  MANUAL: "Thủ công",
  CORRECTIVE: "Sự cố / khắc phục",
};

export const CHECKLIST_STATUS_COLOR = {
  OK: "green",
  WARNING: "yellow",
  NG: "red",
};

export const APPROVAL_STATUS_COLOR = {
  PENDING: "yellow",
  APPROVED: "green",
  REJECTED: "red",
  REQUEST_CHANGES: "orange",
};
