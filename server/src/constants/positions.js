/**
 * positions.js — Tham chiếu cấp chức vụ (Positions.Level) sau migration 012.
 * Quản trị (thiết lập lịch nghỉ, v.v.): Level ≥ 4 — không gắn cứng PositionID.
 * Tên chức vụ / 3 phòng ban: constants/orgUnits.js + migration 040 + seed.sql.
 */
export const MIN_ADMIN_POSITION_LEVEL = 4;
