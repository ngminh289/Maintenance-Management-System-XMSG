/**
 * maintenanceSchedule.routes.js — /api/maintenance-schedules.
 * Phân quyền nghiêm ngặt theo RBAC.
 * Gửi lịch vào duyệt: SUBMIT (NV KT + Admin — BFD 4.1; Trưởng ca không SUBMIT).
 */
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { validate } from "../middleware/validate.js";
import {
  createScheduleSchema,
  updateScheduleSchema,
} from "../validators/maintenanceSchedule.validator.js";
import * as ctrl from "../controllers/maintenanceSchedule.controller.js";

export const maintenanceScheduleRouter = Router();

maintenanceScheduleRouter.use(requireAuth);

maintenanceScheduleRouter.get("/", ctrl.getAll);
maintenanceScheduleRouter.get("/:id", ctrl.getById);

// Preview xoá: phân nhóm WO liên quan để UI quyết định popup hiển thị (1 hay 2 nhánh).
maintenanceScheduleRouter.get(
  "/:id/delete-preview",
  requirePermission("MAINTENANCE_PLAN", "DELETE"),
  ctrl.getDeletePreview,
);

maintenanceScheduleRouter.post(
  "/",
  requirePermission("MAINTENANCE_PLAN", "CREATE"),
  validate(createScheduleSchema),
  ctrl.create,
);
maintenanceScheduleRouter.put(
  "/:id",
  requirePermission("MAINTENANCE_PLAN", "UPDATE"),
  validate(updateScheduleSchema),
  ctrl.update,
);
maintenanceScheduleRouter.patch(
  "/:id/status",
  requirePermission("MAINTENANCE_PLAN", "UPDATE"),
  ctrl.updateStatus,
);
maintenanceScheduleRouter.delete(
  "/:id",
  requirePermission("MAINTENANCE_PLAN", "DELETE"),
  ctrl.remove,
);

// Tạo WO từ lịch định kỳ (không áp dụng lịch HOURS — service trả 400)
maintenanceScheduleRouter.post(
  "/:id/generate-work-order",
  requirePermission("WORK_ORDER", "CREATE"),
  ctrl.generateWorkOrder,
);

// Gửi duyệt: DRAFT|REJECTED → log + Status PENDING_APPROVAL → TC duyệt → PENDING
maintenanceScheduleRouter.post(
  "/:id/submit",
  requirePermission("MAINTENANCE_PLAN", "SUBMIT"),
  ctrl.submitForApproval,
);
