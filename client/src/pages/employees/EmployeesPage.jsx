/**
 * EmployeesPage.jsx — Quản lý nhân viên + nhóm bảo trì.
 * project.rule 1.2: "Đăng ký nhân viên + Chia nhóm bảo trì (M:N)".
 * Lịch nghỉ phép (LeaveStartAt → LeaveEndAt): Quản trị viên thiết lập; trong khoảng = tự động nghỉ (NOW() server).
 * RBAC: canAccess('employees'); EMPLOYEE:CREATE / DELETE; lịch nghỉ — Level ≥ 4; nhóm — MAINTENANCE_GROUP:WRITE / :DELETE.
 */
import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import toast from "react-hot-toast";

/** Chuỗi từ API (MySQL / ISO) → giá trị input datetime-local */
function toDatetimeLocalValue(v) {
  if (v == null || v === "") return "";
  const s = String(v).replace(" ", "T");
  return s.length >= 16 ? s.slice(0, 16) : s;
}

function isOnScheduledLeave(emp) {
  return Boolean(emp?.onScheduledLeave);
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
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveEmp, setLeaveEmp] = useState(null);
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveSaving, setLeaveSaving] = useState(false);
  const LIMIT = 15;

  const canAdminLeave = (me?.positionLevel ?? 0) >= 4;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await employeeApi.getAll({
        page,
        limit: LIMIT,
        ...(search && { search }),
      });
      setEmployees(res.data.data?.items ?? []);
      setTotal(res.data.data?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

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

  const statusLabel = (emp) => {
    if (emp.isActive) return { text: "Đang hoạt động", color: "green" };
    if (!emp.emailVerified)
      return { text: "Chưa xác thực email", color: "yellow" };
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
      if (emp.isActive) toast.success("Đã vô hiệu hóa tài khoản");
      else if (!emp.wasEverActivated)
        toast.success("Đã phê duyệt và kích hoạt tài khoản");
      else toast.success("Đã kích hoạt lại tài khoản");
      load();
    } catch {
      toast.error("Lỗi cập nhật");
    }
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
      await employeeApi.create(form);
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

  const setF = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
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
      toast.error("Chọn đủ thời điểm bắt đầu và kết thúc");
      return;
    }
    setLeaveSaving(true);
    try {
      await employeeApi.updateLeaveSchedule(leaveEmp.employeeId, {
        leaveStartAt: leaveStart,
        leaveEndAt: leaveEnd,
      });
      toast.success("Đã lưu lịch nghỉ phép");
      setLeaveOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Không lưu được lịch nghỉ");
    } finally {
      setLeaveSaving(false);
    }
  };

  const clearLeaveSchedule = async () => {
    if (!leaveEmp) return;
    if (!window.confirm("Xóa lịch nghỉ phép đã thiết lập?")) return;
    setLeaveSaving(true);
    try {
      await employeeApi.updateLeaveSchedule(leaveEmp.employeeId, {
        clear: true,
      });
      toast.success("Đã xóa lịch nghỉ");
      setLeaveOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi");
    } finally {
      setLeaveSaving(false);
    }
  };

  useEffect(() => {
    const t = setInterval(() => {
      load();
    }, 60000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="space-y-4">
      {canAdminLeave && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/90 px-4 py-3 text-sm text-violet-950">
          <p className="font-semibold text-violet-900 mb-1">
            Lịch nghỉ phép (Quản trị viên)
          </p>
          <p className="leading-relaxed text-violet-900/90">
            Thiết lập <strong>từ giờ → đến giờ</strong> cho từng nhân viên. Trong khoảng thời gian đó hệ thống tự coi là{" "}
            <strong>đang nghỉ</strong> (không phân công phiếu việc). Hết giờ kết thúc sẽ trở lại bình thường — không
            cần thao tác thêm. Trang tự làm mới mỗi phút để cập nhật trạng thái.
          </p>
        </div>
      )}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            placeholder="Tìm tên, email, username..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
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
                    "Chức vụ",
                    "Phòng ban",
                    "Email",
                    "Trạng thái",
                    "Nghỉ phép (lịch)",
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
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">
                            {emp.fullName?.[0] ?? "?"}
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
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {emp.positionName}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-700">
                        {emp.departmentName}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{emp.email}</td>
                      <td className="px-4 py-3">
                        <Badge color={st.color}>{st.text}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1.5 max-w-[220px]">
                          {isOnScheduledLeave(emp) ? (
                            <Badge color="orange">Đang nghỉ (lịch)</Badge>
                          ) : emp.leaveStartAt && emp.leaveEndAt ? (
                            <Badge color="gray">Chưa tới / đã hết lịch</Badge>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                          {emp.leaveStartAt && emp.leaveEndAt && (
                            <p className="text-[11px] text-gray-600 leading-snug">
                              {fDateTime(emp.leaveStartAt)} → {fDateTime(emp.leaveEndAt)}
                            </p>
                          )}
                          {canAdminLeave && emp.employeeId !== me?.employeeId && (
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
                        {canDo(me, "EMPLOYEE:DELETE") &&
                          emp.employeeId !== me?.employeeId && (
                            <button
                              type="button"
                              title={
                                emp.isActive
                                  ? "Vô hiệu hóa"
                                  : "Kích hoạt / phê duyệt"
                              }
                              onClick={() => handleToggle(emp)}
                              className={`p-1.5 rounded-lg transition-colors ${emp.isActive ? "hover:bg-red-50 text-red-400" : "hover:bg-green-50 text-green-500"}`}
                            >
                              {emp.isActive ? (
                                <UserX size={15} />
                              ) : (
                                <UserCheck size={15} />
                              )}
                            </button>
                          )}
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
              value={form.email ?? ""}
              onChange={(e) => setF("email", e.target.value)}
              error={errors.email}
              type="email"
            />
            <Input
              label="Mật khẩu *"
              value={form.password ?? ""}
              onChange={(e) => setF("password", e.target.value)}
              error={errors.password}
              type="password"
            />
            <Input
              label="Số điện thoại"
              value={form.phone ?? ""}
              onChange={(e) => setF("phone", e.target.value)}
            />
            <Select
              label="Chức vụ *"
              value={form.positionId ?? ""}
              onChange={(e) => setF("positionId", e.target.value)}
              error={errors.positionId}
            >
              <option value="">— Chọn chức vụ —</option>
              {positions.map((p) => (
                <option key={p.positionId} value={p.positionId}>
                  {p.positionName}
                </option>
              ))}
            </Select>
            <Select
              label="Phòng ban *"
              value={form.departmentId ?? ""}
              onChange={(e) => setF("departmentId", e.target.value)}
              error={errors.departmentId}
            >
              <option value="">— Chọn phòng ban —</option>
              {departments.map((d) => (
                <option key={d.departmentId} value={d.departmentId}>
                  {d.departmentName}
                </option>
              ))}
            </Select>
          </div>
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

      <Modal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title={leaveEmp ? `Lịch nghỉ — ${leaveEmp.fullName}` : "Lịch nghỉ phép"}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            Chọn mốc <strong>bắt đầu</strong> và <strong>kết thúc</strong> (theo giờ máy chủ). Trong khoảng này nhân viên
            không được phân công phiếu việc.
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
            <Button type="button" loading={leaveSaving} onClick={submitLeaveSchedule}>
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
  const [detailGrp, setDetailGrp] = useState(null); // nhóm đang xem thành viên
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ groupName: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [addEmpId, setAddEmpId] = useState("");

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
      toast.success("Đã tạo nhóm bảo trì");
      setCreateOpen(false);
      setForm({ groupName: "", description: "" });
      loadGroups();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi tạo nhóm");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (grp) => {
    if (!window.confirm(`Xóa nhóm "${grp.groupName}"?`)) return;
    try {
      await api.delete(`/maintenance-groups/${grp.groupId}`);
      toast.success("Đã xóa nhóm");
      loadGroups();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi xóa nhóm");
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
      });
      toast.success("Đã thêm thành viên");
      await openDetail(detailGrp);
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi thêm thành viên");
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
      toast.error(err.response?.data?.message ?? "Lỗi xóa thành viên");
    }
  };

  // Danh sách nhân viên chưa có trong nhóm
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
                    <p className="text-xs text-gray-500">
                      {g.memberCount ?? 0} thành viên
                    </p>
                  </div>
                </div>
                {canDeleteGroup && (
                  <button
                    type="button"
                    onClick={() => handleDeleteGroup(g)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
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
          <Textarea
            label="Mô tả"
            value={form.description}
            onChange={(e) =>
              setForm((p) => ({ ...p, description: e.target.value }))
            }
            placeholder="Mô tả nhiệm vụ của nhóm..."
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
        size="md"
      >
        {detailGrp && (
          <div className="space-y-4">
            {/* Danh sách thành viên */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Thành viên ({members.length})
              </h4>
              {members.length === 0 ? (
                <p className="text-sm text-gray-400 bg-gray-50 rounded-lg px-4 py-3">
                  Chưa có thành viên
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {members.map((m) => (
                    <div
                      key={m.employeeId}
                      className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                          {m.fullName?.[0] ?? "?"}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            {m.fullName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {m.positionName}
                          </p>
                        </div>
                      </div>
                      {canWriteGroup && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.employeeId)}
                          className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                        >
                          <UserX size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Thêm thành viên */}
            {canWriteGroup && availableEmps.length > 0 && (
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <UserPlus size={14} /> Thêm thành viên
                </h4>
                <div className="flex gap-2">
                  <select
                    value={addEmpId}
                    onChange={(e) => setAddEmpId(e.target.value)}
                    className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 outline-none"
                  >
                    <option value="">— Chọn nhân viên —</option>
                    {availableEmps.map((e) => (
                      <option key={e.employeeId} value={e.employeeId}>
                        {e.fullName} ({e.positionName})
                      </option>
                    ))}
                  </select>
                  <Button size="sm" onClick={handleAddMember}>
                    <UserPlus size={13} /> Thêm
                  </Button>
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
      {/* Tabs — menu nhân sự theo canAccess('employees') (khớp RoleGuard route) */}
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
