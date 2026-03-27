/**
 * ProtectedRoute.jsx — Chuyển hướng về /login nếu chưa đăng nhập.
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { PageLoader } from '../ui/Spinner.jsx';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
