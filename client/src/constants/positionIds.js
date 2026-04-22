/**
 * positionIds.js — PositionID từ DB (migration 019, 055, 056).
 * 3 Trưởng ca bảo trì, 6 Trưởng phòng bảo trì, 7 Trưởng phòng PKT, 8–9 phó tương ứng.
 * 056–058: PKT 7,9 — KTS + duyệt DAM; WO chỉ READ (058).
 * Liên quan: utils/rbac.js, server/approval.
 */
/** Giám đốc / Ban GĐ — gắn DepartmentID 3 (Ban giám đốc), migration 040. */
export const PID_GIAM_DOC = 5;

export const PID_TRUONG_CA = 3;
export const PID_TRUONG_PHONG_BAO_TRI = 6;
export const PID_TRUONG_PHONG_KT = 7;
export const PID_PHO_BAO_TRI = 8;
export const PID_PHO_PHONG_KT = 9;

export const PIDS_TUYEN_BAO_TRI = [PID_TRUONG_CA, PID_TRUONG_PHONG_BAO_TRI, PID_PHO_BAO_TRI];
export const PIDS_TP_BAO_TRI_HEAD = [PID_TRUONG_PHONG_BAO_TRI, PID_PHO_BAO_TRI];
export const PIDS_TP_KT_HEAD = [PID_TRUONG_PHONG_KT, PID_PHO_PHONG_KT];
