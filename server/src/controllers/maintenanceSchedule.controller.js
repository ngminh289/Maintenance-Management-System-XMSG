/**
 * maintenanceSchedule.controller.js — HTTP handler: /api/maintenance-schedules.
 * Liên quan: services/maintenanceSchedule.service.js, routes/maintenanceSchedule.routes.js.
 */
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import * as service from "../services/maintenanceSchedule.service.js";

export const getAll = asyncHandler(async (req, res) =>
  ok(res, await service.getAll(req.query)),
);

export const getById = asyncHandler(async (req, res) =>
  ok(res, await service.getById(req.params.id)),
);

export const create = asyncHandler(async (req, res) =>
  ok(res, await service.create(req.body, req.user.sub), 201),
);

export const update = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.update(req.params.id, req.body, {
      actorLevel: req.user.positionLevel,
    }),
  ),
);

export const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id, { actorLevel: req.user.positionLevel });
  return ok(res, { message: "Đã xóa lịch bảo trì." });
});

export const updateStatus = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.updateStatus(req.params.id, req.body.status, {
      actorLevel: req.user.positionLevel,
    }),
  ),
);

export const generateWorkOrder = asyncHandler(async (req, res) =>
  ok(res, await service.generateWorkOrder(req.params.id, req.user.sub), 201),
);

export const submitForApproval = asyncHandler(async (req, res) =>
  ok(res, await service.submitForApproval(req.params.id, req.user.sub)),
);
