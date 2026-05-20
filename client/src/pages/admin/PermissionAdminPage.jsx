/**
 * PermissionAdminPage.jsx — Trang quản trị phân quyền theo Position.
 * Nghiệp vụ: Admin bật/tắt quyền CRUD/APPROVE/EXPORT theo ResourceType.
 * Liên quan: api/permission.api.js, api/employee.api.js, App.jsx, Sidebar.jsx.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { employeeApi } from "../../api/employee.api.js";
import { permissionApi } from "../../api/permission.api.js";
import { Card } from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Select } from "../../components/ui/Input.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";

/** Gợi ý hiển thị cạnh tên quyền (ô checkbox vẫn giữ mã EN). */
function permissionDisplayLabel(permissionName, resourceType) {
  if (resourceType === "CHECKLIST_RESULT" && permissionName === "APPROVE") {
    return "Tiếp nhận checklist";
  }
  const map = {
    CREATE: "Tạo",
    READ: "Xem",
    UPDATE: "Cập nhật",
    DELETE: "Xóa",
    APPROVE: "Phê duyệt",
    EXPORT: "Xuất báo cáo",
    REVIEW: "Tiếp nhận / xử lý",
    SUBMIT: "Gửi duyệt",
  };
  return map[permissionName] ?? permissionName;
}

const RESOURCE_LABEL_VI = {
  ASSET: "Tài sản thiết bị",
  WORK_ORDER: "Phiếu việc",
  DIGITAL_ASSET: "Tài liệu số",
  MAINTENANCE_PLAN: "Kế hoạch bảo trì",
  CHECKLIST_TEMPLATE: "Mẫu checklist",
  CHECKLIST_RESULT: "Kết quả checklist",
  RUNTIME_LOG: "Nhật ký vận hành",
  EMPLOYEE: "Nhân sự",
  TAG: "Thẻ (Tag)",
  WORKFLOW: "Mẫu luồng phê duyệt",
  REPORT: "Báo cáo",
  DOCUMENT_CATEGORY: "Danh mục tài liệu",
  DOCUMENT_FEEDBACK: "Phản hồi tài liệu",
};

const DEFAULT_PERMISSION_MATRIX = [
  ["ASSET", ["CREATE", "READ", "UPDATE", "DELETE"]],
  ["WORK_ORDER", ["CREATE", "READ", "UPDATE", "APPROVE", "DELETE"]],
  ["DIGITAL_ASSET", ["CREATE", "READ", "UPDATE", "APPROVE", "DELETE"]],
  ["MAINTENANCE_PLAN", ["CREATE", "READ", "UPDATE", "APPROVE", "DELETE"]],
  ["CHECKLIST_TEMPLATE", ["CREATE", "READ", "UPDATE", "APPROVE", "DELETE"]],
  ["CHECKLIST_RESULT", ["CREATE", "READ", "UPDATE", "APPROVE"]],
  ["RUNTIME_LOG", ["CREATE", "READ", "UPDATE", "DELETE"]],
  ["EMPLOYEE", ["CREATE", "READ", "UPDATE", "DELETE", "EXPORT"]],
  ["TAG", ["CREATE", "READ", "UPDATE", "DELETE"]],
  ["WORKFLOW", ["CREATE", "READ", "UPDATE", "DELETE"]],
  ["REPORT", ["READ", "EXPORT"]],
  ["DOCUMENT_CATEGORY", ["CREATE", "READ", "UPDATE", "DELETE"]],
  ["DOCUMENT_FEEDBACK", ["CREATE", "READ", "REVIEW"]],
];

function normalizePermissionRows(rows) {
  return (rows || []).map((r) => ({
    permissionId: Number(r.permissionId),
    positionId: Number(r.positionId),
    positionName: r.positionName,
    positionLevel: Number(r.positionLevel ?? 0),
    permissionName: String(r.permissionName || "").toUpperCase(),
    resourceType: String(r.resourceType || "").toUpperCase(),
  }));
}

function toPermissionKey(resourceType, permissionName) {
  return `${resourceType}:${permissionName}`;
}

