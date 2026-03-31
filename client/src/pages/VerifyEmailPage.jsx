/**
 * VerifyEmailPage.jsx — Xử lý link xác thực email từ hộp thư.
 * URL: /verify-email?token=<jwt>
 * Gọi POST /api/auth/verify-email → hiển thị kết quả.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Factory } from 'lucide-react';
import { authApi } from '../api/auth.api.js';
import { Button }  from '../components/ui/Button.jsx';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Link xác thực không hợp lệ hoặc đã hết hạn.');
      return;
    }
    authApi.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.message ?? 'Xác thực thất bại. Token có thể đã hết hạn.');
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        {/* Logo nhỏ */}
        <div className="flex justify-center">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
            <Factory size={24} className="text-white" />
          </div>
        </div>

        {status === 'loading' && (
          <>
            <Loader2 size={40} className="text-blue-500 animate-spin mx-auto" />
            <p className="text-gray-600 font-medium">Đang xác thực email...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex justify-center">
              <div className="p-4 bg-green-100 rounded-full">
                <CheckCircle size={40} className="text-green-600" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Xác thực email thành công!</h1>
              <p className="text-sm text-gray-600 mt-2">
                Bước tiếp theo: quản trị viên sẽ phê duyệt và bật tài khoản trên hệ thống. Khi được kích hoạt, bạn mới đăng nhập được. Vui lòng liên hệ phòng nhân sự nếu cần gấp.
              </p>
            </div>
            <Button className="w-full justify-center" onClick={() => navigate('/login')}>
              Về trang đăng nhập
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex justify-center">
              <div className="p-4 bg-red-100 rounded-full">
                <XCircle size={40} className="text-red-500" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Xác thực thất bại</h1>
              <p className="text-sm text-gray-600 mt-2">{message}</p>
            </div>
            <Button variant="secondary" className="w-full justify-center" onClick={() => navigate('/login')}>
              Về trang đăng nhập
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
