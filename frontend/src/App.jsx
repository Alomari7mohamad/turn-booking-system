import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { Spinner } from "./components/ui.jsx";
import { GlobalControls } from "./components/GlobalControls.jsx";
import { AppFooter } from "./components/AppFooter.jsx";
import { DashboardLayout } from "./layouts/DashboardLayout.jsx";

import Login from "./pages/Login.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import PublicBooking from "./pages/PublicBooking.jsx";
import PublicReview from "./pages/PublicReview.jsx";
import PrintTicketPage from "./pages/PrintTicketPage.jsx";
import PayGateway from "./pages/PayGateway.jsx";
import PaymentResult from "./pages/PaymentResult.jsx";
import AppointmentDelayResponse from "./pages/AppointmentDelayResponse.jsx";
import SuperAdminDashboard from "./pages/SuperAdminDashboard.jsx";
import SuperAdminStatisticsPage from "./pages/SuperAdminStatisticsPage.jsx";
import BusinessesManagement from "./pages/BusinessesManagement.jsx";
import ManagersManagement from "./pages/ManagersManagement.jsx";
import AdminBusinessControl from "./pages/AdminBusinessControl.jsx";
import BusinessDashboard from "./pages/BusinessDashboard.jsx";
import BusinessStatisticsPage from "./pages/BusinessStatisticsPage.jsx";
import CustomersPage from "./pages/CustomersPage.jsx";
import AppointmentsPage from "./pages/AppointmentsPage.jsx";
import AppointmentPaymentsPage from "./pages/AppointmentPaymentsPage.jsx";
import BookingManagementPage from "./pages/BookingManagementPage.jsx";
import ServicesManagement from "./pages/ServicesManagement.jsx";
import EmployeesManagement from "./pages/EmployeesManagement.jsx";
import WorkingHoursSettings from "./pages/WorkingHoursSettings.jsx";
import SubscriptionPage from "./pages/SubscriptionPage.jsx";
import BusinessSettings from "./pages/BusinessSettings.jsx";
import AuditLogPage from "./pages/AuditLogPage.jsx";
import SecretaryPage from "./pages/SecretaryPage.jsx";
import AccountsPage from "./pages/AccountsPage.jsx";
import StaffDashboard from "./pages/StaffDashboard.jsx";
import StaffAccountsPage from "./pages/StaffAccountsPage.jsx";
import StaffQueueManagementPage from "./pages/StaffQueueManagementPage.jsx";
import PolicyPage from "./pages/PolicyPage.jsx";

// يوجّه المستخدم للوحة المناسبة لدوره بعد الدخول.
function RoleHome() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner page />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "SUPER_ADMIN") return <Navigate to="/admin" replace />;
  if (user.role === "BUSINESS_OWNER") return <Navigate to="/dashboard" replace />;
  if (user.role === "STAFF") return <Navigate to="/staff" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  const location = useLocation();
  const isPublicBooking = location.pathname.startsWith("/book/");
  const isAuthPage = ["/login", "/forgot-password", "/reset-password"].includes(location.pathname);

  return (
    <>
      <GlobalControls />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<PolicyPage type="privacy" />} />
        <Route path="/terms" element={<PolicyPage type="terms" />} />
        <Route path="/book/:slug" element={<PublicBooking />} />
        <Route path="/review/:token" element={<PublicReview />} />
        <Route path="/print/:slug" element={<PrintTicketPage />} />
        <Route path="/pay/success" element={<PaymentResult status="success" />} />
        <Route path="/pay/failed" element={<PaymentResult status="failed" />} />
        <Route path="/pay/:reference" element={<PayGateway />} />
        <Route path="/appointment-response/:id/:answer" element={<AppointmentDelayResponse />} />
        <Route path="/" element={<RoleHome />} />

        {/* Super Admin */}
        <Route
          element={
            <ProtectedRoute roles={["SUPER_ADMIN"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin" element={<SuperAdminDashboard />} />
          <Route path="/admin/statistics" element={<SuperAdminStatisticsPage />} />
          <Route path="/admin/businesses" element={<BusinessesManagement />} />
          <Route path="/admin/managers" element={<ManagersManagement />} />
          <Route path="/admin/businesses/:businessId/control" element={<AdminBusinessControl />}>
            <Route index element={<BusinessDashboard />} />
            <Route path="statistics" element={<BusinessStatisticsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="appointments" element={<AppointmentsPage />} />
            <Route path="appointments/payments" element={<AppointmentPaymentsPage />} />
            <Route path="appointments/manage" element={<BookingManagementPage />} />
            <Route path="appointments/rejected" element={<AppointmentsPage mode="rejected" />} />
            <Route path="services" element={<ServicesManagement />} />
            <Route path="employees" element={<EmployeesManagement />} />
            <Route path="working-hours" element={<WorkingHoursSettings />} />
            <Route path="settings" element={<BusinessSettings />} />
            <Route path="secretary" element={<SecretaryPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="accounts/payments" element={<AppointmentPaymentsPage />} />
            <Route path="subscription" element={<SubscriptionPage />} />
            <Route path="activity" element={<AuditLogPage />} />
          </Route>
        </Route>

        {/* Business Owner */}
        <Route
          element={
            <ProtectedRoute roles={["BUSINESS_OWNER"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<BusinessDashboard />} />
          <Route path="/dashboard/statistics" element={<BusinessStatisticsPage />} />
          <Route path="/dashboard/customers" element={<CustomersPage />} />
          <Route path="/dashboard/appointments" element={<AppointmentsPage />} />
          <Route path="/dashboard/appointments/payments" element={<Navigate to="/dashboard/accounts/payments" replace />} />
          <Route path="/dashboard/appointments/manage" element={<BookingManagementPage />} />
          <Route path="/dashboard/appointments/rejected" element={<AppointmentsPage mode="rejected" />} />
          <Route path="/dashboard/services" element={<ServicesManagement />} />
          <Route path="/dashboard/employees" element={<EmployeesManagement />} />
          <Route path="/dashboard/working-hours" element={<WorkingHoursSettings />} />
          <Route path="/dashboard/subscription" element={<SubscriptionPage />} />
          <Route path="/dashboard/activity" element={<AuditLogPage />} />
          <Route path="/dashboard/settings" element={<BusinessSettings />} />
          <Route path="/dashboard/accounts" element={<AccountsPage />} />
          <Route path="/dashboard/accounts/payments" element={<AppointmentPaymentsPage />} />
        </Route>

        {/* Staff */}
        <Route
          element={
            <ProtectedRoute roles={["STAFF"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/staff" element={<StaffDashboard />} />
          <Route path="/staff/queue" element={<StaffQueueManagementPage />} />
          <Route path="/staff/accounts" element={<StaffAccountsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!isPublicBooking && !isAuthPage && <AppFooter />}
    </>
  );
}
