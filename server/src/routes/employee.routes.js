/**
 * employee.routes.js — /api/employees.
 * Trường mở rộng: craftLevel, specialty, experienceNotes (migration 043).
 * PATCH /:id/photo — chính mình HOẶC EMPLOYEE:UPDATE (middleware inject hasUpdatePermission).
 * PATCH /:id/leave-schedule — Level chức vụ ≥ 4.
 * Vô hiệu/kích hoạt: EMPLOYEE:DELETE.
 */
import { Router } from "express";
import { requireAuth }       from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { requireLevel }      from "../middleware/requireRole.js";
import { validate }          from "../middleware/validate.js";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  changePasswordSchema,
  leaveScheduleSchema,
} from "../validators/employee.validator.js";
import { uploadEmployeePhoto }   from "../config/upload.js";
import { cloudinaryAfterSingle } from "../middleware/cloudinaryUpload.middleware.js";
import { hasPermission }         from "../middleware/requirePermission.js";
import { asyncHandler }          from "../utils/asyncHandler.js";
import * as ctrl from "../controllers/employee.controller.js";

export const employeeRouter = Router();

employeeRouter.use(requireAuth);

employeeRouter.get("/", requirePermission("EMPLOYEE", "READ"), ctrl.getAll);
employeeRouter.get("/:id", requirePermission("EMPLOYEE", "READ"), ctrl.getById);

employeeRouter.post("/",
  requirePermission("EMPLOYEE", "CREATE"),
  validate(createEmployeeSchema),
  ctrl.create,
);
employeeRouter.put("/:id",
  requirePermission("EMPLOYEE", "UPDATE"),
  validate(updateEmployeeSchema),
  ctrl.update,
);

// Vô hiệu / kích hoạt
employeeRouter.patch("/:id/deactivate", requirePermission("EMPLOYEE", "DELETE"), ctrl.deactivate);
employeeRouter.patch("/:id/activate",   requirePermission("EMPLOYEE", "DELETE"), ctrl.activate);

// Lịch nghỉ phép
employeeRouter.patch("/:id/leave-schedule", requireLevel(4), validate(leaveScheduleSchema), ctrl.patchLeaveSchedule);

// Đổi mật khẩu
employeeRouter.patch("/:id/password", validate(changePasswordSchema), ctrl.changePassword);

/**
 * Upload ảnh đại diện — chính mình hoặc EMPLOYEE:UPDATE.
 * Middleware: inject req.hasUpdatePermission → service tự kiểm tra quyền.
 */
employeeRouter.patch(
  "/:id/photo",
  uploadEmployeePhoto.single("photo"),
  cloudinaryAfterSingle("warehouse/employees", "image"),
  asyncHandler(async (req, _res, next) => {
    req.hasUpdatePermission = await hasPermission(req.user?.positionId, "EMPLOYEE", "UPDATE");
    next();
  }),
  ctrl.updatePhoto,
);
