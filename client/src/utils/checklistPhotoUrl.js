/**
 * checklistPhotoUrl.js — URL công khai cho ảnh checklist (AnswerValue / EvidencePhoto lưu uploads/photos/…).
 * Dùng: ChecklistPage (tuỳ chọn), ChecklistReviewPage, ChecklistHistoryPage, WorkOrderDetailPage.
 */
const API_ORIGIN = (import.meta.env.VITE_API_BASE || 'http://localhost:4000/api').replace(/\/?api\/?$/, '');

/**
 * @param {string|null|undefined} stored — đường dẫn tương đối hoặc tuyệt đối đã lưu
 * @returns {string|null}
 */
export function checklistStoredPhotoUrl(stored) {
  if (!stored) return null;
  const s = String(stored).replace(/\\/g, '/');
  if (/^https?:\/\//i.test(s)) return s;
  const lower = s.toLowerCase();
  const u = lower.indexOf('/uploads/');
  const path = u >= 0 ? s.slice(u + 1) : (s.startsWith('uploads/') ? s : `uploads/photos/${s.split('/').pop()}`);
  return `${API_ORIGIN.replace(/\/$/, '')}/${path}`;
}
