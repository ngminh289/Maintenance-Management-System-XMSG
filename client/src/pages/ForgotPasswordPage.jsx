/**
 * ForgotPasswordPage.jsx — Nhập email để nhận link đặt lại mật khẩu.
 * Gọi POST /api/auth/forgot-password.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Factory, Mail, CheckCircle } from 'lucide-react';
import { authApi } from '../api/auth.api.js';
import { Button }  from '../components/ui/Button.jsx';
import { Input }   from '../components/ui/Input.jsx';

export function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Có lỗi xảy ra. Vui lòng thử lại.');
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
          <h1 className="text-xl font-bold text-gray-900">Quên mật khẩu</h1>
          <p className="text-sm text-gray-500 mt-1 text-center">
            Nhập email đã đăng ký để nhận link đặt lại mật khẩu
          </p>
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
                <p className="font-semibold text-gray-900">Email đã được gửi!</p>
                <p className="text-sm text-gray-500 mt-1">
                  Kiểm tra hộp thư <strong>{email}</strong> để tìm link đặt lại mật khẩu (hiệu lực 1 giờ).
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="example@warehouse.local"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              <Button type="submit" loading={loading} className="w-full justify-center">
                <Mail size={15} /> Gửi link đặt lại
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
