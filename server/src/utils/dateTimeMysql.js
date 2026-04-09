/**
 * dateTimeMysql.js — Chuẩn hoá datetime gửi từ client (datetime-local) → chuỗi MySQL DATETIME (naive local).
 * Dùng trong: employee.service (lịch nghỉ phép).
 */

/**
 * @param {string|null|undefined} input — ví dụ "2026-03-31T14:30" hoặc "2026-03-31T14:30:00"
 * @returns {string|null} "YYYY-MM-DD HH:mm:ss" hoặc null
 */
export function normalizeLocalDateTimeForMysql(input) {
  if (input == null || input === "") return null;
  const s = String(input).trim();
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?/.exec(s);
  if (m) {
    const sec = m[3] ?? "00";
    return `${m[1]} ${m[2]}:${sec}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
