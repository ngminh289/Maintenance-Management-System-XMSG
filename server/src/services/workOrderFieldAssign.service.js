/**
 * workOrderFieldAssign.service.js — Phân công Công nhân / NV KT (L≤2) lên phiếu WO.
 * Tách khỏi workOrder.service để approval.service gọi được mà không bị import vòng với approval.
 * Dùng trong: workOrder.service.js (assign), approval.service.js (duyệt xong + phân công ngay).
 */
import { createError } from '../utils/createError.js';
import * as model from '../models/workOrder.model.js';
import * as employeeModel from '../models/employee.model.js';
import * as notifService from './notification.service.js';

const MAX_ASSIGNEE_LEVEL = 2;

/**
 * @param {number} woId
 * @param {number} assigneeEmployeeId
 * @param {number} actorLevel — Level của người thực hiện (Trưởng ca/Trưởng phòng ≥ 3)
 */
export async function assignFieldTechnicianToWorkOrder(woId, assigneeEmployeeId, actorLevel) {
  if ((actorLevel ?? 0) < 3) {
    throw createError('Chỉ Trưởng ca / Trưởng phòng được phân công nhân sự trên phiếu việc.', 403);
  }
  const w = await model.findById(woId);
  if (!w) throw createError('Không tìm thấy phiếu', 404);
  const emp = await employeeModel.findById(assigneeEmployeeId);
  if (!emp) throw createError('Không tìm thấy nhân viên', 404);
  if (!emp.isActive) throw createError('Nhân viên đang vô hiệu, không thể phân công', 400);
  if ((emp.positionLevel ?? 99) > MAX_ASSIGNEE_LEVEL) {
    throw createError(
      'Chỉ được phân công Công nhân hoặc Nhân viên Kỹ thuật (thực hiện hiện trường).',
      403,
    );
  }
  await model.assign(woId, assigneeEmployeeId);
  await notifService.send(
    assigneeEmployeeId,
    `Bạn được phân công vào phiếu WO #${woId}`,
    'WORK_ORDER_ASSIGNED',
  );
  return model.getAssignments(woId);
}
