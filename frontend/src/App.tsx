import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DriverLayout } from './components/DriverLayout';
import { StaffLayout } from './components/StaffLayout';
import { ManagerLayout } from './components/ManagerLayout';
import { DriverDashboardPage } from './pages/DriverDashboard';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { CheckInPage } from './pages/CheckIn';
import { CheckOutPage } from './pages/CheckOut';
import { BookingPage } from './pages/Booking';
import { MonthlyPackagePage } from './pages/MonthlyPackage';
import { ReportPage } from './pages/Report';
import { SlotMapPage } from './pages/SlotMap';
import { FloorMapPage } from './pages/FloorMap';
import { MyVehiclePage } from './pages/MyVehicle';
import { HistoryPage } from './pages/History';
import { StaffDashboardPage } from './pages/StaffDashboard';
import { ManagerDashboardPage } from './pages/ManagerDashboard';
import { RevenueDetailPage } from './pages/RevenueDetail';

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
  if (user.role === 'MANAGER' || user.role === 'ADMIN') return <Navigate to="/manager/dashboard" replace />;
  if (user.role === 'STAFF') return <Navigate to="/staff/dashboard" replace />;
  return <Navigate to="/dashboard" replace />;
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
  return <ManagerLayout>{children}</ManagerLayout>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />

      {/* Role-aware redirect from / */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RedirectToRoleHome />
          </ProtectedRoute>
        }
      />

      {/* Driver routes — DriverLayout */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DriverLayout>
              <DriverDashboardPage />
            </DriverLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-vehicle"
        element={
          <ProtectedRoute>
            <DriverLayout title="My Vehicle">
              <MyVehiclePage />
            </DriverLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <DriverLayout title="History">
              <HistoryPage />
            </DriverLayout>
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
        path="/staff/checkout"
        element={
          <StaffRoute>
            <CheckOutPage />
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
        path="/reports"
        element={
          <StaffRoute>
            <ReportPage />
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

      {/* Booking / monthly — DriverLayout */}
      <Route
        path="/booking"
        element={
          <ProtectedRoute>
            <DriverLayout title="Book Slot">
              <BookingPage />
            </DriverLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/floor-map"
        element={
          <ProtectedRoute>
            <DriverLayout title="Sơ đồ bãi đỗ">
              <FloorMapPage />
            </DriverLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/monthly-package"
        element={
          <ProtectedRoute>
            <DriverLayout title="Monthly Package">
              <MonthlyPackagePage />
            </DriverLayout>
          </ProtectedRoute>
        }
      />

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
