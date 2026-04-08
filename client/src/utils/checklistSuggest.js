/**
 * checklistSuggest.js — Gợi ý đánh giá tổng thể (OK / WARNING / NG) từ ngưỡng mẫu checklist.
 * Dùng tại ChecklistPage khi công nhân điền câu trả lời (Numeric/Range ngoài khoảng; PassFail không đạt).
 */

const SEVERITY = { NG: 3, WARNING: 2 };

/**
 * @param {Array<{ itemId, questionText, inputType, safeNumericMin?, safeNumericMax?, outOfRangeSuggest?, passFailFailSuggest? }>} items
 * @param {Record<number|string, string>} answers — key = itemId
 * @returns {{ suggested: 'WARNING'|'NG'|null, reasons: string[] }}
 */
export function deriveChecklistOverallSuggestion(items, answers) {
  const reasons = [];
  let best = null;
  let bestSev = 0;

  for (const item of items || []) {
    const id = item.itemId;
    const raw = answers[id];
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;

    const it = item.inputType;

    if (it === 'PassFail') {
      const v = String(raw).toLowerCase();
      const fail = v === 'false' || v === '0' || v === 'ng';
      const sugg = item.passFailFailSuggest;
      if (fail && sugg && SEVERITY[sugg]) {
        const sev = SEVERITY[sugg];
        if (sev > bestSev) {
          bestSev = sev;
          best = sugg;
        }
        const label = sugg === 'NG' ? 'NG' : 'CẢNH BÁO';
        reasons.push(`«${item.questionText}»: không đạt → gợi ý chọn ${label}`);
      }
    }

    if (it === 'Numeric' || it === 'Range') {
      const num = Number(raw);
      if (Number.isNaN(num)) continue;
      const min = item.safeNumericMin != null && item.safeNumericMin !== '' ? Number(item.safeNumericMin) : null;
      const max = item.safeNumericMax != null && item.safeNumericMax !== '' ? Number(item.safeNumericMax) : null;
      const sugg = item.outOfRangeSuggest;
      if (!sugg || (min == null && max == null)) continue;
      const below = min != null && !Number.isNaN(min) && num < min;
      const above = max != null && !Number.isNaN(max) && num > max;
      if (below || above) {
        const sev = SEVERITY[sugg];
        if (sev > bestSev) {
          bestSev = sev;
          best = sugg;
        }
        const band =
          min != null && max != null ? `[${min} … ${max}]`
          : min != null ? `≥ ${min}`
          : max != null ? `≤ ${max}`
          : '';
        const label = sugg === 'NG' ? 'NG' : 'CẢNH BÁO';
        reasons.push(`«${item.questionText}»: giá trị ${num} ngoài ngưỡng an toàn ${band} → gợi ý ${label}`);
      }
    }
  }

  return { suggested: best, reasons };
}
