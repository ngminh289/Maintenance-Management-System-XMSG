/**
 * App.jsx — Định tuyến toàn bộ ứng dụng với phân quyền theo role.
 * RoleGuard bảo vệ từng nhóm route theo RBAC (utils/rbac.js).
 * /checklists/history — danh sách + modal chi tiết kết quả checklist.
 * /documents/feedback-inbox — hàng đợi phản hồi tài liệu (chỉ Chuyên viên KTS).
 * /reports → chuyển hướng /reports/operations. Ba tab báo cáo: operations, resource-usage, performance (rbac.js + stats.routes).
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster }          from 'react-hot-toast';
import { AuthProvider }     from './contexts/AuthContext.jsx';
import { ProtectedRoute, RoleGuard } from './components/layout/ProtectedRoute.jsx';
import { MainLayout }       from './components/layout/MainLayout.jsx';

import { LoginPage }            from './pages/LoginPage.jsx';
import { VerifyEmailPage }      from './pages/VerifyEmailPage.jsx';
import { ForgotPasswordPage }   from './pages/ForgotPasswordPage.jsx';
import { ResetPasswordPage }    from './pages/ResetPasswordPage.jsx';
import { DashboardPage }        from './pages/DashboardPage.jsx';
import { AssetListPage }        from './pages/assets/AssetListPage.jsx';
import { AssetDetailPage }      from './pages/assets/AssetDetailPage.jsx';
import { WorkOrderListPage }    from './pages/workorders/WorkOrderListPage.jsx';
import { WorkOrderDetailPage }  from './pages/workorders/WorkOrderDetailPage.jsx';
import { ChecklistPage }        from './pages/checklists/ChecklistPage.jsx';
import { ChecklistReviewPage }  from './pages/checklists/ChecklistReviewPage.jsx';
import { ChecklistTemplatesPage } from './pages/checklists/ChecklistTemplatesPage.jsx';
import { ChecklistHistoryPage }   from './pages/checklists/ChecklistHistoryPage.jsx';
import { ApprovalsPage }        from './pages/approvals/ApprovalsPage.jsx';
import { EmployeesPage }        from './pages/employees/EmployeesPage.jsx';
import { SchedulesPage }        from './pages/schedules/SchedulesPage.jsx';
import { DocumentsPage }        from './pages/documents/DocumentsPage.jsx';
import { DocumentFeedbackInboxPage } from './pages/documents/DocumentFeedbackInboxPage.jsx';
import { ReportPerformancePage }  from './pages/reports/ReportPerformancePage.jsx';
import { OperationsReportsPage }  from './pages/reports/OperationsReportsPage.jsx';
import { ResourceUsageReportsPage } from './pages/reports/ResourceUsageReportsPage.jsx';
import { WorkflowsPage }        from './pages/workflows/WorkflowsPage.jsx';
import { ProfilePage }          from './pages/ProfilePage.jsx';
import { AdminPage }            from './pages/admin/AdminPage.jsx';
import { PermissionAdminPage }  from './pages/admin/PermissionAdminPage.jsx';
import { NotificationsPage }    from './pages/NotificationsPage.jsx';

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
        <Route path="/register"        element={<Navigate to="/login" replace />} />
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

            {/* Lịch bảo trì — Chuyên viên KTS (soạn) + Trưởng ca (duyệt) — rule/truongca.rule */}
            <Route element={<RoleGuard routeKey="schedules" />}>
              <Route path="/schedules" element={<SchedulesPage />} />
            </Route>

            {/* Phiếu việc — KTV hiện trường (được giao) + CV KTS + Trưởng ca (toàn bộ + duyệt) */}
            <Route element={<RoleGuard routeKey="work-orders" />}>
              <Route path="/work-orders"     element={<WorkOrderListPage />} />
              <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />
            </Route>

            {/* Checklist / QR — nhân viên + giám sát (trừ Admin, BGĐ) */}
            <Route element={<RoleGuard routeKey="checklists" />}>
              <Route path="/checklists"                element={<ChecklistPage />} />
              <Route path="/checklists/history"        element={<ChecklistHistoryPage />} />
              <Route path="/checklists/scan/:assetId"  element={<ChecklistPage />} />
            </Route>

            <Route element={<RoleGuard routeKey="checklist-review" />}>
              <Route path="/checklists/review" element={<ChecklistReviewPage />} />
            </Route>

            <Route element={<RoleGuard routeKey="checklist-manage" />}>
              <Route path="/checklists/templates" element={<ChecklistTemplatesPage />} />
            </Route>

            {/* Kho tài liệu — nhân viên + giám sát (trừ Admin, BGĐ) */}
            <Route element={<RoleGuard routeKey="documents" />}>
              <Route path="/documents" element={<DocumentsPage />} />
            </Route>

            <Route element={<RoleGuard routeKey="document-feedback-inbox" />}>
              <Route path="/documents/feedback-inbox" element={<DocumentFeedbackInboxPage />} />
            </Route>

            {/* Phê duyệt — Trưởng ca (CV KTS / Ban GĐ không vào đây; BGD xem KPI qua Dashboard + Báo cáo) */}
            <Route element={<RoleGuard routeKey="approvals" />}>
              <Route path="/approvals" element={<ApprovalsPage />} />
            </Route>

            <Route path="/reports" element={<Navigate to="/reports/operations" replace />} />

            {/* Báo cáo hiệu suất — Trưởng/Phó hai phòng, Admin, Ban GĐ */}
            <Route element={<RoleGuard routeKey="report-performance" />}>
              <Route path="/reports/performance" element={<ReportPerformancePage />} />
            </Route>

            {/* Báo cáo nghiệp vụ & vận hành — Trưởng phòng, Ban Giám đốc */}
            <Route element={<RoleGuard routeKey="report-operations" />}>
              <Route path="/reports/operations" element={<OperationsReportsPage />} />
            </Route>

            {/* Báo cáo sử dụng tài nguyên (QR, tài liệu, góp ý) — Trưởng phòng, Ban Giám đốc */}
            <Route element={<RoleGuard routeKey="report-resource-usage" />}>
              <Route path="/reports/resource-usage" element={<ResourceUsageReportsPage />} />
            </Route>

            {/* Nhân sự — Admin only */}
            <Route element={<RoleGuard routeKey="employees" />}>
              <Route path="/employees" element={<EmployeesPage />} />
            </Route>

            {/* Mẫu luồng phê duyệt — Admin (BFD 4.1 C/U) */}
            <Route element={<RoleGuard routeKey="workflows" />}>
              <Route path="/workflows" element={<WorkflowsPage />} />
            </Route>

            {/* Cấu hình hệ thống — Admin only */}
            <Route element={<RoleGuard routeKey="admin-settings" />}>
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/permissions" element={<PermissionAdminPage />} />
            </Route>

            {/* Hồ sơ cá nhân + thông báo — mọi user */}
            <Route path="/profile"       element={<ProfilePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<Navigate to="/" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
