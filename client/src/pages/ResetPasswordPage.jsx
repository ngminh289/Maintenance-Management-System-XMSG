/**
 * ResetPasswordPage.jsx — Đặt lại mật khẩu mới từ link email.
 * URL: /reset-password?token=<jwt>
 * Gọi POST /api/auth/reset-password.
 */
import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Factory, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { authApi } from '../api/auth.api.js';
import { Button }  from '../components/ui/Button.jsx';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate        = useNavigate();
  const token           = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword]     = useState('');
  const [confirm,     setConfirm]         = useState('');
  const [showPwd,     setShowPwd]         = useState(false);
  const [loading,     setLoading]         = useState(false);
  const [done,        setDone]            = useState(false);
  const [error,       setError]           = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) {
      setError('Mật khẩu xác nhận không khớp'); return;
    }
    if (!token) {
      setError('Token không hợp lệ. Vui lòng yêu cầu link mới.'); return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({ token, newPassword });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Đặt lại mật khẩu thất bại. Token có thể đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200 mb-4">
            <Factory size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Đặt lại mật khẩu</h1>
          <p className="text-sm text-gray-500 mt-1">Tạo mật khẩu mới cho tài khoản của bạn</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
          {done ? (
            <div className="text-center space-y-4 py-2">
              <div className="flex justify-center">
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle size={32} className="text-green-600" />
                </div>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Mật khẩu đã được cập nhật!</p>
                <p className="text-sm text-gray-500 mt-1">Bạn có thể đăng nhập bằng mật khẩu mới ngay bây giờ.</p>
              </div>
              <Button className="w-full justify-center" onClick={() => navigate('/login')}>
                Đăng nhập ngay
              </Button>
            </div>
          ) : !token ? (
            <div className="text-center space-y-4 py-2">
              <p className="text-sm text-red-600">Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.</p>
              <Link to="/forgot-password" className="text-blue-600 font-semibold text-sm hover:underline">
                Yêu cầu link mới
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-gray-700">Mật khẩu mới *</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Ít nhất 8 ký tự"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required minLength={8}
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
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
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
                Đặt lại mật khẩu
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          <Link to="/login" className="text-blue-600 font-semibold hover:underline">
            ← Quay lại đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
