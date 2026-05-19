/**
 * EmployeesPage.jsx — Quản lý nhân viên + nhóm bảo trì.
 * Trường mới: CraftLevel (Bậc thợ), Specialty (Chuyên môn), ExperienceNotes, PhotoPath (migration 043).
 * GroupMembers: Specialty, Notes.
 * Ảnh đại diện: nhân viên tự cập nhật ảnh của mình; admin cập nhật cho bất kỳ ai.
 * Admin (Level ≥ 4 hoặc EMPLOYEE:UPDATE): thêm/sửa/xóa trường kỹ năng.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../../api/index.js";
import { employeeApi } from "../../api/employee.api.js";
import { Button } from "../../components/ui/Button.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Input, Select, Textarea } from "../../components/ui/Input.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { Pagination } from "../../components/ui/Pagination.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { PageLoader } from "../../components/ui/Spinner.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { canAccess, canDo } from "../../utils/rbac.js";
import { departmentIdForPosition } from "../../utils/orgUnits.js";
import { fDateTime } from "../../utils/format.js";
import {
  Plus,
  UserCheck,
  UserX,
  Search,
  Users,
  User2,
  Trash2,
  UserPlus,
  CalendarClock,
  Camera,
  Pencil,
  Crown,
} from "lucide-react";
import { EmployeeCard } from "../../components/ui/EmployeeCard.jsx";
import toast from "react-hot-toast";

const CRAFT_LEVELS = [1, 2, 3, 4, 5, 6, 7];

function toDatetimeLocalValue(v) {
  if (v == null || v === "") return "";
  const s = String(v).replace(" ", "T");
  return s.length >= 16 ? s.slice(0, 16) : s;
}

function isOnScheduledLeave(emp) {
  return Boolean(emp?.onScheduledLeave);
}

/** Avatar nhân viên: ảnh thật hoặc chữ cái đầu */
function EmpAvatar({ emp, size = "md" }) {
  const photoUrl = emp?.photoPath
    ? employeeApi.getPhotoUrl(emp.photoPath)
    : null;
  const cls =
    size === "sm"
      ? "w-7 h-7 text-xs"
      : size === "lg"
        ? "w-14 h-14 text-xl"
        : "w-8 h-8 text-sm";
  return photoUrl ? (
    <img
      src={photoUrl}
      alt={emp.fullName}
      className={`${cls} rounded-full object-cover flex-shrink-0 border border-gray-200`}
    />
  ) : (
    <div
      className={`${cls} rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 flex-shrink-0`}
    >
      {emp?.fullName?.[0] ?? "?"}
    </div>
  );
}

