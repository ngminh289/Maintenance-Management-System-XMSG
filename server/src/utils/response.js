/**
 * response.js — Chuẩn hóa JSON API: { success, data | message }.
 */
export function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function fail(res, message, status = 400, extra = {}) {
  return res.status(status).json({ success: false, message, ...extra });
}
