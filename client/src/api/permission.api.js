/**
 * permission.api.js — API quản trị phân quyền Roles_Permissions.
 * Chỉ Admin (level >= 4) được phép đọc/cấp/thu hồi quyền.
 */
import { api } from "./index.js";

export const permissionApi = {
  getAll: (positionId) =>
    api.get("/permissions", { params: positionId ? { positionId } : undefined }),
  grant: (payload) => api.post("/permissions", payload),
  revoke: (permissionId) => api.delete(`/permissions/${permissionId}`),
};