// ─── Modal chỉnh sửa nhân viên (admin) ─────────────────────────────────────
function EditEmployeeModal({
  emp,
  positions,
  departments,
  open,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (emp) {
      const pid = emp.positionId ?? "";
      const dept = emp.departmentId != null ? String(emp.departmentId) : "";
      setForm({
        fullName: emp.fullName ?? "",
        phone: emp.phone ?? "",
        positionId: String(pid),
        departmentId: dept,
        craftLevel: emp.craftLevel ?? "",
        specialty: emp.specialty ?? "",
        experienceNotes: emp.experienceNotes ?? "",
      });
    }
  }, [emp]);

  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName?.trim()) {
      setErrors({ fullName: "Bắt buộc" });
      return;
    }
    setSaving(true);
    try {
      await employeeApi.update(emp.employeeId, {
        fullName: form.fullName,
        phone: form.phone || null,
        positionId: form.positionId ? Number(form.positionId) : undefined,
        craftLevel: form.craftLevel ? Number(form.craftLevel) : null,
        specialty: form.specialty || null,
        experienceNotes: form.experienceNotes || null,
      });
      toast.success("Đã cập nhật thông tin nhân viên");
      onSaved?.();
      onClose?.();
    } catch (err) {
      setErrors({ _: err.response?.data?.message ?? "Lỗi lưu" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Sửa: ${emp?.fullName ?? ""}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Họ tên *"
            value={form.fullName ?? ""}
            onChange={(e) => setF("fullName", e.target.value)}
            error={errors.fullName}
          />
          <Input
            label="Số điện thoại"
            value={form.phone ?? ""}
            onChange={(e) => setF("phone", e.target.value)}
          />
          <Select
            label="Chức vụ"
            value={form.positionId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) {
                setForm((p) => ({
                  ...p,
                  positionId: "",
                  departmentId:
                    emp?.departmentId != null ? String(emp.departmentId) : "",
                }));
                return;
              }
              const deptId = departmentIdForPosition(Number(v));
              setForm((p) => ({
                ...p,
                positionId: v,
                departmentId: deptId != null ? String(deptId) : "",
              }));
            }}
          >
            <option value="">— Giữ nguyên —</option>
            {positions.map((p) => (
              <option key={p.positionId} value={p.positionId}>
                {p.positionName}
              </option>
            ))}
          </Select>
          <Input
            label="Phòng ban (theo chức vụ)"
            value={
              form.departmentId
                ? (departments.find(
                    (d) => String(d.departmentId) === String(form.departmentId),
                  )?.departmentName ?? "—")
                : ""
            }
            readOnly
            placeholder="Chọn chức vụ"
          />
          <Select
            label="Bậc thợ"
            value={form.craftLevel ?? ""}
            onChange={(e) => setF("craftLevel", e.target.value)}
          >
            <option value="">— Không có —</option>
            {CRAFT_LEVELS.map((l) => (
              <option key={l} value={l}>
                Bậc {l}
              </option>
            ))}
          </Select>
        </div>
        <Input
          label="Chuyên môn"
          value={form.specialty ?? ""}
          onChange={(e) => setF("specialty", e.target.value)}
          placeholder="VD: Cơ khí, Điện, Hàn, Khí nén..."
        />
        <Textarea
          label="Ghi chú kinh nghiệm / chứng chỉ"
          value={form.experienceNotes ?? ""}
          onChange={(e) => setF("experienceNotes", e.target.value)}
          placeholder="Kinh nghiệm, chứng chỉ, kỹ năng đặc biệt..."
          rows={3}
        />
        {errors._ && (
          <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
            {errors._}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={saving}>
            Lưu
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal upload ảnh đại diện ──────────────────────────────────────────────
function PhotoModal({ emp, open, onClose, onSaved }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setFile(null);
    }
  }, [open]);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Chọn ảnh trước");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      await employeeApi.uploadPhoto(emp.employeeId, fd);
      toast.success("Đã cập nhật ảnh đại diện");
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi upload ảnh");
    } finally {
      setUploading(false);
    }
  };

  const currentPhoto = emp?.photoPath
    ? employeeApi.getPhotoUrl(emp.photoPath)
    : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cập nhật ảnh đại diện"
      size="sm"
    >
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3">
          {preview || currentPhoto ? (
            <img
              src={preview ?? currentPhoto}
              alt="Preview"
              className="w-28 h-28 rounded-full object-cover border-2 border-blue-200 shadow"
            />
          ) : (
            <div className="w-28 h-28 rounded-full bg-blue-100 flex items-center justify-center text-4xl font-bold text-blue-400">
              {emp?.fullName?.[0] ?? "?"}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handleFile}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 text-sm text-blue-600 font-medium hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5"
          >
            <Camera size={15} /> Chọn ảnh (JPG/PNG/WEBP ≤ 5MB)
          </button>
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleUpload} loading={uploading} disabled={!file}>
            Lưu ảnh
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Tab nhân viên ──────────────────────────────────────────────────────────
function EmployeesTab({ me }) {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [craftLevelFilter, setCraftLevelFilter] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [photoEmp, setPhotoEmp] = useState(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveEmp, setLeaveEmp] = useState(null);
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveSaving, setLeaveSaving] = useState(false);

  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const LIMIT = 15;

  const canAdminLeave = (me?.positionLevel ?? 0) >= 4;
  const canEditEmployee = canDo(me, "EMPLOYEE:UPDATE");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await employeeApi.getAll({
        page,
        limit: LIMIT,
        ...(search && { search }),
        ...(specialtyFilter && { specialty: specialtyFilter }),
        ...(craftLevelFilter && { craftLevel: craftLevelFilter }),
      });
      setEmployees(res.data.data?.items ?? []);
      setTotal(res.data.data?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, search, specialtyFilter, craftLevelFilter]);

  useEffect(() => {
    Promise.all([employeeApi.getDepartments(), employeeApi.getPositions()])
      .then(([d, p]) => {
        setDepartments(d.data.data ?? []);
        setPositions(p.data.data ?? []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const statusLabel = (emp) => {
    if (emp.isActive) return { text: "Hoạt động", color: "green" };
    if (!emp.emailVerified) return { text: "Chưa xác thực", color: "yellow" };
    if (!emp.wasEverActivated) return { text: "Chờ duyệt", color: "orange" };
    return { text: "Vô hiệu", color: "gray" };
  };

  const handleToggle = async (emp) => {
    if (emp.employeeId === me?.employeeId) {
      toast.error("Không thể vô hiệu hóa chính mình");
      return;
    }
    try {
      if (emp.isActive) await employeeApi.deactivate(emp.employeeId);
      else await employeeApi.activate(emp.employeeId);
      toast.success(emp.isActive ? "Đã vô hiệu hóa" : "Đã kích hoạt");
      load();
    } catch {
      toast.error("Lỗi cập nhật");
    }
  };

  const setF = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.fullName) errs.fullName = "Bắt buộc";
    if (!form.username) errs.username = "Bắt buộc";
    if (!form.email) errs.email = "Bắt buộc";
    if (!form.password) errs.password = "Bắt buộc";
    if (!form.positionId) errs.positionId = "Bắt buộc";
    if (!form.departmentId) errs.departmentId = "Bắt buộc";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      const pid = Number(form.positionId);
      const departmentId = departmentIdForPosition(pid);
      if (departmentId == null) {
        setErrors({ _: "Chức vụ không gắn được phòng ban" });
        setSaving(false);
        return;
      }
      await employeeApi.create({ ...form, positionId: pid, departmentId });
      toast.success("Đã thêm nhân viên");
      setCreateOpen(false);
      setForm({});
      load();
    } catch (err) {
      setErrors({ _: err.response?.data?.message ?? "Lỗi tạo nhân viên" });
    } finally {
      setSaving(false);
    }
  };

  const openLeaveModal = (emp) => {
    setLeaveEmp(emp);
    setLeaveStart(toDatetimeLocalValue(emp.leaveStartAt));
    setLeaveEnd(toDatetimeLocalValue(emp.leaveEndAt));
    setLeaveOpen(true);
  };

  const submitLeaveSchedule = async () => {
    if (!leaveEmp) return;
    if (!leaveStart || !leaveEnd) {
      toast.error("Chọn đủ thời gian");
      return;
    }
    setLeaveSaving(true);
    try {
      await employeeApi.updateLeaveSchedule(leaveEmp.employeeId, {
        leaveStartAt: leaveStart,
        leaveEndAt: leaveEnd,
      });
      toast.success("Đã lưu lịch nghỉ");
      setLeaveOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi");
    } finally {
      setLeaveSaving(false);
    }
  };

  const clearLeaveSchedule = async () => {
    if (!leaveEmp || !window.confirm("Xóa lịch nghỉ phép đã thiết lập?"))
      return;
    setLeaveSaving(true);
    try {
      await employeeApi.updateLeaveSchedule(leaveEmp.employeeId, {
        clear: true,
      });
      toast.success("Đã xóa lịch");
      setLeaveOpen(false);
      load();
    } catch {
      toast.error("Lỗi");
    } finally {
      setLeaveSaving(false);
    }
  };

  const canSelfPhoto = (emp) => me?.employeeId === emp.employeeId;

  return (
    <div className="space-y-4">
      {canAdminLeave && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/90 px-4 py-3 text-sm text-violet-950">
          <p className="font-semibold text-violet-900 mb-1">
            Lịch nghỉ phép (Quản trị viên)
          </p>
          <p className="leading-relaxed text-violet-900/90">
            Thiết lập <strong>từ giờ → đến giờ</strong>. Trong khoảng đó không
            phân công phiếu việc. Tự làm mới mỗi phút.
          </p>
        </div>
      )}

      {/* Thanh tìm kiếm + lọc */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            placeholder="Tìm tên, email, username, chuyên môn..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
        <input
          placeholder="Lọc chuyên môn..."
          value={specialtyFilter}
          onChange={(e) => {
            setSpecialtyFilter(e.target.value);
            setPage(1);
          }}
          className="w-40 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        />
        <select
          value={craftLevelFilter}
          onChange={(e) => {
            setCraftLevelFilter(e.target.value);
            setPage(1);
          }}
          className="w-36 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        >
          <option value="">Tất cả bậc</option>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={n}>
              Bậc thợ {n}
            </option>
          ))}
        </select>
        {canDo(me, "EMPLOYEE:CREATE") && (
          <Button
            onClick={() => {
              setForm({});
              setErrors({});
              setCreateOpen(true);
            }}
          >
            <Plus size={15} /> Thêm nhân viên
          </Button>
        )}
      </div>

      {/* Bảng nhân viên */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : employees.length === 0 ? (
          <EmptyState title="Không có nhân viên" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    "Nhân viên",
                    "Chức vụ / Bậc thợ",
                    "Chuyên môn",
                    "Phòng ban",
                    "Trạng thái",
                    "Nghỉ phép",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-bold text-gray-700 uppercase tracking-wide px-4 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map((emp) => {
                  const st = statusLabel(emp);
                  return (
                    <tr
                      key={emp.employeeId}
                      className={`hover:bg-gray-50 transition-colors ${!emp.isActive ? "opacity-50" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <EmployeeCard emp={emp} side="right">
                          <div className="flex items-center gap-3 cursor-default">
                            <div className="relative group">
                              <EmpAvatar emp={emp} />
                              {(canSelfPhoto(emp) || canEditEmployee) && (
                                <button
                                  type="button"
                                  onClick={() => setPhotoEmp(emp)}
                                  className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Cập nhật ảnh"
                                >
                                  <Camera size={12} className="text-white" />
                                </button>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {emp.fullName}
                              </p>
                              <p className="text-xs font-medium text-gray-500">
                                @{emp.username}
                              </p>
                            </div>
                          </div>
                        </EmployeeCard>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">
                          {emp.positionName}
                        </p>
                        {emp.craftLevel && (
                          <span className="text-xs text-blue-600 font-semibold">
                            Bậc {emp.craftLevel}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[180px]">
                        {emp.specialty ? (
                          <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full">
                            {emp.specialty}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-700">
                        {emp.departmentName}
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={st.color}>{st.text}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1.5 max-w-[200px]">
                          {isOnScheduledLeave(emp) ? (
                            <Badge color="orange">Đang nghỉ (lịch)</Badge>
                          ) : emp.leaveStartAt && emp.leaveEndAt ? (
                            <Badge color="gray">Chưa tới / đã hết</Badge>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                          {emp.leaveStartAt && emp.leaveEndAt && (
                            <p className="text-[11px] text-gray-600 leading-snug">
                              {fDateTime(emp.leaveStartAt)} →{" "}
                              {fDateTime(emp.leaveEndAt)}
                            </p>
                          )}
                          {canAdminLeave &&
                            emp.employeeId !== me?.employeeId && (
                              <button
                                type="button"
                                onClick={() => openLeaveModal(emp)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900"
                              >
                                <CalendarClock size={14} /> Đặt lịch nghỉ
                              </button>
                            )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {canEditEmployee && (
                            <button
                              type="button"
                              title="Sửa thông tin"
                              onClick={() => setEditEmp(emp)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400 hover:text-blue-600 transition-colors"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          {canDo(me, "EMPLOYEE:DELETE") &&
                            emp.employeeId !== me?.employeeId && (
                              <button
                                type="button"
                                title={
                                  emp.isActive ? "Vô hiệu hóa" : "Kích hoạt"
                                }
                                onClick={() => handleToggle(emp)}
                                className={`p-1.5 rounded-lg transition-colors ${emp.isActive ? "hover:bg-red-50 text-red-400" : "hover:bg-green-50 text-green-500"}`}
                              >
                                {emp.isActive ? (
                                  <UserX size={14} />
                                ) : (
                                  <UserCheck size={14} />
                                )}
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pagination
        page={page}
        totalPages={Math.ceil(total / LIMIT)}
        onChange={setPage}
      />

      {/* Modal thêm nhân viên */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Thêm nhân viên mới"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Họ tên *"
              value={form.fullName ?? ""}
              onChange={(e) => setF("fullName", e.target.value)}
              error={errors.fullName}
            />
            <Input
              label="Tên đăng nhập *"
              value={form.username ?? ""}
              onChange={(e) => setF("username", e.target.value)}
              error={errors.username}
            />
            <Input
              label="Email *"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setF("email", e.target.value)}
              error={errors.email}
            />
            <Input
              label="Mật khẩu *"
              type="password"
              value={form.password ?? ""}
              onChange={(e) => setF("password", e.target.value)}
              error={errors.password}
            />
            <Input
              label="Số điện thoại"
              value={form.phone ?? ""}
              onChange={(e) => setF("phone", e.target.value)}
            />
            <Select
              label="Chức vụ *"
              value={form.positionId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                const deptId = v ? departmentIdForPosition(Number(v)) : null;
                setForm((p) => ({
                  ...p,
                  positionId: v,
                  departmentId: deptId != null ? String(deptId) : "",
                }));
                setErrors((er) => ({
                  ...er,
                  positionId: undefined,
                  departmentId: undefined,
                }));
              }}
              error={errors.positionId}
            >
              <option value="">— Chọn chức vụ —</option>
              {positions.map((p) => (
                <option key={p.positionId} value={p.positionId}>
                  {p.positionName}
                </option>
              ))}
            </Select>
            <Input
              label="Phòng ban (theo chức vụ)"
              value={
                form.departmentId
                  ? (departments.find(
                      (d) =>
                        String(d.departmentId) === String(form.departmentId),
                    )?.departmentName ?? "—")
                  : ""
              }
              readOnly
              placeholder="Chọn chức vụ trước"
              error={errors.departmentId}
            />
            <Select
              label="Bậc thợ"
              value={form.craftLevel ?? ""}
              onChange={(e) => setF("craftLevel", e.target.value)}
            >
              <option value="">— Không có —</option>
              {CRAFT_LEVELS.map((l) => (
                <option key={l} value={l}>
                  Bậc {l}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="Chuyên môn"
            value={form.specialty ?? ""}
            onChange={(e) => setF("specialty", e.target.value)}
            placeholder="VD: Cơ khí, Điện, Hàn, Khí nén..."
          />
          <Textarea
            label="Ghi chú kinh nghiệm"
            value={form.experienceNotes ?? ""}
            onChange={(e) => setF("experienceNotes", e.target.value)}
            placeholder="Kinh nghiệm, chứng chỉ, kỹ năng..."
            rows={2}
          />
          {errors._ && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
              {errors._}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" loading={saving}>
              Thêm nhân viên
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal sửa thông tin */}
      <EditEmployeeModal
        emp={editEmp}
        positions={positions}
        departments={departments}
        open={!!editEmp}
        onClose={() => setEditEmp(null)}
        onSaved={load}
      />

      {/* Modal ảnh đại diện */}
      <PhotoModal
        emp={photoEmp}
        open={!!photoEmp}
        onClose={() => setPhotoEmp(null)}
        onSaved={load}
      />

      {/* Modal lịch nghỉ phép */}
      <Modal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title={`Lịch nghỉ — ${leaveEmp?.fullName ?? ""}`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            Chọn <strong>bắt đầu</strong> và <strong>kết thúc</strong>. Trong
            khoảng này nhân viên không được phân công.
          </p>
          <Input
            label="Bắt đầu nghỉ"
            type="datetime-local"
            value={leaveStart}
            onChange={(e) => setLeaveStart(e.target.value)}
          />
          <Input
            label="Kết thúc nghỉ"
            type="datetime-local"
            value={leaveEnd}
            onChange={(e) => setLeaveEnd(e.target.value)}
          />
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLeaveOpen(false)}
            >
              Đóng
            </Button>
            {leaveEmp?.leaveStartAt && leaveEmp?.leaveEndAt && (
              <Button
                type="button"
                variant="secondary"
                loading={leaveSaving}
                onClick={clearLeaveSchedule}
              >
                Xóa lịch
              </Button>
            )}
            <Button
              type="button"
              loading={leaveSaving}
              onClick={submitLeaveSchedule}
            >
              Lưu lịch
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Tab nhóm bảo trì ───────────────────────────────────────────────────────
function GroupsTab({ me }) {
  const canWriteGroup = canDo(me, "MAINTENANCE_GROUP:WRITE");
  const canDeleteGroup = canDo(me, "MAINTENANCE_GROUP:DELETE");
  const [groups, setGroups] = useState([]);
  const [allEmps, setAllEmps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailGrp, setDetailGrp] = useState(null);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({
    groupName: "",
    specialty: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [addEmpId, setAddEmpId] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [editMemberId, setEditMemberId] = useState(null);
  const [editMemberForm, setEditMemberForm] = useState({});
  const [settingLeader, setSettingLeader] = useState(false);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/maintenance-groups");
      setGroups(res.data.data?.items ?? res.data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
    employeeApi
      .getAll({ limit: 200 })
      .then((r) => setAllEmps(r.data.data?.items ?? []))
      .catch(() => {});
  }, [loadGroups]);

  const openDetail = async (grp) => {
    setDetailGrp(grp);
    const res = await api.get(`/maintenance-groups/${grp.groupId}`);
    setMembers(res.data.data?.members ?? []);
    setAddEmpId("");
    setAddSpecialty("");
    setAddNotes("");
    setEditMemberId(null);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.groupName.trim()) {
      toast.error("Tên nhóm bắt buộc");
      return;
    }
    setSaving(true);
    try {
      await api.post("/maintenance-groups", form);
      toast.success("Đã tạo nhóm");
      setCreateOpen(false);
      setForm({ groupName: "", specialty: "", description: "" });
      loadGroups();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (grp) => {
    if (
      !window.confirm(
        `Giải thể nhóm "${grp.groupName}"?\nNhóm sẽ bị ẩn khỏi danh sách và không thể phân công thêm.`,
      )
    )
      return;
    try {
      await api.delete(`/maintenance-groups/${grp.groupId}`);
      toast.success("Đã giải thể nhóm");
      loadGroups();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi");
    }
  };

  const handleAddMember = async () => {
    if (!addEmpId) {
      toast.error("Chọn nhân viên");
      return;
    }
    try {
      await api.post(`/maintenance-groups/${detailGrp.groupId}/members`, {
        employeeId: Number(addEmpId),
        notes: addNotes || null,
      });
      toast.success("Đã thêm thành viên");
      setAddEmpId("");
      setAddNotes("");
      await openDetail(detailGrp);
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi");
    }
  };

  const handleUpdateMember = async (empId) => {
    try {
      await api.patch(
        `/maintenance-groups/${detailGrp.groupId}/members/${empId}`,
        editMemberForm,
      );
      toast.success("Đã cập nhật thành viên");
      setEditMemberId(null);
      await openDetail(detailGrp);
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi");
    }
  };

  const handleRemoveMember = async (empId) => {
    try {
      await api.delete(
        `/maintenance-groups/${detailGrp.groupId}/members/${empId}`,
      );
      toast.success("Đã xóa thành viên");
      await openDetail(detailGrp);
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi");
    }
  };

  const handleSetLeader = async (empId) => {
    setSettingLeader(true);
    try {
      const res = await api.patch(
        `/maintenance-groups/${detailGrp.groupId}/leader`,
        { employeeId: empId },
      );
      setMembers(res.data.data ?? []);
      toast.success("Đã đặt trưởng nhóm");
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi");
    } finally {
      setSettingLeader(false);
    }
  };

  const availableEmps = allEmps.filter(
    (e) => !members.some((m) => m.employeeId === e.employeeId),
  );

  return (
    <div className="space-y-4">
      {canWriteGroup && (
        <div className="flex justify-end">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={15} /> Tạo nhóm mới
          </Button>
        </div>
      )}

      {loading ? (
        <PageLoader />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Chưa có nhóm bảo trì"
          description="Tạo nhóm để phân công theo đội"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <div
              key={g.groupId}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:border-blue-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Users size={16} className="text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {g.groupName}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500">
                        {g.memberCount ?? 0} thành viên
                      </span>
                      {g.specialty && (
                        <span className="text-xs text-indigo-600 font-medium">
                          · {g.specialty}
                        </span>
                      )}
                      {g.leaderName ? (
                        <span className="text-xs text-yellow-700">
                          · TN: {g.leaderName}
                        </span>
                      ) : (
                        <span className="text-xs text-orange-500">
                          · Chưa có trưởng nhóm
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {canDeleteGroup && Number(g.isActive) !== 0 && (
                  <button
                    type="button"
                    title="Giải thể nhóm"
                    onClick={() => handleDeleteGroup(g)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              {g.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                  {g.description}
                </p>
              )}
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => openDetail(g)}
              >
                <Users size={13} /> Xem thành viên
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Modal tạo nhóm */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tạo nhóm bảo trì"
        size="sm"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Tên nhóm *"
            value={form.groupName}
            onChange={(e) =>
              setForm((p) => ({ ...p, groupName: e.target.value }))
            }
            placeholder="VD: Nhóm cơ khí tổ 1"
          />
          <Input
            label="Chuyên môn tổng"
            value={form.specialty}
            onChange={(e) =>
              setForm((p) => ({ ...p, specialty: e.target.value }))
            }
            placeholder="VD: Cơ khí, Điện, Hàn..."
          />
          <Textarea
            label="Mô tả"
            value={form.description}
            onChange={(e) =>
              setForm((p) => ({ ...p, description: e.target.value }))
            }
            placeholder="Mô tả nhiệm vụ..."
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" loading={saving}>
              Tạo nhóm
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal thành viên */}
      <Modal
        open={!!detailGrp}
        onClose={() => setDetailGrp(null)}
        title={`Nhóm: ${detailGrp?.groupName ?? ""}`}
        size="lg"
      >
        {detailGrp && (
          <div className="space-y-5">
            {/* Thông tin nhóm */}
            {(detailGrp.specialty || detailGrp.description) && (
              <div className="flex flex-wrap gap-3 text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-2.5">
                {detailGrp.specialty && (
                  <span className="text-indigo-700 font-medium">
                    Chuyên môn: {detailGrp.specialty}
                  </span>
                )}
                {detailGrp.description && <span>{detailGrp.description}</span>}
              </div>
            )}
            {/* Danh sách thành viên */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Thành viên ({members.length})
              </h4>
              {members.length === 0 ? (
                <p className="text-sm text-gray-400 bg-gray-50 rounded-lg px-4 py-3">
                  Chưa có thành viên
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {members.map((m) => {
                    const isLeader = Number(m.isGroupLeader) === 1;
                    return (
                      <div
                        key={m.employeeId}
                        className={`rounded-xl px-3 py-2.5 ${isLeader ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <EmpAvatar
                              emp={{
                                fullName: m.fullName,
                                photoPath: m.photoPath,
                              }}
                              size="sm"
                            />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-gray-800">
                                  {m.fullName}
                                </p>
                                {isLeader && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-yellow-500 text-white px-1.5 py-0.5 rounded uppercase tracking-wide">
                                    <Crown size={9} /> Trưởng nhóm
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs text-gray-500">
                                  {m.positionName}
                                </p>
                                {m.empSpecialty && (
                                  <span className="text-xs text-indigo-600">
                                    · {m.empSpecialty}
                                  </span>
                                )}
                                {m.craftLevel && (
                                  <span className="text-xs text-blue-600 font-medium">
                                    Bậc {m.craftLevel}
                                  </span>
                                )}
                              </div>
                              {m.notes && (
                                <div className="mt-1 text-xs text-gray-500 italic">
                                  {m.notes}
                                </div>
                              )}
                            </div>
                          </div>
                          {canWriteGroup && (
                            <div className="flex gap-1 flex-shrink-0">
                              {!isLeader && (
                                <button
                                  type="button"
                                  title="Đặt làm trưởng nhóm"
                                  onClick={() => handleSetLeader(m.employeeId)}
                                  disabled={settingLeader}
                                  className="p-1 rounded hover:bg-yellow-100 text-yellow-500 disabled:opacity-50"
                                >
                                  <Crown size={13} />
                                </button>
                              )}
                              <button
                                type="button"
                                title="Sửa ghi chú"
                                onClick={() => {
                                  setEditMemberId(m.employeeId);
                                  setEditMemberForm({ notes: m.notes ?? "" });
                                }}
                                className="p-1 rounded hover:bg-blue-100 text-blue-400"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(m.employeeId)}
                                className="p-1 rounded hover:bg-red-100 text-red-400"
                              >
                                <UserX size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                        {/* Inline edit ghi chú vai trò */}
                        {editMemberId === m.employeeId && (
                          <div className="mt-2 pt-2 border-t border-gray-200 space-y-2">
                            <Textarea
                              label="Ghi chú vai trò"
                              value={editMemberForm.notes ?? ""}
                              onChange={(e) =>
                                setEditMemberForm((p) => ({
                                  ...p,
                                  notes: e.target.value,
                                }))
                              }
                              rows={2}
                              placeholder="Vai trò, trách nhiệm đặc biệt trong nhóm này..."
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setEditMemberId(null)}
                              >
                                Hủy
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleUpdateMember(m.employeeId)}
                              >
                                Lưu
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Thêm thành viên */}
            {canWriteGroup && availableEmps.length > 0 && (
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <UserPlus size={14} /> Thêm thành viên
                </h4>
                <div className="space-y-2">
                  <select
                    value={addEmpId}
                    onChange={(e) => setAddEmpId(e.target.value)}
                    className="w-full text-sm text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 outline-none"
                  >
                    <option value="">— Chọn nhân viên —</option>
                    {availableEmps.map((e) => (
                      <option key={e.employeeId} value={e.employeeId}>
                        {e.fullName} ({e.positionName})
                        {e.specialty ? ` · ${e.specialty}` : ""}
                        {e.craftLevel ? ` · Bậc ${e.craftLevel}` : ""}
                      </option>
                    ))}
                  </select>
                  <Textarea
                    label="Ghi chú vai trò (tùy chọn)"
                    value={addNotes}
                    onChange={(e) => setAddNotes(e.target.value)}
                    rows={2}
                    placeholder="Vai trò, trách nhiệm đặc biệt trong nhóm này..."
                  />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleAddMember}>
                      <UserPlus size={13} /> Thêm vào nhóm
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export function EmployeesPage() {
  const { user: me } = useAuth();
  const [tab, setTab] = useState("employees");
  const empTabs = [
    {
      key: "employees",
      label: "Nhân viên",
      icon: User2,
      show: canAccess(me, "employees"),
    },
    {
      key: "groups",
      label: "Nhóm bảo trì",
      icon: Users,
      show: canAccess(me, "employees"),
    },
  ].filter((t) => t.show);

  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {empTabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors
              ${tab === key ? "bg-white shadow text-blue-700" : "text-gray-600 hover:text-gray-800"}`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      {tab === "employees" ? <EmployeesTab me={me} /> : <GroupsTab me={me} />}
    </div>
  );
}
