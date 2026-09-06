import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import { dashboardAPI, recommendationsAPI, equipmentAPI } from '../services/api';
import type { User, DashboardSummary, DashboardStockRisk, DashboardExpiryRisk } from '../types';

// Mock Firebase
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, cb) => {
    cb(null); // default to unauthenticated
    return vi.fn();
  }),
}));

vi.mock('../config/firebase', () => ({
  auth: {},
}));

let mockCurrentUser: User | null = null;

vi.mock('../context/AuthContext', async () => {
  const actual = await vi.importActual('../context/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: mockCurrentUser,
      isLoading: false,
      isAuthenticated: !!mockCurrentUser,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    }),
  };
});

// Mock API layer
vi.mock('../services/api', () => ({
  dashboardAPI: {
    getSummary: vi.fn(),
    getStockRisks: vi.fn(),
    getExpiryRisks: vi.fn(),
  },
  recommendationsAPI: {
    list: vi.fn(),
  },
  equipmentAPI: {
    list: vi.fn(),
  },
}));

// Mock Recharts to avoid SVG measurement and context issues in test environment
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ data }: { data: any[] }) => (
    <div data-testid="bar-chart">
      {data?.map((d: any, i: number) => (
        <div key={i} data-testid="bar-chart-item">{d.item}</div>
      ))}
    </div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
}));

