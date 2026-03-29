/**
 * ProtectedRoute.jsx — Chuyển hướng về /login nếu chưa đăng nhập.
 * RoleGuard — Chặn trang nếu user không có quyền, hiện trang 403.
 */
import { Navigate, Outlet } from 'react-router-dom';
import { ShieldOff }        from 'lucide-react';
import { useAuth }          from '../../contexts/AuthContext.jsx';
import { PageLoader }       from '../ui/Spinner.jsx';
import { canAccess }        from '../../utils/rbac.js';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** Bảo vệ route theo role — chỉ render nếu user có quyền xem routeKey */
export function RoleGuard({ routeKey }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user)   return <Navigate to="/login" replace />;

  if (!canAccess(user, routeKey)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="p-4 bg-red-100 rounded-full mb-4">
          <ShieldOff size={36} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Không có quyền truy cập</h2>
        <p className="text-sm text-gray-600 max-w-sm">
          Chức vụ <span className="font-semibold text-gray-800">{user.positionName}</span> của bạn
          không được phép xem trang này.
        </p>
        <p className="text-xs text-gray-400 mt-2">Liên hệ quản trị viên nếu cần cấp quyền thêm.</p>
      </div>
    );
  }

  return <Outlet />;
}
