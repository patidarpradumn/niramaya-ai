import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Recommendations from '../pages/Recommendations';
import { recommendationsAPI } from '../services/api';
import type { User, Recommendation } from '../types';

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

// Mock recommendationsAPI
vi.mock('../services/api', () => ({
  recommendationsAPI: {
    list: vi.fn(),
    get: vi.fn(),
    generate: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    modify: vi.fn(),
  },
}));

const mockRecommendations: Recommendation[] = [
  {
    id: 301,
    title: 'Redistribute Covaxin 0.5ml from District Depot Pune to AIIMS Central',
    action_type: 'REDISTRIBUTION',
    facility_id: 1,
    source_facility_id: 2,
    destination_facility_id: 1,
    item_id: 5,
    prediction_id: 201,
    risk_id: 101,
    suggested_quantity: 40,
    reasoning: "Facility 'District Depot Pune' has surplus stock (180 units) for Covaxin 0.5ml. Destination facility 'AIIMS Central' has safety deficit with 12 units remaining. Estimated transfer volume: 40 units.",
    details: {
      source_facility_name: 'District Depot Pune',
      destination_facility_name: 'AIIMS Central Hospital',
      source_current_stock: 180,
      target_current_stock: 12,
      distance_km: 14.8,
      priority: 'CRITICAL',
    },
    status: 'PENDING',
    facility_name: 'AIIMS Central Hospital',
    source_facility_name: 'District Depot Pune',
    destination_facility_name: 'AIIMS Central Hospital',
    item_name: 'Covaxin 0.5ml',
    approval_actions: [],
    created_at: '2026-09-04T10:00:00Z',
    updated_at: '2026-09-04T10:00:00Z',
  },
  {
    id: 302,
    title: 'Redistribute Paracetamol IV from CHC Hadapsar to District Hospital',
    action_type: 'REDISTRIBUTION',
    facility_id: 2,
    source_facility_id: 3,
    destination_facility_id: 2,
    item_id: 8,
    prediction_id: null,
    risk_id: null,
    suggested_quantity: 60,
    reasoning: "Surplus inventory identified at CHC Hadapsar exceeding 90-day demand.",
    details: {
      source_facility_name: 'CHC Hadapsar',
      destination_facility_name: 'District General Hospital',
      source_current_stock: 350,
      target_current_stock: 25,
      distance_km: 8.2,
      priority: 'HIGH',
    },
    status: 'APPROVED',
    facility_name: 'District General Hospital',
    source_facility_name: 'CHC Hadapsar',
    destination_facility_name: 'District General Hospital',
    item_name: 'Paracetamol IV 100ml',
    approval_actions: [
      {
        id: 1,
        recommendation_id: 302,
        transfer_id: 55,
        user_id: 1,
        action: 'APPROVED',
        notes: 'Approved standard weekly transfer route.',
        created_at: '2026-09-04T14:30:00Z',
      },
    ],
    created_at: '2026-09-03T09:00:00Z',
    updated_at: '2026-09-04T14:30:00Z',
  },
  {
    id: 303,
    title: 'Redistribute O2 Cylinders from Depot to Rural Clinic',
    action_type: 'REDISTRIBUTION',
    facility_id: 4,
    source_facility_id: 2,
    destination_facility_id: 4,
    item_id: 12,
    prediction_id: null,
    risk_id: null,
    suggested_quantity: 15,
    reasoning: 'Rebalance oxygen reserves for seasonal respiratory preparedness.',
    details: {
      source_facility_name: 'District Depot Pune',
      destination_facility_name: 'Rural PHC Khed',
      source_current_stock: 80,
      target_current_stock: 2,
      priority: 'MEDIUM',
    },
    status: 'REJECTED',
    facility_name: 'Rural PHC Khed',
    source_facility_name: 'District Depot Pune',
    destination_facility_name: 'Rural PHC Khed',
    item_name: 'Medical Oxygen Cylinder 40L',
    approval_actions: [
      {
        id: 2,
        recommendation_id: 303,
        transfer_id: null,
        user_id: 1,
        action: 'REJECTED',
        notes: 'Rural PHC undergoing storage renovation; cannot receive large shipment.',
        created_at: '2026-09-04T16:00:00Z',
      },
    ],
    created_at: '2026-09-02T11:00:00Z',
    updated_at: '2026-09-04T16:00:00Z',
  },
];

