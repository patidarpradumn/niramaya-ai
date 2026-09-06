import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Equipment from '../pages/Equipment';
import EquipmentDetail from '../pages/EquipmentDetail';
import { equipmentAPI, maintenanceAPI } from '../services/api';
import type { User, Equipment as EquipmentType, MaintenanceRecord, EquipmentDowntimeAnalysis } from '../types';

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

// Mock APIs
vi.mock('../services/api', () => ({
  equipmentAPI: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getOverdue: vi.fn(),
    getDowntime: vi.fn(),
    getMaintenanceHistory: vi.fn(),
  },
  maintenanceAPI: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
  },
}));

const mockEquipmentList: EquipmentType[] = [
  {
    id: 501,
    facility_id: 1,
    name: 'ICU Ventilator Servo-u',
    equipment_type: 'Ventilator',
    serial_number: 'SN-VEN-8812',
    status: 'OPERATIONAL',
    installation_date: '2024-03-15T00:00:00Z',
    purchase_date: '2024-02-10T00:00:00Z',
    last_maintenance_date: '2026-06-01T00:00:00Z',
    next_maintenance_date: '2026-12-01T00:00:00Z',
    downtime_hours: 12.5,
    facility_name: 'AIIMS Central Hospital',
    is_overdue_maintenance: false,
    downtime_days: 0.52,
    created_at: '2024-03-15T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
  },
  {
    id: 502,
    facility_id: 1,
    name: 'MRI Magnetom 3T',
    equipment_type: 'MRI Scanner',
    serial_number: 'SN-MRI-309',
    status: 'UNDER_MAINTENANCE',
    installation_date: '2023-01-20T00:00:00Z',
    purchase_date: '2022-11-15T00:00:00Z',
    last_maintenance_date: '2026-01-10T00:00:00Z',
    next_maintenance_date: '2026-07-10T00:00:00Z',
    downtime_hours: 48.0,
    facility_name: 'AIIMS Central Hospital',
    is_overdue_maintenance: true,
    downtime_days: 2.0,
    created_at: '2023-01-20T00:00:00Z',
    updated_at: '2026-01-10T00:00:00Z',
  },
  {
    id: 503,
    facility_id: 2,
    name: 'Defibrillator Lifepak 20e',
    equipment_type: 'Defibrillator',
    serial_number: 'SN-DEF-900',
    status: 'NON_FUNCTIONAL',
    installation_date: '2025-05-10T00:00:00Z',
    purchase_date: '2025-04-01T00:00:00Z',
    last_maintenance_date: '2025-11-15T00:00:00Z',
    next_maintenance_date: '2026-05-15T00:00:00Z',
    downtime_hours: 96.0,
    facility_name: 'District General Hospital Pune',
    is_overdue_maintenance: true,
    downtime_days: 4.0,
    created_at: '2025-05-10T00:00:00Z',
    updated_at: '2025-11-15T00:00:00Z',
  },
];

const mockMaintenanceHistory: MaintenanceRecord[] = [
  {
    id: 601,
    equipment_id: 501,
    equipment_name: 'ICU Ventilator Servo-u',
    facility_id: 1,
    description: 'Quarterly sensor calibration and air intake filter replacement.',
    performed_by: 'MedTech Services / Eng. Rahul',
    cost: 4500,
    maintenance_date: '2026-06-01T00:00:00Z',
    next_due_date: '2026-12-01T00:00:00Z',
    maintenance_type: 'ROUTINE',
    downtime_hours: 3.5,
    created_at: '2026-06-01T10:00:00Z',
  },
  {
    id: 602,
    equipment_id: 501,
    equipment_name: 'ICU Ventilator Servo-u',
    facility_id: 1,
    description: 'Initial commissioning inspection and safety certification.',
    performed_by: 'Manufacturer OEM Technician',
    cost: 0,
    maintenance_date: '2024-03-15T00:00:00Z',
    next_due_date: '2024-09-15T00:00:00Z',
    maintenance_type: 'INSPECTION',
    downtime_hours: 0,
    created_at: '2024-03-15T14:00:00Z',
  },
];

