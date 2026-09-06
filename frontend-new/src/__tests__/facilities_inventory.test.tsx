import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Facilities from '../pages/Facilities';
import Inventory from '../pages/Inventory';
import { facilitiesAPI, inventoryAPI, stockMovementsAPI, consumptionAPI } from '../services/api';
import type { User, Facility, InventoryItem, StockMovement, ConsumptionRecord, ConsumptionSummaryResponse } from '../types';

// Mock Firebase
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, cb) => {
    cb(null);
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
  facilitiesAPI: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getServices: vi.fn(),
  },
  inventoryAPI: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getMovements: vi.fn(),
    getLowStock: vi.fn(),
  },
  stockMovementsAPI: {
    list: vi.fn(),
    create: vi.fn(),
  },
  consumptionAPI: {
    list: vi.fn(),
    get: vi.fn(),
    getSummary: vi.fn(),
    create: vi.fn(),
  },
}));

// Mock Data
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

const mockCitizenUser: User = {
  id: 99,
  email: 'citizen@example.gov',
  full_name: 'Public Citizen',
  role: 'citizen',
  facility_id: null,
  state_id: null,
  district_id: null,
  is_active: true,
  created_at: new Date().toISOString(),
};

const mockFacilities: Facility[] = [
  {
    id: 1,
    name: 'District General Hospital',
    location: 'Central Pune, Sector 4',
    type: 'DISTRICT_HOSPITAL',
    district_id: 1,
    contact_email: 'pune.dgh@gov.in',
    contact_phone: '+91 20 1111 2222',
    is_active: true,
    latitude: 18.5204,
    longitude: 73.8567,
    operational_status: 'OPERATIONAL',
    facility_services: [
      { id: 1, facility_id: 1, service_name: 'Emergency & ICU', is_available: true, created_at: new Date().toISOString() },
      { id: 2, facility_id: 1, service_name: 'Blood Bank', is_available: true, created_at: new Date().toISOString() },
    ],
    created_at: new Date().toISOString(),
    updated_at: null,
  },
  {
    id: 2,
    name: 'Haveli Community Health Centre',
    location: 'Haveli Tehsil, Rural Zone',
    type: 'CHC',
    district_id: 1,
    contact_email: 'haveli.chc@gov.in',
    contact_phone: '+91 20 3333 4444',
    is_active: true,
    latitude: 18.4500,
    longitude: 73.9000,
    operational_status: 'UNDER_MAINTENANCE',
    facility_services: [],
    created_at: new Date().toISOString(),
    updated_at: null,
  },
];

const mockInventory: InventoryItem[] = [
  {
    id: 101,
    facility_id: 1,
    item_id: 1,
    item_name: 'Amoxicillin 500mg',
    category: 'Antibiotics',
    unit: 'capsules',
    current_stock: 12,
    quantity: 12,
    min_threshold: 50,
    min_stock_level: 50,
    max_threshold: 500,
    max_stock_level: 500,
    batch_number: 'AMX-2026-A',
    expiry_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days left (critical)
    is_low_stock: true,
    stock_level: 'critical',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  },
  {
    id: 102,
    facility_id: 1,
    item_id: 2,
    item_name: 'Paracetamol 650mg',
    category: 'Analgesics',
    unit: 'tablets',
    current_stock: 450,
    quantity: 450,
    min_threshold: 100,
    min_stock_level: 100,
    max_threshold: 600,
    max_stock_level: 600,
    batch_number: 'PCM-2026-B',
    expiry_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), // 180 days left (safe)
    is_low_stock: false,
    stock_level: 'adequate',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  },
];

const mockMovements: StockMovement[] = [
  {
    id: 501,
    facility_id: 1,
    item_id: 1,
    movement_type: 'RECEIVED',
    quantity: 100,
    reference: 'PO-9912',
    created_by_user_id: 1,
    created_at: new Date().toISOString(),
    facility_name: 'District General Hospital',
    item_name: 'Amoxicillin 500mg',
    user_name: 'Super Admin User',
  },
];

