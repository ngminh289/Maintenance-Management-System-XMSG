/**
 * App.jsx — Định tuyến toàn bộ ứng dụng với phân quyền theo role.
 * RoleGuard bảo vệ từng nhóm route theo RBAC (utils/rbac.js).
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster }          from 'react-hot-toast';
import { AuthProvider }     from './contexts/AuthContext.jsx';
import { ProtectedRoute, RoleGuard } from './components/layout/ProtectedRoute.jsx';
import { MainLayout }       from './components/layout/MainLayout.jsx';

import { LoginPage }            from './pages/LoginPage.jsx';
import { RegisterPage }         from './pages/RegisterPage.jsx';
import { VerifyEmailPage }      from './pages/VerifyEmailPage.jsx';
import { ForgotPasswordPage }   from './pages/ForgotPasswordPage.jsx';
import { ResetPasswordPage }    from './pages/ResetPasswordPage.jsx';
import { DashboardPage }        from './pages/DashboardPage.jsx';
import { AssetListPage }        from './pages/assets/AssetListPage.jsx';
import { AssetDetailPage }      from './pages/assets/AssetDetailPage.jsx';
import { WorkOrderListPage }    from './pages/workorders/WorkOrderListPage.jsx';
import { WorkOrderDetailPage }  from './pages/workorders/WorkOrderDetailPage.jsx';
import { ChecklistPage }        from './pages/checklists/ChecklistPage.jsx';
import { ApprovalsPage }        from './pages/approvals/ApprovalsPage.jsx';
import { EmployeesPage }        from './pages/employees/EmployeesPage.jsx';
import { SchedulesPage }        from './pages/schedules/SchedulesPage.jsx';
import { DocumentsPage }        from './pages/documents/DocumentsPage.jsx';
import { ReportsPage }          from './pages/reports/ReportsPage.jsx';
import { ProfilePage }          from './pages/ProfilePage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: { borderRadius: '12px', fontSize: '14px' },
        }}
      />
      <Routes>
        {/* ─── Công khai ──────────────────────────────────────── */}
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/register"        element={<RegisterPage />} />
        <Route path="/verify-email"    element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />

        {/* ─── Bảo vệ — yêu cầu đăng nhập ────────────────────── */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>

            {/* Dashboard: mọi role đều xem, nội dung khác nhau */}
            <Route path="/" element={<DashboardPage />} />

            {/* Tài sản — mọi role trừ Ban GĐ */}
            <Route element={<RoleGuard routeKey="assets" />}>
              <Route path="/assets"     element={<AssetListPage />} />
              <Route path="/assets/:id" element={<AssetDetailPage />} />
            </Route>

            {/* Lịch bảo trì — CVKTS, Trưởng ca, Trưởng phòng */}
            <Route element={<RoleGuard routeKey="schedules" />}>
              <Route path="/schedules" element={<SchedulesPage />} />
            </Route>

            {/* Phiếu việc — KTV, Trưởng ca, Trưởng phòng */}
            <Route element={<RoleGuard routeKey="work-orders" />}>
              <Route path="/work-orders"     element={<WorkOrderListPage />} />
              <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />
            </Route>

            {/* Checklist / QR — nhân viên + giám sát (trừ Admin, BGĐ) */}
            <Route element={<RoleGuard routeKey="checklists" />}>
              <Route path="/checklists"                element={<ChecklistPage />} />
              <Route path="/checklists/scan/:assetId"  element={<ChecklistPage />} />
            </Route>

            {/* Kho tài liệu — nhân viên + giám sát (trừ Admin, BGĐ) */}
            <Route element={<RoleGuard routeKey="documents" />}>
              <Route path="/documents" element={<DocumentsPage />} />
            </Route>

            {/* Phê duyệt — CVKTS, Trưởng ca, Trưởng phòng */}
            <Route element={<RoleGuard routeKey="approvals" />}>
              <Route path="/approvals" element={<ApprovalsPage />} />
            </Route>

            {/* Báo cáo — Trưởng ca, Trưởng phòng, Ban GĐ */}
            <Route element={<RoleGuard routeKey="reports" />}>
              <Route path="/reports" element={<ReportsPage />} />
            </Route>

            {/* Nhân sự — Admin only */}
            <Route element={<RoleGuard routeKey="employees" />}>
              <Route path="/employees" element={<EmployeesPage />} />
            </Route>

            {/* Hồ sơ cá nhân — mọi user đều truy cập được */}
            <Route path="/profile"  element={<ProfilePage />} />
            <Route path="/settings" element={<Navigate to="/" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