const mockDowntimeStats: EquipmentDowntimeAnalysis = {
  equipment_id: 501,
  equipment_name: 'ICU Ventilator Servo-u',
  status: 'OPERATIONAL',
  total_downtime_hours: 12.5,
  total_downtime_days: 0.52,
  uptime_percentage: 99.4,
  last_maintenance_date: '2026-06-01T00:00:00Z',
  next_maintenance_date: '2026-12-01T00:00:00Z',
  is_overdue: false,
  maintenance_count: 2,
};

describe('PHASE 24 — Equipment & Maintenance Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = {
      id: 1,
      email: 'admin@mediguard.org',
      full_name: 'Dr. Biomedical Admin',
      role: 'hospital_admin',
      facility_id: 1,
      state_id: 1,
      district_id: 1,
      is_active: true,
      created_at: '2026-01-01',
    };

    (equipmentAPI.list as any).mockResolvedValue({ data: mockEquipmentList });
    (equipmentAPI.get as any).mockImplementation((id: number) => {
      const found = mockEquipmentList.find(e => e.id === id);
      if (found) return Promise.resolve({ data: found });
      return Promise.reject({ response: { data: { detail: 'Equipment not found' }, status: 404 } });
    });
    (equipmentAPI.getMaintenanceHistory as any).mockResolvedValue({ data: mockMaintenanceHistory });
    (equipmentAPI.getDowntime as any).mockResolvedValue({ data: mockDowntimeStats });
  });

  describe('Equipment Directory List View (/equipment)', () => {
    it('renders equipment cards with name, status badges, types, and KPI metrics', async () => {
      render(
        <MemoryRouter>
          <Equipment />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('ICU Ventilator Servo-u')).toBeInTheDocument();
      });

      // KPI counters
      expect(screen.getByTestId('kpi-total-equipment')).toHaveTextContent('3');
      expect(screen.getByTestId('kpi-overdue-count')).toHaveTextContent('2');

      // Devices in cards
      expect(screen.getByText('MRI Magnetom 3T')).toBeInTheDocument();
      expect(screen.getByText('Defibrillator Lifepak 20e')).toBeInTheDocument();
      expect(screen.getByText('OPERATIONAL')).toBeInTheDocument();
      expect(screen.getByText('UNDER MAINTENANCE')).toBeInTheDocument();
      expect(screen.getByText('NON FUNCTIONAL')).toBeInTheDocument();
      expect(screen.getAllByText('Maintenance Overdue').length).toBeGreaterThanOrEqual(2);
    });

    it('filters equipment list by search keyword', async () => {
      render(
        <MemoryRouter>
          <Equipment />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('ICU Ventilator Servo-u')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('equipment-search-input');
      fireEvent.change(searchInput, { target: { value: 'MRI Scanner' } });

      await waitFor(() => {
        expect(screen.getByText('MRI Magnetom 3T')).toBeInTheDocument();
        expect(screen.queryByText('ICU Ventilator Servo-u')).not.toBeInTheDocument();
      });
    });

    it('filters equipment by status dropdown', async () => {
      render(
        <MemoryRouter>
          <Equipment />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(equipmentAPI.list).toHaveBeenCalled();
      });

      const statusFilter = screen.getByTestId('equipment-status-filter');
      fireEvent.change(statusFilter, { target: { value: 'OPERATIONAL' } });

      await waitFor(() => {
        expect(equipmentAPI.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'OPERATIONAL' }));
      });
    });

    it('filters equipment by overdue servicing schedule', async () => {
      render(
        <MemoryRouter>
          <Equipment />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(equipmentAPI.list).toHaveBeenCalled();
      });

      const overdueFilter = screen.getByTestId('equipment-overdue-filter');
      fireEvent.change(overdueFilter, { target: { value: 'true' } });

      await waitFor(() => {
        expect(equipmentAPI.list).toHaveBeenCalledWith(expect.objectContaining({ is_overdue: true }));
      });
    });

    it('allows authorized admin to register new medical equipment', async () => {
      const newEquipment: EquipmentType = {
        id: 504,
        facility_id: 1,
        name: 'Autoclave Sterilizer Class B',
        equipment_type: 'Autoclave / Sterilizer',
        serial_number: 'SN-AUTO-101',
        status: 'OPERATIONAL',
        installation_date: '2026-09-01T00:00:00Z',
        purchase_date: '2026-08-15T00:00:00Z',
        last_maintenance_date: null,
        next_maintenance_date: '2027-03-01T00:00:00Z',
        downtime_hours: 0,
        facility_name: 'AIIMS Central Hospital',
        is_overdue_maintenance: false,
        downtime_days: 0,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      };
      (equipmentAPI.create as any).mockResolvedValue({ data: newEquipment });

      render(
        <MemoryRouter>
          <Equipment />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('register-equipment-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('register-equipment-btn'));

      // Fill modal form
      const nameInput = screen.getByTestId('create-equipment-name-input');
      const serialInput = screen.getByTestId('create-equipment-serial-input');
      const nextDueInput = screen.getByTestId('create-equipment-next-due-input');

      fireEvent.change(nameInput, { target: { value: 'Autoclave Sterilizer Class B' } });
      fireEvent.change(serialInput, { target: { value: 'SN-AUTO-101' } });
      fireEvent.change(nextDueInput, { target: { value: '2027-03-01' } });

      fireEvent.click(screen.getByTestId('create-equipment-submit'));

      await waitFor(() => {
        expect(equipmentAPI.create).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Autoclave Sterilizer Class B',
          serial_number: 'SN-AUTO-101',
          next_maintenance_date: '2027-03-01',
        }));
        expect(screen.getByTestId('equipment-feedback-banner')).toHaveTextContent(/registered successfully/i);
      });
    });

    it('displays error banner and retry option when list API fails', async () => {
      (equipmentAPI.list as any).mockRejectedValueOnce(new Error('Telemetry sensor network timeout'));

      render(
        <MemoryRouter>
          <Equipment />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Unable to fetch equipment records/)).toBeInTheDocument();
        expect(screen.getByText('Telemetry sensor network timeout')).toBeInTheDocument();
      });

      (equipmentAPI.list as any).mockResolvedValueOnce({ data: mockEquipmentList });
      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.getByText('ICU Ventilator Servo-u')).toBeInTheDocument();
      });
    });
  });

  describe('Equipment Details View (/equipment/:id)', () => {
    it('renders equipment telemetry, downtime analytics, and maintenance history timeline', async () => {
      render(
        <MemoryRouter initialEntries={['/equipment/501']}>
          <Routes>
            <Route path="/equipment/:id" element={<EquipmentDetail />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('equipment-detail-name')).toHaveTextContent('ICU Ventilator Servo-u');
      });

      expect(screen.getByTestId('detail-status-badge')).toHaveTextContent('OPERATIONAL');
      expect(screen.getByTestId('detail-downtime-hours')).toHaveTextContent('12.5 Hours');
      expect(screen.getByText('99.4%')).toBeInTheDocument();

      // Maintenance history timeline
      expect(screen.getByTestId('maintenance-record-601')).toBeInTheDocument();
      expect(screen.getByText(/Quarterly sensor calibration/)).toBeInTheDocument();
      expect(screen.getByText(/MedTech Services \/ Eng. Rahul/)).toBeInTheDocument();
      expect(screen.getByText('Cost: ₹4500')).toBeInTheDocument();
    });

    it('allows staff to edit equipment details and transition operational status', async () => {
      const updatedEquipment: EquipmentType = {
        ...mockEquipmentList[0],
        status: 'UNDER_MAINTENANCE' as const,
        downtime_hours: 18.0,
      };
      (equipmentAPI.update as any).mockResolvedValue({ data: updatedEquipment });

      render(
        <MemoryRouter initialEntries={['/equipment/501']}>
          <Routes>
            <Route path="/equipment/:id" element={<EquipmentDetail />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('edit-equipment-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('edit-equipment-btn'));

      // Edit modal
      const statusSelect = screen.getByTestId('update-equipment-status-select');
      const downtimeInput = screen.getByTestId('update-equipment-downtime-input');

      fireEvent.change(statusSelect, { target: { value: 'UNDER_MAINTENANCE' } });
      fireEvent.change(downtimeInput, { target: { value: '18' } });

      fireEvent.click(screen.getByTestId('update-equipment-submit'));

      await waitFor(() => {
        expect(equipmentAPI.update).toHaveBeenCalledWith(501, expect.objectContaining({
          status: 'UNDER_MAINTENANCE',
          downtime_hours: 18,
        }));
        expect(screen.getByTestId('detail-feedback-banner')).toHaveTextContent(/updated successfully/i);
      });
    });

    it('allows staff to log a maintenance service event and update schedule', async () => {
      const createdRecord: MaintenanceRecord = {
        id: 603,
        equipment_id: 501,
        description: 'Replaced oxygen flow valve and performed pressure test.',
        performed_by: 'Senior BioMed Engineer',
        cost: 6200,
        maintenance_date: '2026-09-06T00:00:00Z',
        next_due_date: '2027-03-06T00:00:00Z',
        maintenance_type: 'REPAIR',
        downtime_hours: 4.0,
        created_at: '2026-09-06T12:00:00Z',
      };
      (maintenanceAPI.create as any).mockResolvedValue({ data: createdRecord });

      render(
        <MemoryRouter initialEntries={['/equipment/501']}>
          <Routes>
            <Route path="/equipment/:id" element={<EquipmentDetail />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('log-maintenance-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('log-maintenance-btn'));

      // Fill log maintenance modal
      const descInput = screen.getByTestId('log-maintenance-desc-input');
      const costInput = screen.getByTestId('log-maintenance-cost-input');
      const nextDueInput = screen.getByTestId('log-maintenance-next-due-input');

      fireEvent.change(descInput, { target: { value: 'Replaced oxygen flow valve and performed pressure test.' } });
      fireEvent.change(costInput, { target: { value: '6200' } });
      fireEvent.change(nextDueInput, { target: { value: '2027-03-06' } });

      fireEvent.click(screen.getByTestId('log-maintenance-submit'));

      await waitFor(() => {
        expect(maintenanceAPI.create).toHaveBeenCalledWith(expect.objectContaining({
          equipment_id: 501,
          description: 'Replaced oxygen flow valve and performed pressure test.',
          cost: 6200,
          next_due_date: '2027-03-06',
        }));
      });
    });

    it('renders 404 state when equipment ID is invalid or not found', async () => {
      render(
        <MemoryRouter initialEntries={['/equipment/99999']}>
          <Routes>
            <Route path="/equipment/:id" element={<EquipmentDetail />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Equipment Record Not Found')).toBeInTheDocument();
        expect(screen.getByText('Return to Equipment Fleet')).toBeInTheDocument();
      });
    });
  });

  describe('Role-Based Permissions', () => {
    it('restricts public citizen role from seeing action or registration buttons', async () => {
      mockCurrentUser = {
        id: 99,
        email: 'citizen@example.com',
        full_name: 'Public Citizen',
        role: 'citizen',
        facility_id: null,
        state_id: null,
        district_id: null,
        is_active: true,
        created_at: '2026-01-01',
      };

      const { unmount } = render(
        <MemoryRouter>
          <Equipment />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('ICU Ventilator Servo-u')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('register-equipment-btn')).not.toBeInTheDocument();

      unmount();

      render(
        <MemoryRouter initialEntries={['/equipment/501']}>
          <Routes>
            <Route path="/equipment/:id" element={<EquipmentDetail />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('equipment-detail-name')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('edit-equipment-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('log-maintenance-btn')).not.toBeInTheDocument();
    });
  });
});
