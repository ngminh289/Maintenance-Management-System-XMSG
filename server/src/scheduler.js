/**
 * scheduler.js — Bộ lập lịch nền đơn giản (không dùng thư viện ngoài).
 * Chạy checkCalendarSchedules:
 *   1. Ngay khi server khởi động (sau 5 giây để DB sẵn sàng).
 *   2. Mỗi 24 giờ kế tiếp.
 * Liên quan: services/maintenanceSchedule.service.js.
 */
import { checkCalendarSchedules } from "./services/maintenanceSchedule.service.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function runCheck() {
  try {
    const count = await checkCalendarSchedules();
    console.log(
      `[Scheduler] checkCalendarSchedules — đã kiểm tra ${count} lịch.`,
    );
  } catch (err) {
    console.error("[Scheduler] checkCalendarSchedules lỗi:", err.message);
  }
}

export function startScheduler() {
  // Chạy lần đầu sau 5 giây (DB pool đã sẵn sàng)
  setTimeout(runCheck, 5_000);
  // Chạy lại mỗi 24 giờ
  setInterval(runCheck, ONE_DAY_MS);
}
