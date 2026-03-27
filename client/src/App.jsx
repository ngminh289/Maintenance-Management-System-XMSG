/**
 * App.jsx — Định tuyến toàn bộ ứng dụng.
 * Cấu trúc: Route công khai (login) + Route bảo vệ (layout + pages).
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ProtectedRoute } from './components/layout/ProtectedRoute.jsx';
import { MainLayout }     from './components/layout/MainLayout.jsx';

import { LoginPage }       from './pages/LoginPage.jsx';
import { DashboardPage }   from './pages/DashboardPage.jsx';
import { AssetListPage }   from './pages/assets/AssetListPage.jsx';
import { AssetDetailPage } from './pages/assets/AssetDetailPage.jsx';
import { WorkOrderListPage }   from './pages/workorders/WorkOrderListPage.jsx';
import { WorkOrderDetailPage } from './pages/workorders/WorkOrderDetailPage.jsx';
import { ChecklistPage }   from './pages/checklists/ChecklistPage.jsx';
import { ApprovalsPage }   from './pages/approvals/ApprovalsPage.jsx';
import { EmployeesPage }   from './pages/employees/EmployeesPage.jsx';
import { SchedulesPage }   from './pages/schedules/SchedulesPage.jsx';
import { DocumentsPage }   from './pages/documents/DocumentsPage.jsx';
import { ReportsPage }     from './pages/reports/ReportsPage.jsx';

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
        {/* Công khai */}
        <Route path="/login" element={<LoginPage />} />

        {/* Bảo vệ — yêu cầu đăng nhập */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/"              element={<DashboardPage />} />
            <Route path="/assets"        element={<AssetListPage />} />
            <Route path="/assets/:id"    element={<AssetDetailPage />} />
            <Route path="/schedules"     element={<SchedulesPage />} />
            <Route path="/work-orders"         element={<WorkOrderListPage />} />
            <Route path="/work-orders/:id"     element={<WorkOrderDetailPage />} />
            <Route path="/checklists"    element={<ChecklistPage />} />
            <Route path="/checklists/scan/:assetId" element={<ChecklistPage />} />
            <Route path="/documents"     element={<DocumentsPage />} />
            <Route path="/approvals"     element={<ApprovalsPage />} />
            <Route path="/employees"     element={<EmployeesPage />} />
            <Route path="/reports"       element={<ReportsPage />} />
            <Route path="/settings"      element={<Navigate to="/" replace />} />
            <Route path="/profile"       element={<Navigate to="/" replace />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
