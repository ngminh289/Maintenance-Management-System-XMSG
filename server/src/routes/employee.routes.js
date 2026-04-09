/**
 * employee.routes.js — /api/employees (CRUD + đổi mật khẩu + kích hoạt/vô hiệu + lịch nghỉ).
 * PATCH /:id/leave-schedule — Level chức vụ ≥ 4 (requireLevel(4) + kiểm tra Level trong service).
 * Vô hiệu/kích hoạt: EMPLOYEE:DELETE.
 */
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { requireLevel } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  changePasswordSchema,
  leaveScheduleSchema,
} from "../validators/employee.validator.js";
import * as ctrl from "../controllers/employee.controller.js";

export const employeeRouter = Router();

employeeRouter.use(requireAuth);

employeeRouter.get("/", requirePermission("EMPLOYEE", "READ"), ctrl.getAll);
employeeRouter.get("/:id", requirePermission("EMPLOYEE", "READ"), ctrl.getById);

employeeRouter.post(
  "/",
  requirePermission("EMPLOYEE", "CREATE"),
  validate(createEmployeeSchema),
  ctrl.create,
);
employeeRouter.put(
  "/:id",
  requirePermission("EMPLOYEE", "UPDATE"),
  validate(updateEmployeeSchema),
  ctrl.update,
);

// Vô hiệu / kích hoạt — chỉ ai có DELETE quyền trên EMPLOYEE
employeeRouter.patch(
  "/:id/deactivate",
  requirePermission("EMPLOYEE", "DELETE"),
  ctrl.deactivate,
);
employeeRouter.patch(
  "/:id/activate",
  requirePermission("EMPLOYEE", "DELETE"),
  ctrl.activate,
);

employeeRouter.patch(
  "/:id/leave-schedule",
  requireLevel(4),
  validate(leaveScheduleSchema),
  ctrl.patchLeaveSchedule,
);

// Đổi mật khẩu — chỉ chính mình hoặc admin, kiểm tra trong controller
employeeRouter.patch(
  "/:id/password",
  validate(changePasswordSchema),
  ctrl.changePassword,
);
