/**
 * RegisterPage.jsx — Trang tự đăng ký tài khoản nhân viên.
 * Gửi đến POST /api/auth/register → backend gửi email xác thực.
 * Luồng: đăng ký (chỉ chức vụ Level 1 — Công nhân) → xác thực email → quản trị viên kích hoạt tài khoản.
 * Các vai trò cao hơn chỉ do admin tạo trên trang Nhân sự.
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Factory, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { authApi }     from '../api/auth.api.js';
import { employeeApi } from '../api/employee.api.js';
import { Button } from '../components/ui/Button.jsx';
import { Input, Select } from '../components/ui/Input.jsx';
import toast from 'react-hot-toast';

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm]         = useState({ fullName: '', username: '', email: '', phone: '', password: '', confirmPassword: '', positionId: '', departmentId: '' });
  const [positions,   setPositions]   = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showPwd,     setShowPwd]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [done,        setDone]        = useState(false);
  const [error,       setError]       = useState('');

  useEffect(() => {
    Promise.all([employeeApi.getDepartments(), employeeApi.getPositions()])
      .then(([d, p]) => {
        setDepartments(d.data.data ?? []);
        // BFD: chỉ Công nhân (Level 1) được tự đăng ký; KT/Trưởng ca/Admin/Ban GĐ do quản trị tạo.
        const all = p.data.data ?? [];
        setPositions(all.filter(pos => Number(pos.level) <= 1));
      })
      .catch(() => {});
  }, []);

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp'); return;
    }
    setLoading(true);
    try {
      await authApi.register({
        fullName:     form.fullName,
        username:     form.username,
        email:        form.email,
        phone:        form.phone || undefined,
        password:     form.password,
        positionId:   Number(form.positionId),
        departmentId: Number(form.departmentId),
      });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  /* ── Màn hình thành công ─────────────────────────────────── */
  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="flex justify-center">
            <div className="p-4 bg-green-100 rounded-full">
              <CheckCircle size={40} className="text-green-600" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Đăng ký thành công!</h1>
            <p className="text-sm text-gray-600 mt-2">
              Một email xác thực đã được gửi đến <strong>{form.email}</strong>.
              Vui lòng kiểm tra hộp thư và nhấn link để kích hoạt tài khoản.
            </p>
          </div>
          <p className="text-xs text-gray-400">Không nhận được? Kiểm tra thư mục Spam.</p>
          <Button className="w-full justify-center" onClick={() => navigate('/login')}>
            Về trang đăng nhập
          </Button>
        </div>
      </div>
    );
  }

  /* ── Form đăng ký ────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200 mb-3">
            <Factory size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Xi măng Sông Gianh</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tạo tài khoản nhân viên</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Input
                  label="Họ và tên *"
                  placeholder="Nguyễn Văn A"
                  value={form.fullName}
                  onChange={e => setF('fullName', e.target.value)}
                  required
                />
              </div>
              <Input
                label="Tên đăng nhập *"
                placeholder="nguyen.van.a"
                value={form.username}
                onChange={e => setF('username', e.target.value)}
                required
              />
              <Input
                label="Số điện thoại"
                placeholder="0901234567"
                value={form.phone}
                onChange={e => setF('phone', e.target.value)}
              />
              <div className="col-span-2">
                <Input
                  label="Email *"
                  type="email"
                  placeholder="example@warehouse.local"
                  value={form.email}
                  onChange={e => setF('email', e.target.value)}
                  required
                />
              </div>
              <Select
                label="Chức vụ *"
                value={form.positionId}
                onChange={e => setF('positionId', e.target.value)}
                required
              >
                <option value="">— Chọn chức vụ —</option>
                {positions.map(p => (
                  <option key={p.positionId} value={p.positionId}>{p.positionName}</option>
                ))}
              </Select>
              <Select
                label="Phòng ban *"
                value={form.departmentId}
                onChange={e => setF('departmentId', e.target.value)}
                required
              >
                <option value="">— Chọn phòng ban —</option>
                {departments.map(d => (
                  <option key={d.departmentId} value={d.departmentId}>{d.departmentName}</option>
                ))}
              </Select>
            </div>

            {/* Mật khẩu */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">Mật khẩu *</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Ít nhất 8 ký tự"
                  value={form.password}
                  onChange={e => setF('password', e.target.value)}
                  required
                  minLength={8}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none w-full pr-10
                    focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-gray-900"
                />
                <button type="button" onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">Xác nhận mật khẩu *</label>
              <input
                type={showPwd ? 'text' : 'password'}
                placeholder="Nhập lại mật khẩu"
                value={form.confirmPassword}
                onChange={e => setF('confirmPassword', e.target.value)}
                required
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none w-full
                  focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-gray-900"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full justify-center">
              Tạo tài khoản
            </Button>

            <p className="text-xs text-gray-400 text-center pt-1 leading-relaxed">
              Chỉ <strong>Công nhân (hiện trường)</strong> được tự đăng ký và chọn phòng ban.
              Sau khi xác thực email, quản trị viên sẽ duyệt trước khi bạn đăng nhập.
              Nhân viên kỹ thuật, trưởng ca, admin và Ban GĐ do quản trị viên tạo tài khoản.
            </p>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-blue-600 font-semibold hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
