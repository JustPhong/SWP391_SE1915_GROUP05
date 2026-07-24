import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useActiveMonthlyPackage } from './hooks/useActiveMonthlyPackage';
import { DriverLayout } from './components/DriverLayout';
import { StaffLayout } from './components/StaffLayout';
import { ManagerLayout } from './components/ManagerLayout';
import { AdminLayout } from './components/AdminLayout';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { CheckInPage } from './pages/CheckIn';
import { ReportPage } from './pages/Report';
import SearchVehiclePage from './pages/SearchVehicle';
import { SlotMapPage } from './pages/SlotMap';
import { FloorMapPage } from './pages/FloorMap';
import { BookingManagementPage } from './pages/BookingManagement';
import { StaffDashboardPage } from './pages/StaffDashboard';
import { ManagerDashboardPage } from './pages/ManagerDashboard';
import { RevenueDetailPage } from './pages/RevenueDetail';
import { OccupancyDetailPage } from './pages/OccupancyDetail';
import { TrafficPage } from './pages/TrafficPage';
import { UserManagementPage } from './pages/UserManagement';
import { PermissionsPage } from './pages/Permissions';
import { ParkingConfigPage } from './pages/ParkingConfig';
import { FeeRulesPage } from './pages/FeeRules';
import { AuditLogsPage } from './pages/AuditLogs';
import { ProfilePage } from './pages/Profile';
import { WelcomePage } from './pages/WelcomePage';
import { SupportPage } from './pages/Support';
import { NotificationsPage } from './pages/Notifications';
import { BookingPage } from './pages/Booking';
import { MonthlyPackagePage } from './pages/MonthlyPackage';
import { StaffHistoryPage } from './pages/StaffHistory';
import { ForgotPasswordPage } from './pages/ForgotPassword';
import { GuestParkingPage } from './pages/GuestParking';
import { GuestCheckoutPage } from './pages/GuestCheckout';

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '1.1rem', color: '#555' }}>
      Đang tải...
    </div>
  );
}

function RedirectToRoleHome() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN')   return <Navigate to="/admin/users" replace />;
  if (user.role === 'MANAGER') return <Navigate to="/manager/dashboard" replace />;
  if (user.role === 'STAFF')   return <Navigate to="/staff/dashboard" replace />;
  return <Navigate to="/" replace />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function StaffRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'STAFF' && user.role !== 'MANAGER' && user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }
  return <StaffLayout>{children}</StaffLayout>;
}

function ManagerRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'MANAGER' && user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }
  if (user.role === 'ADMIN') return <Navigate to="/admin/users" replace />;
  return <ManagerLayout>{children}</ManagerLayout>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <AdminLayout>{children}</AdminLayout>;
}

/**
 * Route guard for pages that require an ACTIVE monthly package.
 * - Shows LoadingScreen while auth or package data is still loading.
 * - Redirects to '/' (DriverDashboard / WelcomePage) if user has no active package.
 * - Renders children normally when an active package is confirmed.
 */
function MonthlyPackageRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const { isPackageLoading, hasActiveMonthlyPackage } = useActiveMonthlyPackage();

  if (authLoading || isPackageLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasActiveMonthlyPackage) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ProfileRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'ADMIN') {
    return (
      <AdminLayout>
        <ProfilePage />
      </AdminLayout>
    );
  }
  if (user.role === 'MANAGER') {
    return (
      <ManagerLayout>
        <ProfilePage />
      </ManagerLayout>
    );
  }
  if (user.role === 'STAFF') {
    return (
      <StaffLayout title="Thông tin cá nhân" showGreeting={false}>
        <ProfilePage />
      </StaffLayout>
    );
  }
  return (
    <DriverLayout title="Thông tin cá nhân">
      <ProfilePage />
    </DriverLayout>
  );
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <RedirectToRoleHome /> : <LoginPage />} />
      <Route path="/register" element={user ? <RedirectToRoleHome /> : <RegisterPage />} />
      <Route path="/forgot-password" element={user ? <RedirectToRoleHome /> : <ForgotPasswordPage />} />
      {/* Public guest parking page — no auth required */}
      <Route path="/guest-parking" element={<GuestParkingPage />} />
      <Route
        path="/"
        element={
          user?.role === 'ADMIN' ? <Navigate to="/admin/users" replace />
          : user?.role === 'MANAGER' ? <Navigate to="/manager/dashboard" replace />
          : user?.role === 'STAFF' ? <Navigate to="/staff/dashboard" replace />
          : <WelcomePage />
        }
      />
      <Route
        path="/dashboard-home"
        element={
          <ProtectedRoute>
            <RedirectToRoleHome />
          </ProtectedRoute>
        }
      />

      {/* Staff routes — StaffLayout */}
      <Route
        path="/staff/dashboard"
        element={
          <StaffRoute>
            <StaffDashboardPage />
          </StaffRoute>
        }
      />
      <Route
        path="/staff/checkin"
        element={
          <StaffRoute>
            <CheckInPage />
          </StaffRoute>
        }
      />
      <Route
        path="/staff/search"
        element={
          <StaffRoute>
            <SearchVehiclePage />
          </StaffRoute>
        }
      />
      <Route
        path="/staff/slot-map"
        element={
          <StaffRoute>
            <SlotMapPage />
          </StaffRoute>
        }
      />
      <Route
        path="/staff/floor-map"
        element={
          <StaffRoute>
            <FloorMapPage />
          </StaffRoute>
        }
      />
      <Route
        path="/staff/bookings"
        element={
          <StaffRoute>
            <BookingManagementPage />
          </StaffRoute>
        }
      />
      <Route
        path="/staff/reports"
        element={
          <StaffRoute>
            <ReportPage />
          </StaffRoute>
        }
      />
      <Route
        path="/staff/history"
        element={
          <StaffRoute>
            <StaffHistoryPage />
          </StaffRoute>
        }
      />
      <Route
        path="/staff/users"
        element={
          <StaffRoute>
            <UserManagementPage />
          </StaffRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <StaffRoute>
            <ReportPage />
          </StaffRoute>
        }
      />
      <Route
        path="/support"
        element={
          <StaffRoute>
            <SupportPage />
          </StaffRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <StaffRoute>
            <NotificationsPage />
          </StaffRoute>
        }
      />

      {/* Manager routes — ManagerLayout */}
      <Route
        path="/manager/dashboard"
        element={
          <ManagerRoute>
            <ManagerDashboardPage />
          </ManagerRoute>
        }
      />
      <Route
        path="/manager/revenue"
        element={
          <ManagerRoute>
            <RevenueDetailPage />
          </ManagerRoute>
        }
      />
      <Route
        path="/manager/occupancy"
        element={
          <ManagerRoute>
            <OccupancyDetailPage />
          </ManagerRoute>
        }
      />
      <Route
        path="/manager/traffic"
        element={
          <ManagerRoute>
            <TrafficPage />
          </ManagerRoute>
        }
      />
      <Route
        path="/manager/history"
        element={
          <ManagerRoute>
            <StaffHistoryPage />
          </ManagerRoute>
        }
      />

      {/* Admin routes — AdminLayout */}
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <UserManagementPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/permissions"
        element={
          <AdminRoute>
            <PermissionsPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/parking"
        element={
          <AdminRoute>
            <ParkingConfigPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/fee-rules"
        element={
          <AdminRoute>
            <FeeRulesPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <AdminRoute>
            <AuditLogsPage />
          </AdminRoute>
        }
      />

      {/* Booking — yêu cầu có gói tháng */}
      <Route
        path="/booking"
        element={
          <MonthlyPackageRoute>
            <BookingPage />
          </MonthlyPackageRoute>
        }
      />
      <Route
        path="/floor-map"
        element={
          <MonthlyPackageRoute>
            <DriverLayout title="Sơ đồ tầng">
              <FloorMapPage />
            </DriverLayout>
          </MonthlyPackageRoute>
        }
      />
      <Route
        path="/monthly-package"
        element={
          <MonthlyPackageRoute>
            <DriverLayout title="Gói tháng">
              <MonthlyPackagePage />
            </DriverLayout>
          </MonthlyPackageRoute>
        }
      />
      <Route path="/profile" element={<ProfileRoute />} />
      <Route path="/guest-checkout" element={<GuestCheckoutPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

