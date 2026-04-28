/**
 * LoginPage.jsx — Trang đăng nhập.
 * Chấp nhận email, username hoặc identifier.
 * Tài khoản mới: chỉ Admin tạo tại mục Nhân viên (không đăng ký công khai).
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Factory, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Input } from "../components/ui/Input.jsx";
import toast from "react-hot-toast";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login({ identifier: form.identifier, password: form.password });
      toast.success("Đăng nhập thành công!");
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200 mb-4">
            <Factory size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Xi măng Sông Gianh
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Hệ thống quản lý bảo trì tài sản
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-5">
            Đăng nhập
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Tên đăng nhập / Email"
              placeholder="admin hoặc admin@warehouse.local"
              value={form.identifier}
              onChange={(e) =>
                setForm((p) => ({ ...p, identifier: e.target.value }))
              }
              autoComplete="username"
              required
              className="text-black"
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, password: e.target.value }))
                  }
                  autoComplete="current-password"
                  required
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none w-full pr-10
                    focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-black"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                Quên mật khẩu?
              </Link>
            </div>

            <Button
              type="submit"
              loading={loading}
              className="w-full justify-center"
            >
              Đăng nhập
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Cần tài khoản? Liên hệ <strong>Admin</strong> để được cấp quyền truy
          cập.
        </p>

        <p className="text-center text-xs text-gray-400 mt-5">
          © 2026 Nhà máy Xi măng Sông Gianh · Phiên bản 1.0
        </p>
      </div>
    </div>
  );
}
