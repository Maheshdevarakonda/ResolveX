import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { GuestRoute, ProtectedRoute, RoleRoute } from "./routes/guards";
import AdminAnalytics from "./pages/admin/AnalyticsPage";
import AuditLogsPage from "./pages/admin/AuditLogsPage";
import DepartmentsPage from "./pages/admin/DepartmentsPage";
import SettingsPage from "./pages/admin/SettingsPage";
import SlaPage from "./pages/admin/SlaPage";
import UsersAdminPage from "./pages/admin/UsersAdminPage";
import CreateComplaintPage from "./pages/customer/CreateComplaintPage";
import DashboardRouter from "./pages/DashboardRouter";
import WorkloadPage from "./pages/employee/WorkloadPage";
import NotFoundPage from "./pages/NotFoundPage";
import ForgotPasswordPage from "./pages/public/ForgotPasswordPage";
import LandingPage from "./pages/public/LandingPage";
import LoginPage from "./pages/public/LoginPage";
import RegisterCustomerPage from "./pages/public/RegisterCustomerPage";
import RegisterOrgPage from "./pages/public/RegisterOrgPage";
import ResetPasswordPage from "./pages/public/ResetPasswordPage";
import ComplaintDetailPage from "./pages/shared/ComplaintDetailPage";
import ComplaintsPage from "./pages/shared/ComplaintsPage";
import NotificationsPage from "./pages/shared/NotificationsPage";
import ProfilePage from "./pages/shared/ProfilePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/o/:slug/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><RegisterOrgPage /></GuestRoute>} />
      <Route path="/o/:slug/register" element={<GuestRoute><RegisterCustomerPage /></GuestRoute>} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route path="/app" element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<DashboardRouter />} />
          <Route path="complaints" element={<ComplaintsPage />} />
          <Route path="complaints/new" element={<RoleRoute roles={["CUSTOMER"]}><CreateComplaintPage /></RoleRoute>} />
          <Route path="complaints/:id" element={<ComplaintDetailPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="workload" element={<RoleRoute roles={["EMPLOYEE", "ADMIN"]}><WorkloadPage /></RoleRoute>} />
          <Route path="employees" element={<RoleRoute roles={["ADMIN"]}><UsersAdminPage role="EMPLOYEE" /></RoleRoute>} />
          <Route path="customers" element={<RoleRoute roles={["ADMIN"]}><UsersAdminPage role="CUSTOMER" /></RoleRoute>} />
          <Route path="departments" element={<RoleRoute roles={["ADMIN"]}><DepartmentsPage /></RoleRoute>} />
          <Route path="sla" element={<RoleRoute roles={["ADMIN"]}><SlaPage /></RoleRoute>} />
          <Route path="analytics" element={<RoleRoute roles={["ADMIN"]}><AdminAnalytics /></RoleRoute>} />
          <Route path="audit-logs" element={<RoleRoute roles={["ADMIN"]}><AuditLogsPage /></RoleRoute>} />
          <Route path="settings" element={<RoleRoute roles={["ADMIN"]}><SettingsPage /></RoleRoute>} />
        </Route>
      </Route>

      <Route path="/dashboard" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