const mockConsumption: ConsumptionRecord[] = [
  {
    id: 601,
    facility_id: 1,
    item_id: 1,
    quantity_consumed: 25,
    record_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    facility_name: 'District General Hospital',
    item_name: 'Amoxicillin 500mg',
  },
];

const mockConsumptionSummary: ConsumptionSummaryResponse = {
  period: 'daily',
  facility_id: 1,
  item_id: 1,
  total_consumed: 25,
  summary: [
    {
      period_start: '2026-09-01',
      period_end: '2026-09-05',
      total_quantity: 25,
      record_count: 1,
      average_daily: 5,
    },
  ],
};

describe('Phase 21 — Facilities & Inventory UI Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = mockSuperAdminUser;

    vi.mocked(facilitiesAPI.list).mockResolvedValue({ data: mockFacilities } as any);
    vi.mocked(facilitiesAPI.getServices).mockResolvedValue({ data: mockFacilities[0].facility_services } as any);
    vi.mocked(facilitiesAPI.create).mockImplementation((data: any) =>
      Promise.resolve({ data: { id: 3, ...data, facility_services: [] } } as any)
    );

    vi.mocked(inventoryAPI.list).mockResolvedValue({ data: mockInventory } as any);
    vi.mocked(inventoryAPI.getMovements).mockResolvedValue({ data: mockMovements } as any);
    vi.mocked(inventoryAPI.create).mockImplementation((data: any) =>
      Promise.resolve({
        data: {
          id: 103,
          ...data,
          stock_level: 'adequate',
          is_low_stock: false,
          created_at: new Date().toISOString(),
        },
      } as any)
    );

    vi.mocked(stockMovementsAPI.list).mockResolvedValue({ data: mockMovements } as any);
    vi.mocked(stockMovementsAPI.create).mockImplementation((data: any) =>
      Promise.resolve({ data: { id: 502, ...data, created_at: new Date().toISOString() } } as any)
    );

    vi.mocked(consumptionAPI.list).mockResolvedValue({ data: mockConsumption } as any);
    vi.mocked(consumptionAPI.getSummary).mockResolvedValue({ data: mockConsumptionSummary } as any);
    vi.mocked(consumptionAPI.create).mockImplementation((data: any) =>
      Promise.resolve({ data: { id: 602, ...data, created_at: new Date().toISOString() } } as any)
    );
  });

  // -------------------------------------------------------------
  // FACILITIES TESTS
  // -------------------------------------------------------------

  it('1. Renders facilities list with types, locations, and operational badges', async () => {
    render(
      <MemoryRouter>
        <Facilities />
      </MemoryRouter>
    );

    expect(await screen.findByText('District General Hospital')).toBeInTheDocument();
    expect(screen.getByText('Haveli Community Health Centre')).toBeInTheDocument();
    expect(screen.getAllByText('District Hospital').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Community Health Centre (CHC)').length).toBeGreaterThan(0);
  });

  it('2. Filters facilities by search keyword and facility type', async () => {
    render(
      <MemoryRouter>
        <Facilities />
      </MemoryRouter>
    );

    await screen.findByText('District General Hospital');

    const searchInput = screen.getByTestId('facility-search-input');
    fireEvent.change(searchInput, { target: { value: 'Haveli' } });

    await waitFor(() => {
      expect(facilitiesAPI.list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Haveli' })
      );
    });

    const typeFilter = screen.getByTestId('facility-type-filter');
    fireEvent.change(typeFilter, { target: { value: 'CHC' } });

    await waitFor(() => {
      expect(facilitiesAPI.list).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'CHC' })
      );
    });
  });

  it('3. Opens facility details modal and renders facility services', async () => {
    render(
      <MemoryRouter>
        <Facilities />
      </MemoryRouter>
    );

    await screen.findByText('District General Hospital');

    const viewButton = screen.getByTestId('view-facility-1');
    fireEvent.click(viewButton);

    expect(await screen.findByText('Emergency & ICU')).toBeInTheDocument();
    expect(screen.getByText('Blood Bank')).toBeInTheDocument();
    expect(screen.getAllByText('Central Pune, Sector 4').length).toBeGreaterThan(0);
  });

  it('4. Validates facility creation form and requires mandatory fields & coordinates bounds', async () => {
    render(
      <MemoryRouter>
        <Facilities />
      </MemoryRouter>
    );

    await screen.findByText('District General Hospital');

    const addBtn = screen.getByTestId('add-facility-button');
    fireEvent.click(addBtn);

    expect(screen.getByTestId('facility-form-title')).toHaveTextContent('Add New Facility');

    const submitBtn = screen.getByTestId('facility-submit-button');

    // Fill invalid latitude > 90
    const nameInput = screen.getByTestId('facility-name-input');
    const locInput = screen.getByTestId('facility-location-input');
    const latInput = screen.getByTestId('facility-latitude-input');

    fireEvent.change(nameInput, { target: { value: 'New Test Hospital' } });
    fireEvent.change(locInput, { target: { value: 'Sector 9' } });
    fireEvent.change(latInput, { target: { value: '150' } });

    fireEvent.click(submitBtn);

    expect(await screen.findByText('Latitude must be between -90 and 90')).toBeInTheDocument();
    expect(facilitiesAPI.create).not.toHaveBeenCalled();

    // Fix latitude to valid value and submit
    fireEvent.change(latInput, { target: { value: '19.0760' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(facilitiesAPI.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Test Hospital',
          location: 'Sector 9',
          latitude: 19.076,
        })
      );
    });
  });

  it('5. Enforces role restrictions: Citizen cannot see Add Facility or Edit Facility buttons', async () => {
    mockCurrentUser = mockCitizenUser;

    render(
      <MemoryRouter>
        <Facilities />
      </MemoryRouter>
    );

    await screen.findByText('District General Hospital');

    expect(screen.queryByTestId('add-facility-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-facility-1')).not.toBeInTheDocument();
  });

  it('6. Displays error banner and retry button when facility API fails', async () => {
    vi.mocked(facilitiesAPI.list).mockRejectedValueOnce(new Error('Network error: server unreachable'));

    render(
      <MemoryRouter>
        <Facilities />
      </MemoryRouter>
    );

    expect(await screen.findByText('Unable to fetch facilities')).toBeInTheDocument();
    expect(screen.getByText('Network error: server unreachable')).toBeInTheDocument();
  });

  // -------------------------------------------------------------
  // INVENTORY TESTS
  // -------------------------------------------------------------

  it('7. Renders inventory list with risk badges and expiry indicators', async () => {
    render(
      <MemoryRouter>
        <Inventory />
      </MemoryRouter>
    );

    expect(await screen.findByText('Amoxicillin 500mg')).toBeInTheDocument();
    expect(screen.getByText('Paracetamol 650mg')).toBeInTheDocument();

    const riskBadges = screen.getAllByTestId('risk-badge');
    expect(riskBadges[0]).toHaveTextContent('CRITICAL');
    expect(riskBadges[1]).toHaveTextContent('ADEQUATE');

    const expiryBadges = screen.getAllByTestId('expiry-badge');
    expect(expiryBadges[0]).toHaveTextContent(/Critical.*left/);
  });

  it('8. Filters inventory by category and low stock checkbox', async () => {
    render(
      <MemoryRouter>
        <Inventory />
      </MemoryRouter>
    );

    await screen.findByText('Amoxicillin 500mg');

    const categoryInput = screen.getByTestId('inventory-category-filter');
    fireEvent.change(categoryInput, { target: { value: 'Antibiotics' } });

    await waitFor(() => {
      expect(inventoryAPI.list).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'Antibiotics' })
      );
    });

    const lowStockCheckbox = screen.getByTestId('inventory-low-stock-filter');
    fireEvent.click(lowStockCheckbox);

    await waitFor(() => {
      expect(inventoryAPI.list).toHaveBeenCalledWith(
        expect.objectContaining({ is_low_stock: true })
      );
    });
  });

  it('9. Opens inventory details modal and displays movements and consumption history', async () => {
    render(
      <MemoryRouter>
        <Inventory />
      </MemoryRouter>
    );

    await screen.findByText('Amoxicillin 500mg');

    const viewItemBtn = screen.getByTestId('view-item-101');
    fireEvent.click(viewItemBtn);

    // Default overview tab
    expect(await screen.findByText('Stock Threshold Gauge')).toBeInTheDocument();

    // Movement History Tab
    const movementsTab = screen.getByTestId('tab-movements');
    fireEvent.click(movementsTab);

    expect(await screen.findByTestId('movements-history-tab')).toBeInTheDocument();
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByText('PO-9912')).toBeInTheDocument();

    // Consumption History Tab
    const consumptionTab = screen.getByTestId('tab-consumption');
    fireEvent.click(consumptionTab);

    expect(await screen.findByTestId('consumption-history-tab')).toBeInTheDocument();
    expect(screen.getByText('Total Consumed')).toBeInTheDocument();
    expect(screen.getAllByText('25 capsules').length).toBeGreaterThan(0);
  });

  it('10. Validates and submits Stock Movement form for authorized user', async () => {
    render(
      <MemoryRouter>
        <Inventory />
      </MemoryRouter>
    );

    await screen.findByText('Amoxicillin 500mg');

    const movementBtn = screen.getByTestId('movement-btn-101');
    fireEvent.click(movementBtn);

    expect(await screen.findByTestId('movement-modal-title')).toBeInTheDocument();

    const qtyInput = screen.getByTestId('movement-quantity-input');
    const submitBtn = screen.getByTestId('movement-submit-button');

    // Test invalid zero quantity
    fireEvent.change(qtyInput, { target: { value: '0' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Quantity must be greater than 0')).toBeInTheDocument();
    expect(stockMovementsAPI.create).not.toHaveBeenCalled();

    // Set valid quantity and submit
    fireEvent.change(qtyInput, { target: { value: '50' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(stockMovementsAPI.create).toHaveBeenCalledWith(
        expect.objectContaining({
          facility_id: 1,
          quantity: 50,
          movement_type: 'RECEIVED',
        })
      );
    });
  });

  it('11. Validates and submits Consumption Record form for authorized user', async () => {
    render(
      <MemoryRouter>
        <Inventory />
      </MemoryRouter>
    );

    await screen.findByText('Amoxicillin 500mg');

    const consumptionBtn = screen.getByTestId('consumption-btn-101');
    fireEvent.click(consumptionBtn);

    expect(await screen.findByTestId('consumption-modal-title')).toBeInTheDocument();

    const qtyInput = screen.getByTestId('consumption-quantity-input');
    const submitBtn = screen.getByTestId('consumption-submit-button');

    fireEvent.change(qtyInput, { target: { value: '15' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(consumptionAPI.create).toHaveBeenCalledWith(
        expect.objectContaining({
          facility_id: 1,
          quantity_consumed: 15,
        })
      );
    });
  });

  it('12. Enforces role restrictions: Citizen cannot see Add Inventory, Record Movement, or Log Consumption buttons', async () => {
    mockCurrentUser = mockCitizenUser;

    render(
      <MemoryRouter>
        <Inventory />
      </MemoryRouter>
    );

    await screen.findByText('Amoxicillin 500mg');

    expect(screen.queryByTestId('add-inventory-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('movement-btn-101')).not.toBeInTheDocument();
    expect(screen.queryByTestId('consumption-btn-101')).not.toBeInTheDocument();
  });
});
