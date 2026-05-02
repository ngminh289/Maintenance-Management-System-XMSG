/**
 * employee.api.js — REST nhân viên + ảnh đại diện + nhóm bảo trì.
 * Trường mới: craftLevel, specialty, experienceNotes, photoPath (migration 043).
 * Ảnh: PATCH /:id/photo — chính mình hoặc EMPLOYEE:UPDATE.
 */
import { api } from "./index.js";

export const employeeApi = {
  getAll:      (params) => api.get("/employees", { params }),
  getById:     (id)     => api.get(`/employees/${id}`),
  create:      (data)   => api.post("/employees", data),
  update:      (id, d)  => api.put(`/employees/${id}`, d),
  deactivate:  (id)     => api.patch(`/employees/${id}/deactivate`),
  activate:    (id)     => api.patch(`/employees/${id}/activate`),
  changePassword: (id, data) => api.patch(`/employees/${id}/password`, data),
  /** { leaveStartAt, leaveEndAt } hoặc { clear: true } */
  updateLeaveSchedule: (id, data) => api.patch(`/employees/${id}/leave-schedule`, data),

  /** Upload ảnh đại diện — field: "photo" (JPG/PNG/WEBP ≤ 5MB) */
  uploadPhoto: (id, formData) => api.patch(`/employees/${id}/photo`, formData),

  /** photoPath dạng "uploads/employees/abc.jpg" → URL tuyệt đối */
  getPhotoUrl: (photoPath) => {
    if (!photoPath) return null;
    const p = String(photoPath).trim();
    if (/^https?:\/\//i.test(p)) return p;
    const origin = (import.meta.env.VITE_API_BASE || 'http://localhost:4000/api')
      .replace(/\/?api\/?$/, '');
    return `${origin}/${p.replace(/^\/+/, '')}`;
  },

  // Master data
  getDepartments: () => api.get("/departments"),
  getPositions:   () => api.get("/positions"),
};
