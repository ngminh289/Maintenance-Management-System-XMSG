/**
 * maintenanceGroup.controller.js — HTTP handler: /api/maintenance-groups.
 * GroupMembers mở rộng: specialty, notes (migration 043), IsGroupLeader (migration 045).
 * Liên quan: services/maintenanceGroup.service.js.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/maintenanceGroup.service.js';

export const getAll   = asyncHandler(async (req, res) => ok(res, await service.getAll()));
export const getById  = asyncHandler(async (req, res) => ok(res, await service.getById(req.params.id)));
export const create   = asyncHandler(async (req, res) => ok(res, await service.create(req.body), 201));
export const update   = asyncHandler(async (req, res) => ok(res, await service.update(req.params.id, req.body)));
export const remove   = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  return ok(res, { message: 'Đã xóa nhóm.' });
});

export const addMember = asyncHandler(async (req, res) =>
  ok(res, await service.addMember(
    req.params.id,
    Number(req.body.employeeId),
    { roleNotes: req.body.roleNotes, specialty: req.body.specialty, notes: req.body.notes },
  )));

export const updateMember = asyncHandler(async (req, res) =>
  ok(res, await service.updateMember(
    req.params.id,
    req.params.employeeId,
    { specialty: req.body.specialty, notes: req.body.notes, roleNotes: req.body.roleNotes },
  )));

export const removeMember = asyncHandler(async (req, res) =>
  ok(res, await service.removeMember(req.params.id, req.params.employeeId)));

export const setGroupLeader = asyncHandler(async (req, res) =>
  ok(res, await service.setGroupLeader(
    req.params.id,
    Number(req.body.employeeId),
  )));

export const assignGroupToWO = asyncHandler(async (req, res) =>
  ok(res, await service.assignGroupToWO(req.params.id, Number(req.params.woId))));
