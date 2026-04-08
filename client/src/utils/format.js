/**
 * format.js — Tiện ích định dạng ngày, giờ, số, trạng thái.
 */
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';

/** Ngày thuần YYYY-MM-DD: parse theo lịch local — tránh lùi 1 ngày khi chuỗi ISO được hiểu là UTC nửa đêm. */
export const fDate = (d) => {
  if (d == null || d === '') return '—';
  const head = String(d).split('T')[0];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(head);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const day = Number(m[3]);
    return format(new Date(y, mo, day), 'dd/MM/yyyy');
  }
  return format(parseISO(head), 'dd/MM/yyyy');
};
export const fDateTime = (d) => d ? format(new Date(d), 'dd/MM/yyyy HH:mm') : '—';
export const fFromNow = (d) => d ? formatDistanceToNow(new Date(d), { addSuffix: true, locale: vi }) : '—';
export const fNumber = (n) => n == null ? '—' : Number(n).toLocaleString('vi-VN');

export const ASSET_STATUS_LABEL = {
  AVAILABLE:      'Sẵn sàng',
  MONITORING:     'Theo dõi',
  CAUTION:        'Cảnh báo',
  MAINTENANCE:    'Đang bảo trì',
  BROKEN:         'Hỏng',
  DECOMMISSIONED: 'Loại biên',
};

export const ASSET_STATUS_COLOR = {
  AVAILABLE:      'green',
  MONITORING:     'blue',
  CAUTION:        'yellow',
  MAINTENANCE:    'orange',
  BROKEN:         'red',
  DECOMMISSIONED: 'gray',
};

export const WO_STATUS_LABEL = {
  PENDING_APPROVAL: 'Chờ duyệt',
  WAITING:          'Chờ thực hiện',
  IN_PROGRESS:      'Đang thực hiện',
  PAUSED:           'Tạm dừng',
  AWAITING_CLOSURE: 'Chờ nghiệm thu',
  COMPLETED:        'Hoàn thành',
  CANCELLED:        'Đã hủy',
};

export const WO_STATUS_COLOR = {
  PENDING_APPROVAL: 'yellow',
  WAITING:          'blue',
  IN_PROGRESS:      'indigo',
  PAUSED:           'orange',
  AWAITING_CLOSURE: 'purple',
  COMPLETED:        'green',
  CANCELLED:        'gray',
};

export const WO_PRIORITY_LABEL = {
  LOW:       'Thấp',
  MEDIUM:    'Trung bình',
  HIGH:      'Cao',
  EMERGENCY: 'Khẩn cấp',
};

export const WO_PRIORITY_COLOR = {
  LOW:       'gray',
  MEDIUM:    'blue',
  HIGH:      'orange',
  EMERGENCY: 'red',
};

/** Nguồn phiếu việc — nhãn ngắn cho lịch sử bảo trì tài sản. */
export const WO_SOURCE_LABEL = {
  SCHEDULE:   'Theo lịch',
  PREDICTIVE: 'Dự báo giờ',
  MANUAL:     'Thủ công',
  CORRECTIVE: 'Sự cố / khắc phục',
};

export const CHECKLIST_STATUS_COLOR = {
  OK:      'green',
  WARNING: 'yellow',
  NG:      'red',
};

export const APPROVAL_STATUS_COLOR = {
  PENDING:         'yellow',
  APPROVED:        'green',
  REJECTED:        'red',
  REQUEST_CHANGES: 'orange',
};
