/**
 * workOrder.controller.js — HTTP handler: /api/work-orders.
 * Liên quan: services/workOrder.service.js, routes/workOrder.routes.js.
 * saveClosureNotesDraft / resetRuntimeBaselineForCorrective: quyền chi tiết trong service (phân công / TC+).
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

export const getById = asyncHandler(async (req, res) =>
  ok(res, await service.getById(req.params.id)),
);

export const create = asyncHandler(async (req, res) =>
  ok(res, await service.create(req.body, req.user.sub), 201),
);

export const update = asyncHandler(async (req, res) =>
  ok(res, await service.update(req.params.id, req.body)),
);

export const changeStatus = asyncHandler(async (req, res) => {
  const result = await service.changeStatus(req.params.id, req.body.status, {
    actorLevel: req.user.positionLevel,
    actualHours: req.body.actualHours,
    employeeId: req.user.sub,
    closureFieldNotes: req.body.closureFieldNotes,
    closurePartsNotes: req.body.closurePartsNotes,
  });
  return ok(res, result);
});

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
  ok(
    res,
    await service.assign(Number(req.params.id), Number(req.body.employeeId), {
      actorLevel: req.user.positionLevel,
    }),
  ),
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
  await service.remove(req.params.id);
  return ok(res, { message: "Đã xóa phiếu công việc." });
});
