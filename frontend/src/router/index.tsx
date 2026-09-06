import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { ProtectedRoute } from '../components/routing/ProtectedRoute';
import { AppLayout } from '../layouts/AppLayout';
import { LoadingScreen } from '../components/ui/LoadingScreen';

// Lazy-loaded pages
const LoginPage = lazy(() => import('../pages/LoginPage'));
const RegisterPage = lazy(() => import('../pages/RegisterPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const ApprovalsPage = lazy(() => import('../pages/ApprovalsPage'));
const FacilitiesPage = lazy(() => import('../pages/FacilitiesPage'));
const FacilityDetailPage = lazy(() => import('../pages/FacilityDetailPage'));
const InventoryPage = lazy(() => import('../pages/InventoryPage'));
const AlertsPage = lazy(() => import('../pages/AlertsPage'));
const PredictionsPage = lazy(() => import('../pages/PredictionsPage'));
const RecommendationsPage = lazy(() => import('../pages/RecommendationsPage'));
const EquipmentPage = lazy(() => import('../pages/EquipmentPage'));
const AIAssistantPage = lazy(() => import('../pages/AIAssistantPage'));
const CitizenPortalPage = lazy(() => import('../pages/citizen/CitizenPortalPage'));
const CitizenAssistantPage = lazy(() => import('../pages/citizen/CitizenAssistantPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));
const UnauthorizedPage = lazy(() => import('../pages/UnauthorizedPage'));

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Citizen (semi-public — authenticated but role=CITIZEN) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout isCitizen />}>
                <Route path="/citizen" element={<CitizenPortalPage />} />
                <Route path="/citizen/assistant" element={<CitizenAssistantPage />} />
              </Route>
            </Route>

            {/* Government (protected — all non-citizen roles) */}
            <Route element={<AppLayout />}>
              <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN','STATE_ADMIN','DISTRICT_ADMIN','HOSPITAL_ADMIN','FACILITY_STAFF']} />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/equipment" element={<EquipmentPage />} />
                <Route path="/ai-assistant" element={<AIAssistantPage />} />
                <Route path="/facilities/:id" element={<FacilityDetailPage />} />
              </Route>

              {/* Redistribution - Hospital Admin and above */}
              <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN','STATE_ADMIN','DISTRICT_ADMIN','HOSPITAL_ADMIN']} />}>
                <Route path="/recommendations" element={<RecommendationsPage />} />
              </Route>

              {/* Network Intelligence - District Admin and above */}
              <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN','STATE_ADMIN','DISTRICT_ADMIN']} />}>
                <Route path="/facilities" element={<FacilitiesPage />} />
                <Route path="/predictions" element={<PredictionsPage />} />
                <Route path="/approvals" element={<ApprovalsPage />} />
              </Route>
            </Route>

            {/* Redirects */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
