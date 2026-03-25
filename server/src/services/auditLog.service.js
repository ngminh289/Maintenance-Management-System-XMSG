/**
 * auditLog.service.js — Lấy lịch sử audit log (admin only).
 * Ghi log: dùng utils/audit.js từ bất kỳ controller nào.
 * Liên quan: models/auditLog.model.js.
 */
import { getPagination, paginatedResult } from '../utils/paginate.js';
import * as model from '../models/auditLog.model.js';

export async function getAll(query) {
  const { page, limit, offset } = getPagination(query);
  const filters = {
    employeeId: query.employeeId ? Number(query.employeeId) : undefined,
    action:     query.action     || undefined,
    tableName:  query.tableName  || undefined,
    from:       query.from       || undefined,
    to:         query.to         || undefined,
  };
  const [items, total] = await Promise.all([
    model.findAll({ ...filters, limit, offset }),
    model.count(filters),
  ]);
  return paginatedResult(items, total, page, limit);
}
