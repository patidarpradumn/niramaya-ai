import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import Login from '../pages/Login';
import ProtectedRoute from '../components/ProtectedRoute';
import { authAPI } from '../services/api';
import type { User } from '../types';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';

// Mock Firebase
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, cb) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      cb({ getIdToken: async () => token });
    } else {
      cb(null);
    }
    return vi.fn();
  }),
}));

vi.mock('../config/firebase', () => ({
  auth: {},
}));

// Mock API layer
vi.mock('../services/api', () => ({
  authAPI: {
    getMe: vi.fn(),
  },
  dashboardAPI: {
    getSummary: vi.fn().mockResolvedValue({ data: { kpis: {}, recent_alerts: [], stock_summary: {} } }),
    getTrends: vi.fn().mockResolvedValue({ data: { consumption_trend: [], alert_trend: [] } }),
    getStockRisks: vi.fn().mockResolvedValue({ data: [] }),
    getExpiryRisks: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

const mockSuperAdmin: User = {
  id: 1,
  email: 'admin@mediguard.gov',
  full_name: 'Super Admin User',
  role: 'super_admin',
  facility_id: null,
  state_id: 1,
  district_id: null,
  is_active: true,
  created_at: new Date().toISOString(),
};

const mockStaff: User = {
  id: 2,
  email: 'staff@hospital.gov',
  full_name: 'Staff User',
  role: 'facility_staff',
  facility_id: 10,
  state_id: 1,
  district_id: 2,
  is_active: true,
  created_at: new Date().toISOString(),
};

const mockCitizen: User = {
  id: 3,
  email: 'citizen@public.org',
  full_name: 'Public Citizen',
  role: 'citizen',
  facility_id: null,
  state_id: null,
  district_id: null,
  is_active: true,
  created_at: new Date().toISOString(),
};

describe('Phase 19 — Auth & RBAC Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('1. Login with valid credentials authenticates user and stores tokens', async () => {
    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
      user: { getIdToken: async () => 'mock-access-token' }
    } as any);
    vi.mocked(authAPI.getMe).mockResolvedValue({ data: mockSuperAdmin } as any);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<div>Dashboard Screen</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/EMAIL OR NATIONAL ID/i);
    const passwordInput = screen.getByLabelText(/PASSWORD/i);
    const submitButton = screen.getByRole('button', { name: /Secure Login/i });

    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'admin@mediguard.gov' } });
      fireEvent.change(passwordInput, { target: { value: 'admin123' } });
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(signInWithEmailAndPassword).toHaveBeenCalled();
      expect(localStorage.getItem('access_token')).toBe('mock-access-token');
    });

    expect(await screen.findByText('Dashboard Screen')).toBeInTheDocument();
  });

  it('2. Login with invalid credentials displays an error message', async () => {
    vi.mocked(signInWithEmailAndPassword).mockRejectedValue(new Error('Invalid email or password'));

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/EMAIL OR NATIONAL ID/i);
    const passwordInput = screen.getByLabelText(/PASSWORD/i);
    const submitButton = screen.getByRole('button', { name: /Secure Login/i });

    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'wrong@mediguard.gov' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
      fireEvent.click(submitButton);
    });

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });

  it('3. Protected route redirects unauthenticated users to /login', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Secret Dashboard</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Secret Dashboard')).not.toBeInTheDocument();
  });

  it('4a. Role-specific navigation: Super Admin sees Audit Logs and full navigation', async () => {
    localStorage.setItem('access_token', 'valid-admin-token');
    vi.mocked(authAPI.getMe).mockResolvedValue({ data: mockSuperAdmin } as any);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <div>Super Admin Dashboard</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Audit Logs')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Super Admin Dashboard')).toBeInTheDocument();
  });

  it('4b. Role-specific navigation: Facility Staff navigation hides Audit Logs', async () => {
    localStorage.setItem('access_token', 'valid-staff-token');
    vi.mocked(authAPI.getMe).mockResolvedValue({ data: mockStaff } as any);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['facility_staff']}>
                  <div>Staff Dashboard</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Inventory')).toBeInTheDocument();
    expect(screen.queryByText('Audit Logs')).not.toBeInTheDocument();
    expect(screen.getByText('Staff Dashboard')).toBeInTheDocument();
  });

  it('4c. Role-specific navigation: Citizen navigation hides staff options and shows AI Assistant', async () => {
    localStorage.setItem('access_token', 'valid-citizen-token');
    vi.mocked(authAPI.getMe).mockResolvedValue({ data: mockCitizen } as any);

    render(
      <MemoryRouter initialEntries={['/ai-assistant']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/ai-assistant"
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <div>Citizen View</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('AI Assistant')).toBeInTheDocument();
    expect(screen.queryByText('Audit Logs')).not.toBeInTheDocument();
    expect(screen.queryByText('Inventory')).not.toBeInTheDocument();
    expect(screen.getByText('Citizen View')).toBeInTheDocument();
  });

  it('5. Logout clears local storage tokens and resets authentication state', async () => {
    localStorage.setItem('access_token', 'test-token');
    vi.mocked(authAPI.getMe).mockResolvedValue({ data: mockSuperAdmin } as any);

    function TestLogoutComponent() {
      const { user, logout } = useAuth();
      return (
        <div>
          <span>UserEmail: {user ? user.email : 'NoUser'}</span>
          <button onClick={logout}>Logout Button</button>
        </div>
      );
    }

    render(
      <MemoryRouter initialEntries={['/test']}>
        <AuthProvider>
          <Routes>
            <Route path="/test" element={<TestLogoutComponent />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText(/admin@mediguard.gov/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Logout Button'));
    });

    await waitFor(() => {
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(screen.getByText(/NoUser/i)).toBeInTheDocument();
      expect(signOut).toHaveBeenCalled();
    });
  });

  it('6. Unauthorized route handling presents 403 Access Denied when user role lacks access', async () => {
    localStorage.setItem('access_token', 'staff-token');
    vi.mocked(authAPI.getMe).mockResolvedValue({ data: mockStaff } as any);

    render(
      <MemoryRouter initialEntries={['/audit-logs']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/audit-logs"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'state_admin']}>
                  <div>Super Admin Audit Logs</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('403 - Access Denied')).toBeInTheDocument();
    expect(screen.queryByText('Super Admin Audit Logs')).not.toBeInTheDocument();
  });
});
