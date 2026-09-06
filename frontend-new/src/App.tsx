import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Alerts from './pages/Alerts';
import AlertDetail from './pages/AlertDetail';
import Predictions from './pages/Predictions';
import Recommendations from './pages/Recommendations';
import Facilities from './pages/Facilities';
import Equipment from './pages/Equipment';
import EquipmentDetail from './pages/EquipmentDetail';
import AIAssistant from './pages/AIAssistant';
import Unauthorized from './pages/Unauthorized';
import { UserRole } from './types';

const ADMIN_ROLES: UserRole[] = ['super_admin', 'state_admin', 'district_admin', 'SUPER_ADMIN', 'STATE_ADMIN', 'DISTRICT_ADMIN'];
const STAFF_ROLES: UserRole[] = [
  'super_admin', 'state_admin', 'district_admin', 'hospital_admin', 'facility_staff',
  'SUPER_ADMIN', 'STATE_ADMIN', 'DISTRICT_ADMIN', 'HOSPITAL_ADMIN', 'FACILITY_STAFF'
];
const ALL_ROLES: UserRole[] = [
  'super_admin', 'state_admin', 'district_admin', 'hospital_admin', 'facility_staff', 'citizen',
  'SUPER_ADMIN', 'STATE_ADMIN', 'DISTRICT_ADMIN', 'HOSPITAL_ADMIN', 'FACILITY_STAFF', 'CITIZEN'
];

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="loading-spinner">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={ALL_ROLES}>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory"
        element={
          <ProtectedRoute allowedRoles={STAFF_ROLES}>
            <Inventory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alerts"
        element={
          <ProtectedRoute allowedRoles={STAFF_ROLES}>
            <Alerts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alerts/:id"
        element={
          <ProtectedRoute allowedRoles={STAFF_ROLES}>
            <AlertDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/predictions"
        element={
          <ProtectedRoute allowedRoles={STAFF_ROLES}>
            <Predictions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recommendations"
        element={
          <ProtectedRoute allowedRoles={STAFF_ROLES}>
            <Recommendations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/facilities"
        element={
          <ProtectedRoute allowedRoles={ALL_ROLES}>
            <Facilities />
          </ProtectedRoute>
        }
      />
      <Route
        path="/equipment"
        element={
          <ProtectedRoute allowedRoles={STAFF_ROLES}>
            <Equipment />
          </ProtectedRoute>
        }
      />
      <Route
        path="/equipment/:id"
        element={
          <ProtectedRoute allowedRoles={STAFF_ROLES}>
            <EquipmentDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-assistant"
        element={
          <ProtectedRoute>
            <AIAssistant />
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit-logs"
        element={
          <ProtectedRoute allowedRoles={ADMIN_ROLES}>
            <div className="p-6">
              <h1 className="text-2xl font-bold text-text-primary">Audit Logs</h1>
              <p className="text-text-secondary mt-1">System operational and access audit records.</p>
            </div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/unauthorized"
        element={
          <ProtectedRoute>
            <Unauthorized />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
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