const mockSuperAdminUser: User = {
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

const mockDistrictAdminUser: User = {
  id: 2,
  email: 'district@mediguard.gov',
  full_name: 'District Admin User',
  role: 'district_admin',
  facility_id: null,
  state_id: 1,
  district_id: 4,
  is_active: true,
  created_at: new Date().toISOString(),
};

const mockSummaryData: DashboardSummary = {
  kpis: {
    total_facilities: 15,
    total_items: 450,
    critical_alerts: 3,
    low_stock_items: 12,
    predicted_demand_count: 8,
  },
  recent_alerts: [
    {
      id: 101,
      severity: 'critical',
      title: 'Critical Insulin Shortage',
      facility_name: 'City Central Hospital',
      created_at: new Date().toISOString(),
    },
    {
      id: 102,
      severity: 'high',
      title: 'Paracetamol Low Buffer',
      facility_name: 'District Clinic #4',
      created_at: new Date().toISOString(),
    },
  ],
  stock_summary: {
    critical: 5,
    low: 12,
    adequate: 120,
    overstocked: 8,
  },
};

const mockStockRisks: DashboardStockRisk[] = [
  {
    inventory_id: 1,
    item_name: 'Oxygen Cylinders',
    facility_name: 'Apex Hospital',
    current_stock: 4,
    min_threshold: 20,
    status: 'CRITICAL',
  },
  {
    inventory_id: 2,
    item_name: 'PPE Kits',
    facility_name: 'Sub-District Hospital',
    current_stock: 15,
    min_threshold: 50,
    status: 'LOW',
  },
];

const mockExpiryRisks: DashboardExpiryRisk[] = [
  {
    inventory_id: 10,
    item_name: 'Amoxicillin 500mg',
    facility_name: 'Sub-District Hospital',
    quantity: 150,
    expiry_date: '2026-09-20',
    days_to_expiry: 16,
  },
];

const mockRecommendations: any[] = [
  {
    id: 1,
    title: 'Transfer 50 Amoxicillin to Rural Health Center',
    action_type: 'REDISTRIBUTION',
    facility_name: 'Rural Health Center',
    source_facility_name: 'Apex Hospital',
    destination_facility_name: 'Rural Health Center',
    item_name: 'Amoxicillin 500mg',
    suggested_quantity: 50,
    status: 'PENDING',
    reasoning: 'Surplus detected at Apex Hospital with near-expiry batch.',
    created_at: new Date().toISOString(),
  },
];

const mockEquipment: any[] = [
  {
    id: 1,
    facility_id: 1,
    facility_name: 'Apex Hospital',
    name: 'Ventilator X200',
    equipment_type: 'Ventilator',
    model: 'X200',
    serial_number: 'SN-9021',
    status: 'UNDER_MAINTENANCE',
    last_maintenance_date: '2026-01-10',
    next_maintenance_date: '2026-07-10',
    is_overdue_maintenance: true,
  },
  {
    id: 2,
    facility_id: 1,
    facility_name: 'Apex Hospital',
    name: 'ECG Monitor',
    equipment_type: 'Monitor',
    model: 'M-100',
    serial_number: 'SN-3321',
    status: 'OPERATIONAL',
    last_maintenance_date: '2026-05-10',
    next_maintenance_date: '2026-11-10',
    is_overdue_maintenance: false,
  },
];

function renderDashboardWithUser(user: User = mockSuperAdminUser) {
  mockCurrentUser = user;
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

describe('Phase 20 — Admin Dashboard Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Renders loading state while fetching dashboard data', () => {
    vi.mocked(dashboardAPI.getSummary).mockReturnValue(new Promise(() => {}));
    vi.mocked(dashboardAPI.getStockRisks).mockReturnValue(new Promise(() => {}));
    vi.mocked(dashboardAPI.getExpiryRisks).mockReturnValue(new Promise(() => {}));
    vi.mocked(recommendationsAPI.list).mockReturnValue(new Promise(() => {}));
    vi.mocked(equipmentAPI.list).mockReturnValue(new Promise(() => {}));

    renderDashboardWithUser();

    expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading Niramaya AI Admin Dashboard...')).toBeInTheDocument();
  });

  it('2. Renders API error state and retries on button click', async () => {
    vi.mocked(dashboardAPI.getSummary).mockRejectedValueOnce(new Error('Network error'));
    vi.mocked(dashboardAPI.getStockRisks).mockResolvedValue({ data: [] } as any);
    vi.mocked(dashboardAPI.getExpiryRisks).mockResolvedValue({ data: [] } as any);
    vi.mocked(recommendationsAPI.list).mockResolvedValue({ data: [] } as any);
    vi.mocked(equipmentAPI.list).mockResolvedValue({ data: [] } as any);

    renderDashboardWithUser();

    expect(await screen.findByTestId('dashboard-error')).toBeInTheDocument();

    // Setup success response for retry click
    vi.mocked(dashboardAPI.getSummary).mockResolvedValueOnce({ data: mockSummaryData } as any);

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retryBtn);

    expect(await screen.findByTestId('admin-dashboard')).toBeInTheDocument();
  });

  it('3. Renders all 7 KPI cards with dynamic numbers from API data', async () => {
    vi.mocked(dashboardAPI.getSummary).mockResolvedValue({ data: mockSummaryData } as any);
    vi.mocked(dashboardAPI.getStockRisks).mockResolvedValue({ data: mockStockRisks } as any);
    vi.mocked(dashboardAPI.getExpiryRisks).mockResolvedValue({ data: mockExpiryRisks } as any);
    vi.mocked(recommendationsAPI.list).mockResolvedValue({ data: mockRecommendations } as any);
    vi.mocked(equipmentAPI.list).mockResolvedValue({ data: mockEquipment } as any);

    renderDashboardWithUser();

    expect(await screen.findByTestId('admin-dashboard')).toBeInTheDocument();

    const kpiGrid = screen.getByTestId('kpi-grid');
    expect(kpiGrid).toBeInTheDocument();

    // Validate KPI metrics:
    // Total Facilities = 15
    expect(screen.getByText('Total Facilities')).toBeInTheDocument();
    expect(screen.getAllByText('15').length).toBeGreaterThan(0);

    // Critical Alerts = 3
    expect(screen.getByText('Critical Alerts')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    // Predicted Shortages = 8
    expect(screen.getByText('Predicted Shortages')).toBeInTheDocument();
    expect(screen.getAllByText('8').length).toBeGreaterThan(0);

    // Expiry Risks = 1 (from mockExpiryRisks length)
    expect(screen.getByText('Expiry Risks')).toBeInTheDocument();

    // Redistribution Ops = 1 (pending recommendations count)
    expect(screen.getByText('Redistribution Ops')).toBeInTheDocument();

    // Equipment Issues = 1 (equipment under maintenance / overdue)
    expect(screen.getByText('Equipment Issues')).toBeInTheDocument();

    // Pending Actions = 1 (pending recs) + 3 (critical alerts) = 4
    expect(screen.getByText('Pending Actions')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('4. Displays role scope badge corresponding to user context', async () => {
    vi.mocked(dashboardAPI.getSummary).mockResolvedValue({ data: mockSummaryData } as any);
    vi.mocked(dashboardAPI.getStockRisks).mockResolvedValue({ data: [] } as any);
    vi.mocked(dashboardAPI.getExpiryRisks).mockResolvedValue({ data: [] } as any);
    vi.mocked(recommendationsAPI.list).mockResolvedValue({ data: [] } as any);
    vi.mocked(equipmentAPI.list).mockResolvedValue({ data: [] } as any);

    renderDashboardWithUser(mockDistrictAdminUser);

    expect(await screen.findByTestId('admin-dashboard')).toBeInTheDocument();
    expect(screen.getByText(/District Admin · State ID 1 · District ID 4/i)).toBeInTheDocument();
  });

  it('5. Renders stock risk distribution and stock-risk comparison sections', async () => {
    vi.mocked(dashboardAPI.getSummary).mockResolvedValue({ data: mockSummaryData } as any);
    vi.mocked(dashboardAPI.getStockRisks).mockResolvedValue({ data: mockStockRisks } as any);
    vi.mocked(dashboardAPI.getExpiryRisks).mockResolvedValue({ data: mockExpiryRisks } as any);
    vi.mocked(recommendationsAPI.list).mockResolvedValue({ data: mockRecommendations } as any);
    vi.mocked(equipmentAPI.list).mockResolvedValue({ data: mockEquipment } as any);

    renderDashboardWithUser();

    expect(await screen.findByTestId('risk-distribution-section')).toBeInTheDocument();
    expect(screen.getByTestId('stock-risk-chart-section')).toBeInTheDocument();
    expect(screen.getByTestId('stock-risk-recharts')).toBeInTheDocument();

    expect(screen.getByText('Oxygen Cyl…')).toBeInTheDocument();
    expect(screen.getByText('PPE Kits')).toBeInTheDocument();
  });

  it('6. Handles empty states gracefully for expiry risks, recommendations, and critical alerts', async () => {
    const emptySummary: DashboardSummary = {
      kpis: {
        total_facilities: 5,
        total_items: 100,
        critical_alerts: 0,
        low_stock_items: 0,
        predicted_demand_count: 0,
      },
      recent_alerts: [],
      stock_summary: { critical: 0, low: 0, adequate: 100, overstocked: 0 },
    };

    vi.mocked(dashboardAPI.getSummary).mockResolvedValue({ data: emptySummary } as any);
    vi.mocked(dashboardAPI.getStockRisks).mockResolvedValue({ data: [] } as any);
    vi.mocked(dashboardAPI.getExpiryRisks).mockResolvedValue({ data: [] } as any);
    vi.mocked(recommendationsAPI.list).mockResolvedValue({ data: [] } as any);
    vi.mocked(equipmentAPI.list).mockResolvedValue({ data: [] } as any);

    renderDashboardWithUser();

    expect(await screen.findByTestId('admin-dashboard')).toBeInTheDocument();

    expect(screen.getByText('No Expiring Batches')).toBeInTheDocument();
    expect(screen.getByText('No Recommendations Found')).toBeInTheDocument();
    expect(screen.getByText('All Clear!')).toBeInTheDocument();
    expect(screen.getByText('No High Stock-Out Risks')).toBeInTheDocument();
  });
});
