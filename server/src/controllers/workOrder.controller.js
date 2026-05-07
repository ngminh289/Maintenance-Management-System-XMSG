/**
 * workOrder.controller.js — HTTP handler: /api/work-orders.
 * Phân công cá nhân: POST /:id/assign { employeeId }.
 * Phân công nhóm: POST /:id/assign-group { groupId, leaderId }.
 * Trưởng nhóm (IsGroupLeader=1): bắt đầu phiếu + ghi chú vật tư.
 * Liên quan: services/workOrder.service.js, routes/workOrder.routes.js.
 */
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import * as service from "../services/workOrder.service.js";

export const getAll = asyncHandler(async (req, res) => {
  // KTV (level 1) và Operator (level 1) chỉ xem WO được giao cho mình
  const query = { ...req.query };
  if (req.user.positionLevel <= 1) {
    query.assignedTo = req.user.sub;
  }
  return ok(res, await service.getAll(query));
});

/** GET /work-orders/archived — chỉ Admin (route đã chặn). */
export const getArchived = asyncHandler(async (req, res) =>
  ok(res, await service.getArchived(req.query)),
);

export const getById = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.getById(req.params.id, {
      employeeId: req.user.sub,
      positionLevel: req.user.positionLevel,
      positionId: req.user.positionId,
    }),
  ),
);

export const create = asyncHandler(async (req, res) =>
  ok(res, await service.create(req.body, req.user.sub), 201),
);

export const update = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.update(req.params.id, req.body, {
      actorLevel: req.user.positionLevel,
      actorPositionId: req.user.positionId,
    }),
  ),
);

export const changeStatus = asyncHandler(async (req, res) => {
  const result = await service.changeStatus(req.params.id, req.body.status, {
    actorLevel: req.user.positionLevel,
    actualHours: req.body.actualHours,
    employeeId: req.user.sub,
    closureFieldNotes: req.body.closureFieldNotes,
    closurePartsNotes: req.body.closurePartsNotes,
    requiresShutdown: req.body.requiresShutdown,
    shutdownReason: req.body.shutdownReason,
  });
  return ok(res, result);
});

export const setPowerState = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.setWorkOrderPowerState(req.params.id, req.body.action, {
      employeeId: req.user.sub,
      actorLevel: req.user.positionLevel,
      reason: req.body.reason,
    }),
  ),
);

export const saveClosureNotesDraft = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.saveClosureNotesDraft(req.params.id, {
      employeeId: req.user.sub,
      actorLevel: req.user.positionLevel,
      closureFieldNotes: req.body.closureFieldNotes,
      closurePartsNotes: req.body.closurePartsNotes,
    }),
  ),
);

export const resetRuntimeBaselineForCorrective = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.resetRuntimeBaselineForCorrective(req.params.id, {
      employeeId: req.user.sub,
      actorLevel: req.user.positionLevel,
    }),
  ),
);

export const addPhotos = asyncHandler(async (req, res) => {
  const photos = await service.addWorkOrderPhotos(
    Number(req.params.id),
    req.files || [],
    {
      employeeId: req.user.sub,
      actorLevel: req.user.positionLevel,
    },
  );
  return ok(res, photos, 201);
});

export const deletePhoto = asyncHandler(async (req, res) => {
  const photos = await service.deleteWorkOrderPhoto(
    Number(req.params.id),
    Number(req.params.photoId),
    { employeeId: req.user.sub, actorLevel: req.user.positionLevel },
  );
  return ok(res, photos);
});

export const assign = asyncHandler(async (req, res) =>
  ok(res, await service.assign(Number(req.params.id), Number(req.body.employeeId), {
    actorLevel: req.user.positionLevel,
  })),
);

/** POST /:id/assign-group { groupId, leaderId } — phân công nhóm với trưởng nhóm. */
export const assignGroup = asyncHandler(async (req, res) =>
  ok(res, await service.assignGroup(
    Number(req.params.id),
    Number(req.body.groupId),
    { actorLevel: req.user.positionLevel },
  )),
);

export const unassign = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.unassign(
      Number(req.params.id),
      Number(req.params.employeeId),
      {
        actorLevel: req.user.positionLevel,
      },
    ),
  ),
);

export const remove = asyncHandler(async (req, res) => {
  const result = await service.remove(req.params.id, {
    actorPositionId: req.user.positionId,
    actorEmployeeId: req.user.sub,
  });
  return ok(res, {
    ...result,
    message: "Đã chuyển phiếu vào lưu trữ.",
  });
});

/** POST /work-orders/:id/restore — chỉ Admin (positionId = 4). */
export const restore = asyncHandler(async (req, res) => {
  const wo = await service.restore(req.params.id, {
    actorPositionId: req.user.positionId,
  });
  return ok(res, { ...wo, message: "Đã khôi phục phiếu việc." });
});