describe('PHASE 23 — Redistribution & Approval Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = {
      id: 1,
      email: 'admin@mediguard.org',
      full_name: 'Dr. Supply Coordinator',
      role: 'hospital_admin',
      facility_id: 1,
      state_id: 1,
      district_id: 1,
      is_active: true,
      created_at: '2026-01-01',
    };

    (recommendationsAPI.list as any).mockResolvedValue({ data: mockRecommendations });
    (recommendationsAPI.get as any).mockImplementation((id: number) => {
      const found = mockRecommendations.find(r => r.id === id);
      if (found) return Promise.resolve({ data: found });
      return Promise.reject({ response: { data: { detail: 'Recommendation not found' }, status: 404 } });
    });
  });

  describe('Recommendations List Rendering & Overview', () => {
    it('renders recommendation cards with source, destination, payload, and metric counters', async () => {
      render(
        <MemoryRouter>
          <Recommendations />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Redistribute Covaxin 0.5ml from District Depot Pune to AIIMS Central/)).toBeInTheDocument();
      });

      // Metric cards
      expect(screen.getByText('Pending Approvals')).toBeInTheDocument();
      expect(screen.getByText('Approved Transfers')).toBeInTheDocument();
      expect(screen.getByText('Rejected / Closed')).toBeInTheDocument();

      // Card details
      expect(screen.getAllByText('District Depot Pune').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('AIIMS Central Hospital').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('40 units')).toBeInTheDocument();
      expect(screen.getByText(/Facility 'District Depot Pune' has surplus stock/)).toBeInTheDocument();
      expect(screen.getByText('~14.8 km apart')).toBeInTheDocument();
      expect(screen.getByText('Priority: CRITICAL')).toBeInTheDocument();
    });

    it('renders audit / approval action trail on previously processed recommendations', async () => {
      render(
        <MemoryRouter>
          <Recommendations />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('approval-actions-302')).toBeInTheDocument();
      });

      expect(screen.getByText(/Approved standard weekly transfer route/)).toBeInTheDocument();
      expect(screen.getByText(/Rural PHC undergoing storage renovation/)).toBeInTheDocument();
    });

    it('filters recommendations by status dropdown', async () => {
      render(
        <MemoryRouter>
          <Recommendations />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(recommendationsAPI.list).toHaveBeenCalled();
      });

      const statusFilter = screen.getByTestId('recommendations-status-filter');
      fireEvent.change(statusFilter, { target: { value: 'PENDING' } });

      await waitFor(() => {
        expect(recommendationsAPI.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING' }));
      });
    });

    it('filters recommendations by search keyword', async () => {
      render(
        <MemoryRouter>
          <Recommendations />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Redistribute Covaxin 0.5ml/)).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('recommendations-search-input');
      fireEvent.change(searchInput, { target: { value: 'Oxygen Cylinder' } });

      await waitFor(() => {
        expect(screen.getByText(/Redistribute O2 Cylinders/)).toBeInTheDocument();
        expect(screen.queryByText(/Redistribute Covaxin 0.5ml/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Approval Workflow & Confirmation Dialog', () => {
    it('opens confirmation modal and executes approval upon confirmation', async () => {
      const approvedRec = {
        ...mockRecommendations[0],
        status: 'APPROVED' as const,
        approval_actions: [
          {
            id: 3,
            recommendation_id: 301,
            transfer_id: 101,
            user_id: 1,
            action: 'APPROVED',
            notes: 'Verified cold chain truck.',
            created_at: '2026-09-05T12:00:00Z',
          },
        ],
      };
      (recommendationsAPI.approve as any).mockResolvedValue({ data: approvedRec });

      render(
        <MemoryRouter>
          <Recommendations />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('approve-btn-301')).toBeInTheDocument();
      });

      // Click Approve -> Opens confirmation dialog
      fireEvent.click(screen.getByTestId('approve-btn-301'));

      expect(screen.getByText('Confirm Stock Transfer Approval')).toBeInTheDocument();
      expect(screen.getByText(/District Depot Pune → AIIMS Central Hospital/)).toBeInTheDocument();

      // Input optional override quantity and notes
      const overrideQtyInput = screen.getByTestId('approval-override-qty');
      const notesInput = screen.getByTestId('approval-notes-input');

      fireEvent.change(overrideQtyInput, { target: { value: '35' } });
      fireEvent.change(notesInput, { target: { value: 'Verified cold chain truck.' } });

      // Click Confirm & Execute Transfer
      fireEvent.click(screen.getByTestId('confirm-approval-submit'));

      await waitFor(() => {
        expect(recommendationsAPI.approve).toHaveBeenCalledWith(301, {
          override_quantity: 35,
          notes: 'Verified cold chain truck.',
        });
        expect(screen.getByTestId('action-feedback-banner')).toHaveTextContent(/approved successfully/i);
      });
    });
  });

  describe('Rejection Workflow', () => {
    it('opens rejection dialog and updates recommendation to REJECTED with notes', async () => {
      const rejectedRec = {
        ...mockRecommendations[0],
        status: 'REJECTED' as const,
        approval_actions: [
          {
            id: 4,
            recommendation_id: 301,
            transfer_id: null,
            user_id: 1,
            action: 'REJECTED',
            notes: 'Alternative local supplier available.',
            created_at: '2026-09-05T12:30:00Z',
          },
        ],
      };
      (recommendationsAPI.reject as any).mockResolvedValue({ data: rejectedRec });

      render(
        <MemoryRouter>
          <Recommendations />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('reject-btn-301')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('reject-btn-301'));

      expect(screen.getByText('Reject Recommendation #301')).toBeInTheDocument();

      const rejectionNotesInput = screen.getByTestId('rejection-notes-input');
      fireEvent.change(rejectionNotesInput, { target: { value: 'Alternative local supplier available.' } });

      fireEvent.click(screen.getByTestId('confirm-rejection-submit'));

      await waitFor(() => {
        expect(recommendationsAPI.reject).toHaveBeenCalledWith(301, {
          notes: 'Alternative local supplier available.',
        });
        expect(screen.getByTestId('action-feedback-banner')).toHaveTextContent(/marked as REJECTED/i);
      });
    });
  });

  describe('Modification Workflow', () => {
    it('allows staff to modify suggested quantity and rationale before approval', async () => {
      const modifiedRec = {
        ...mockRecommendations[0],
        suggested_quantity: 50,
        reasoning: 'Adjusted to 50 units based on updated district census.',
      };
      (recommendationsAPI.modify as any).mockResolvedValue({ data: modifiedRec });

      render(
        <MemoryRouter>
          <Recommendations />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('modify-btn-301')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('modify-btn-301'));

      expect(screen.getByText('Modify Recommendation #301')).toBeInTheDocument();

      const qtyInput = screen.getByTestId('modify-qty-input');
      const reasonInput = screen.getByTestId('modify-reasoning-input');
      const notesInput = screen.getByTestId('modify-notes-input');

      fireEvent.change(qtyInput, { target: { value: '50' } });
      fireEvent.change(reasonInput, { target: { value: 'Adjusted to 50 units based on updated district census.' } });
      fireEvent.change(notesInput, { target: { value: 'Census re-evaluation' } });

      fireEvent.click(screen.getByTestId('confirm-modify-submit'));

      await waitFor(() => {
        expect(recommendationsAPI.modify).toHaveBeenCalledWith(301, {
          suggested_quantity: 50,
          reasoning: 'Adjusted to 50 units based on updated district census.',
          notes: 'Census re-evaluation',
        });
        expect(screen.getByTestId('action-feedback-banner')).toHaveTextContent(/modified successfully/i);
      });
    });
  });

  describe('On-Demand Recommendation Generation', () => {
    it('allows authorized staff to trigger network scan for rebalancing recommendations', async () => {
      (recommendationsAPI.generate as any).mockResolvedValue({ data: mockRecommendations });

      render(
        <MemoryRouter>
          <Recommendations />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('generate-recommendations-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('generate-recommendations-btn'));

      await waitFor(() => {
        expect(recommendationsAPI.generate).toHaveBeenCalledWith({
          facility_id: 1,
        });
        expect(screen.getByTestId('action-feedback-banner')).toHaveTextContent(/generated 3 redistribution recommendation/i);
      });
    });
  });

  describe('API Errors & Role Restrictions', () => {
    it('displays error banner and provides retry capability when listing fails', async () => {
      (recommendationsAPI.list as any).mockRejectedValueOnce(new Error('Database network timeout'));

      render(
        <MemoryRouter>
          <Recommendations />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Unable to fetch recommendations/)).toBeInTheDocument();
        expect(screen.getByText('Database network timeout')).toBeInTheDocument();
      });

      (recommendationsAPI.list as any).mockResolvedValueOnce({ data: mockRecommendations });
      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.getByText(/Redistribute Covaxin 0.5ml/)).toBeInTheDocument();
      });
    });

    it('hides generation and action buttons for citizen user role', async () => {
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

      render(
        <MemoryRouter>
          <Recommendations />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Redistribute Covaxin 0.5ml/)).toBeInTheDocument();
      });

      expect(screen.queryByTestId('generate-recommendations-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('approve-btn-301')).not.toBeInTheDocument();
      expect(screen.queryByTestId('modify-btn-301')).not.toBeInTheDocument();
      expect(screen.queryByTestId('reject-btn-301')).not.toBeInTheDocument();
    });
  });
});