export function PermissionAdminPage() {
  const { user, refetchMe } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [positions, setPositions] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [selectedPositionId, setSelectedPositionId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [positionRes, permissionRes] = await Promise.all([
        employeeApi.getPositions(),
        permissionApi.getAll(),
      ]);
      const positionRows = (positionRes?.data?.data ?? [])
        .map((p) => ({
          positionId: Number(p.positionId),
          positionName: p.positionName,
          level: Number(p.level ?? 0),
        }))
        .sort(
          (a, b) =>
            a.level - b.level || a.positionName.localeCompare(b.positionName),
        );
      const permissionRows = normalizePermissionRows(
        permissionRes?.data?.data ?? [],
      );
      setPositions(positionRows);
      setAllPermissions(permissionRows);
      setSelectedPositionId((prev) => {
        if (prev && positionRows.some((p) => p.positionId === Number(prev)))
          return prev;
        return positionRows[0] ? String(positionRows[0].positionId) : "";
      });
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.message || "Không tải được dữ liệu phân quyền",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedPid = Number(selectedPositionId || 0);
  const selectedPosition =
    positions.find((p) => p.positionId === selectedPid) || null;

  const selectedRows = useMemo(
    () => allPermissions.filter((r) => r.positionId === selectedPid),
    [allPermissions, selectedPid],
  );

  const permissionIdByKey = useMemo(() => {
    const map = new Map();
    for (const row of selectedRows) {
      map.set(
        toPermissionKey(row.resourceType, row.permissionName),
        row.permissionId,
      );
    }
    return map;
  }, [selectedRows]);

  const matrixRows = useMemo(() => {
    const merged = new Map();
    for (const [resourceType, perms] of DEFAULT_PERMISSION_MATRIX) {
      merged.set(resourceType, new Set(perms));
    }
    for (const row of allPermissions) {
      if (!merged.has(row.resourceType)) {
        merged.set(row.resourceType, new Set());
      }
      merged.get(row.resourceType).add(row.permissionName);
    }
    return Array.from(merged.entries())
      .map(([resourceType, permsSet]) => ({
        resourceType,
        permissions: Array.from(permsSet).sort(),
      }))
      .sort((a, b) => a.resourceType.localeCompare(b.resourceType));
  }, [allPermissions]);

  const handleTogglePermission = async (resourceType, permissionName) => {
    if (!selectedPid) return;
    const key = toPermissionKey(resourceType, permissionName);
    const existingId = permissionIdByKey.get(key);
    setSavingKey(key);
    try {
      if (existingId) {
        await permissionApi.revoke(existingId);
      } else {
        await permissionApi.grant({
          positionId: selectedPid,
          resourceType,
          permissionName,
        });
      }
      const refreshed = await permissionApi.getAll();
      setAllPermissions(normalizePermissionRows(refreshed?.data?.data ?? []));
      if (Number(user?.positionId ?? 0) === selectedPid) {
        await refetchMe();
      }
      toast.success("Đã cập nhật quyền");
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Cập nhật quyền thất bại");
    } finally {
      setSavingKey("");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Phân quyền hệ thống
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Quản trị viên cấu hình quyền theo chức vụ. Thay đổi sẽ áp dụng sau khi
          người dùng tải lại phiên.
        </p>
      </div>

      <Card title="Bộ lọc chức vụ">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[320px] max-w-[480px]">
            <Select
              label="Chức vụ"
              value={selectedPositionId}
              onChange={(e) => setSelectedPositionId(e.target.value)}
            >
              {positions.map((p) => (
                <option key={p.positionId} value={p.positionId}>
                  {p.positionName} (Cấp {p.level})
                </option>
              ))}
            </Select>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={loadData}
            loading={loading}
          >
            <RefreshCw size={14} /> Làm mới
          </Button>
          {selectedPosition && (
            <div className="inline-flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-[1px]">
              <ShieldCheck size={14} />
              <span>
                Đang chỉnh quyền cho:{" "}
                <strong>{selectedPosition.positionName}</strong>
              </span>
            </div>
          )}
        </div>
      </Card>

      <Card title="Ma trận quyền theo resource">
        {loading ? (
          <p className="text-sm text-gray-500 py-6">
            Đang tải dữ liệu phân quyền...
          </p>
        ) : !selectedPositionId ? (
          <p className="text-sm text-gray-500 py-6">
            Chưa có chức vụ để cấu hình.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">
                    Tài nguyên
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">
                    Quyền
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {matrixRows.map((row) => (
                  <tr key={row.resourceType}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-semibold text-gray-800">
                        {RESOURCE_LABEL_VI[row.resourceType] ??
                          row.resourceType}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {row.permissions.map((permissionName) => {
                          const key = toPermissionKey(
                            row.resourceType,
                            permissionName,
                          );
                          const checked = permissionIdByKey.has(key);
                          const isSaving = savingKey === key;
                          return (
                            <label
                              key={key}
                              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors ${
                                checked
                                  ? "border-blue-300 bg-blue-50 text-blue-800"
                                  : "border-gray-200 bg-white text-gray-700"
                              } ${isSaving ? "opacity-70 cursor-wait" : "cursor-pointer"}`}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={checked}
                                disabled={isSaving || loading}
                                onChange={() =>
                                  handleTogglePermission(
                                    row.resourceType,
                                    permissionName,
                                  )
                                }
                              />
                              <span className="font-medium tracking-wide">
                                {permissionDisplayLabel(
                                  permissionName,
                                  row.resourceType,
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
