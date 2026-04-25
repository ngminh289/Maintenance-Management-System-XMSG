/**
 * checklistReviewCompare.js — So sánh câu trả lời checklist với ngưỡng mẫu (màn Tiếp nhận / duyệt).
 * Dùng chung định dạng với checklistSuggest (Numeric/Range ngoài min-max; PassFail + gợi ý).
 */

/** Chuỗi hiển thị khoảng ngưỡng an toàn (min/max trên mẫu). */
export function formatSafeBand(threshold) {
  if (!threshold) return null;
  const min = threshold.safeNumericMin != null && threshold.safeNumericMin !== ''
    ? Number(threshold.safeNumericMin) : null;
  const max = threshold.safeNumericMax != null && threshold.safeNumericMax !== ''
    ? Number(threshold.safeNumericMax) : null;
  if (min != null && !Number.isNaN(min) && max != null && !Number.isNaN(max)) return `${min} … ${max}`;
  if (min != null && !Number.isNaN(min)) return `≥ ${min}`;
  if (max != null && !Number.isNaN(max)) return `≤ ${max}`;
  return null;
}

/** Khoảng giá trị hợp lệ khi kiểu Range (theo mẫu). */
export function formatInputRangeBand(threshold) {
  if (!threshold) return null;
  const a = threshold.rangeMin;
  const b = threshold.rangeMax;
  if (a != null && b != null) return `${a} – ${b}`;
  return null;
}

/**
 * @param {{ inputType: string, answerValue?: string|null, isOK?: boolean, threshold?: object|null }} detail
 * @returns {{ tone: 'good'|'bad'|'neutral'|'warn', lines: string[] }}
 */
export function getReviewRowCompare(detail) {
  const { inputType, answerValue, isOK, threshold } = detail;
  const lines = [];

  if (!threshold) {
    lines.push('Không khớp mẫu.');
    return { tone: 'neutral', lines };
  }

  if (inputType === 'PassFail') {
    const pass = isOK !== false;
    if (!pass && threshold.passFailFailSuggest) {
      lines.push(`Gợi ý: ${threshold.passFailFailSuggest}`);
    } else if (!pass) {
      lines.push('Chưa gợi ý trên mẫu.');
    }
    return { tone: pass ? 'good' : 'bad', lines };
  }

  if (inputType === 'Photo') {
    const has = answerValue && String(answerValue).trim();
    return {
      tone: has ? 'good' : 'neutral',
      lines: has ? ['Đã đính kèm ảnh hiện trường'] : ['Chưa có ảnh'],
    };
  }

  if (inputType === 'Numeric' || inputType === 'Range') {
    const n = Number(answerValue);
    const min = threshold.safeNumericMin != null && threshold.safeNumericMin !== ''
      ? Number(threshold.safeNumericMin) : null;
    const max = threshold.safeNumericMax != null && threshold.safeNumericMax !== ''
      ? Number(threshold.safeNumericMax) : null;
    const hasSafe = (min != null && !Number.isNaN(min)) || (max != null && !Number.isNaN(max));

    if (!hasSafe) {
      return { tone: 'neutral', lines: ['Chưa có min/max trên mẫu.'] };
    }
    if (Number.isNaN(n)) {
      return { tone: 'neutral', lines: [`Giá trị: ${answerValue ?? '—'}`] };
    }

    const below = min != null && !Number.isNaN(min) && n < min;
    const above = max != null && !Number.isNaN(max) && n > max;
    if (below || above) {
      lines.push(`Ngoài ngưỡng (${n}).`);
      return { tone: 'bad', lines };
    }
    lines.push('Trong ngưỡng.');
    return { tone: 'good', lines };
  }

  return { tone: 'neutral', lines: [] };
}

/** Hiển thị trả lời PassFail từ chuỗi lưu CSDL. */
export function formatAnswerLabel(inputType, answerValue, isOK) {
  if (inputType === 'PassFail') {
    const v = String(answerValue ?? '').toLowerCase();
    const pass = isOK !== false && v !== 'false' && v !== '0' && v !== 'ng';
    return pass ? 'Đạt' : 'Không đạt';
  }
  if (inputType === 'Photo') {
    if (answerValue === null || answerValue === undefined || answerValue === '') return '—';
    return 'Ảnh đính kèm';
  }
  if (answerValue === null || answerValue === undefined || answerValue === '') return '—';
  return String(answerValue);
}
