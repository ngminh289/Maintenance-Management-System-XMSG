/**
 * audit.js — Helper ghi AuditLog đơn giản từ bất kỳ service/controller nào.
 * Không throw lỗi nếu ghi thất bại (fire-and-forget).
 * Dùng trong: controllers để log sau mỗi mutation quan trọng.
 */
import * as auditModel from '../models/auditLog.model.js';

export async function logAction({ employeeId, action, tableName, recordId, oldValue, newValue }) {
  try {
    await auditModel.log({ employeeId, action, tableName, recordId, oldValue, newValue });
  } catch {
    // Không fail request nếu audit lỗi
  }
}
