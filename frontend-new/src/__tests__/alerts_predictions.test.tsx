import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Alerts from '../pages/Alerts';
import AlertDetail from '../pages/AlertDetail';
import Predictions from '../pages/Predictions';
import { alertsAPI, predictionsAPI, aiAPI } from '../services/api';
import type { User, Alert, Prediction, AIExplainResponse } from '../types';

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
  alertsAPI: {
    list: vi.fn(),
    get: vi.fn(),
    acknowledge: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  predictionsAPI: {
    getDemand: vi.fn(),
    getRisk: vi.fn(),
    forecast: vi.fn(),
    generate: vi.fn(),
  },
  aiAPI: {
    explainAlert: vi.fn(),
    explainPrediction: vi.fn(),
  },
}));

// Test sample data
const mockAlerts: Alert[] = [
  {
    id: 101,
    facility_id: 1,
    item_id: 5,
    prediction_id: null,
    risk_id: null,
    severity: 'critical',
    title: 'Severe Stockout Risk: Covaxin 0.5ml',
    description: 'Projected consumption will deplete existing safety reserves within 48 hours.',
    status: 'ACTIVE',
    risk_category: 'STOCK_OUT',
    acknowledged: false,
    acknowledged_at: null,
    acknowledged_by: null,
    resolved_at: null,
    resolved_by: null,
    resolution_notes: null,
    details: {
      facility_name: 'AIIMS Central Hospital',
      item_name: 'Covaxin 0.5ml',
      batch_number: 'CVX-2026-99',
      current_stock: 12,
      min_threshold: 50,
      days_to_stockout: 2,
    },
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 102,
    facility_id: 2,
    item_id: 8,
    prediction_id: null,
    risk_id: null,
    severity: 'high',
    title: 'Vaccine Expiry Approaching: Paracetamol IV',
    description: '150 units will expire in 10 days before average consumption cycle.',
    status: 'ACKNOWLEDGED',
    risk_category: 'EXPIRY',
    acknowledged: true,
    acknowledged_at: '2026-09-02T11:00:00Z',
    acknowledged_by: 1,
    resolved_at: null,
    resolved_by: null,
    resolution_notes: null,
    details: {
      facility_name: 'District General Hospital Pune',
      item_name: 'Paracetamol IV 100ml',
      batch_number: 'PARA-884',
      current_stock: 150,
      days_to_expiry: 10,
    },
    created_at: '2026-09-02T08:00:00Z',
    updated_at: '2026-09-02T11:00:00Z',
  },
  {
    id: 103,
    facility_id: 1,
    item_id: 12,
    prediction_id: null,
    risk_id: null,
    severity: 'medium',
    title: 'Cold Storage Temperature Deviation',
    description: 'Refrigeration unit #2 reported +6.8°C excursion for 45 minutes.',
    status: 'RESOLVED',
    risk_category: 'EQUIPMENT',
    acknowledged: true,
    acknowledged_at: '2026-09-03T12:30:00Z',
    acknowledged_by: 1,
    resolved_at: '2026-09-03T15:00:00Z',
    resolved_by: 1,
    resolution_notes: 'Sensor recalibrated and secondary cooling unit activated.',
    details: {
      facility_name: 'AIIMS Central Hospital',
      item_name: 'Polio Oral Vaccine',
    },
    created_at: '2026-09-03T12:00:00Z',
    updated_at: '2026-09-03T15:00:00Z',
  },
];

const mockPredictions: Prediction[] = [
  {
    id: 201,
    facility_id: 1,
    item_id: 5,
    predicted_demand: 450,
    confidence: 0.92,
    predicted_date: '2026-09-15T00:00:00Z',
    created_at: '2026-09-05T00:00:00Z',
  },
  {
    id: 202,
    facility_id: 2,
    item_id: 8,
    predicted_demand: 120,
    confidence: 0.76,
    predicted_date: '2026-09-20T00:00:00Z',
    created_at: '2026-09-05T00:00:00Z',
  },
];

const mockExplainAlertResponse: AIExplainResponse = {
  explanation: 'High patient footfall coupled with delayed batch replenishment has caused inventory to plunge below safety margin. Recommending emergency transfer of 50 units from District Warehouse #3.',
  disclaimer: 'Probabilistic recommendation for operational planning. Actual requirements may fluctuate.',
};

const mockExplainPredictionResponse: AIExplainResponse = {
  explanation: 'Forecast indicates a 28% increase in demand driven by seasonal respiratory illness patterns and regional health camp schedules.',
  disclaimer: 'Statistical estimate subject to variance in community transmission rates.',
};

describe('PHASE 22 — Alerts & Predictions Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = {
      id: 1,
      email: 'admin@mediguard.org',
      full_name: 'Dr. Admin Officer',
      role: 'hospital_admin',
      facility_id: 1,
      state_id: 1,
      district_id: 1,
      is_active: true,
      created_at: '2026-01-01',
    };

    (alertsAPI.list as any).mockResolvedValue({ data: mockAlerts });
    (alertsAPI.get as any).mockImplementation((id: number) => {
      const found = mockAlerts.find(a => a.id === id);
      if (found) return Promise.resolve({ data: found });
      return Promise.reject({ response: { data: { detail: 'Alert not found' }, status: 404 } });
    });
    (predictionsAPI.getDemand as any).mockResolvedValue({ data: mockPredictions });
    (aiAPI.explainAlert as any).mockResolvedValue({ data: mockExplainAlertResponse });
    (aiAPI.explainPrediction as any).mockResolvedValue({ data: mockExplainPredictionResponse });
  });

  describe('Alerts List View (/alerts)', () => {
    it('renders alerts list with severity badges, risk categories, and item context', async () => {
      render(
        <MemoryRouter>
          <Alerts />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Severe Stockout Risk: Covaxin 0.5ml')).toBeInTheDocument();
        expect(screen.getByText('Vaccine Expiry Approaching: Paracetamol IV')).toBeInTheDocument();
        expect(screen.getByText('Cold Storage Temperature Deviation')).toBeInTheDocument();
        expect(screen.getByText('Predicted Shortage Risk')).toBeInTheDocument();
        expect(screen.getAllByText('Expiry Risk').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Equipment Risk')).toBeInTheDocument();
        expect(screen.getByText('Shortage in ~2d')).toBeInTheDocument();
      });
    });

    it('filters alerts by search keyword', async () => {
      render(
        <MemoryRouter>
          <Alerts />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Severe Stockout Risk: Covaxin 0.5ml')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('alerts-search-input');
      fireEvent.change(searchInput, { target: { value: 'Paracetamol' } });

      await waitFor(() => {
        expect(screen.getByText('Vaccine Expiry Approaching: Paracetamol IV')).toBeInTheDocument();
        expect(screen.queryByText('Severe Stockout Risk: Covaxin 0.5ml')).not.toBeInTheDocument();
      });
    });

    it('filters alerts by severity dropdown', async () => {
      render(
        <MemoryRouter>
          <Alerts />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(alertsAPI.list).toHaveBeenCalled();
      });

      const severityFilter = screen.getByTestId('alerts-severity-filter');
      fireEvent.change(severityFilter, { target: { value: 'critical' } });

      await waitFor(() => {
        expect(alertsAPI.list).toHaveBeenCalledWith(expect.objectContaining({ severity: 'critical' }));
      });
    });

    it('filters alerts by risk category dropdown', async () => {
      render(
        <MemoryRouter>
          <Alerts />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(alertsAPI.list).toHaveBeenCalled();
      });

      const categoryFilter = screen.getByTestId('alerts-category-filter');
      fireEvent.change(categoryFilter, { target: { value: 'STOCK_OUT' } });

      await waitFor(() => {
        expect(alertsAPI.list).toHaveBeenCalledWith(expect.objectContaining({ risk_category: 'STOCK_OUT' }));
      });
    });

    it('allows 1-click Acknowledge for active unacknowledged alerts', async () => {
      const updatedAlert = { ...mockAlerts[0], acknowledged: true, status: 'ACKNOWLEDGED' as const };
      (alertsAPI.acknowledge as any).mockResolvedValue({ data: updatedAlert });

      render(
        <MemoryRouter>
          <Alerts />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('ack-btn-101')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('ack-btn-101'));

      await waitFor(() => {
        expect(alertsAPI.acknowledge).toHaveBeenCalledWith(101);
      });
    });

    it('opens Quick Explain with Gemini modal and displays operational AI analysis', async () => {
      render(
        <MemoryRouter>
          <Alerts />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('explain-btn-101')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('explain-btn-101'));

      await waitFor(() => {
        expect(aiAPI.explainAlert).toHaveBeenCalledWith(101);
        expect(screen.getByTestId('quick-gemini-output')).toBeInTheDocument();
        expect(screen.getByText(/High patient footfall coupled with delayed batch replenishment/)).toBeInTheDocument();
      });
    });

    it('displays error banner with retry option when API fails', async () => {
      (alertsAPI.list as any).mockRejectedValueOnce(new Error('Network error loading alerts'));

      render(
        <MemoryRouter>
          <Alerts />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Unable to fetch alerts/)).toBeInTheDocument();
        expect(screen.getByText('Network error loading alerts')).toBeInTheDocument();
      });

      (alertsAPI.list as any).mockResolvedValueOnce({ data: mockAlerts });
      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.getByText('Severe Stockout Risk: Covaxin 0.5ml')).toBeInTheDocument();
      });
    });
  });

  describe('Alert Details View (/alerts/:id)', () => {
    it('renders comprehensive operational details for a specific alert', async () => {
      render(
        <MemoryRouter initialEntries={['/alerts/101']}>
          <Routes>
            <Route path="/alerts/:id" element={<AlertDetail />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('alert-detail-title')).toHaveTextContent('Severe Stockout Risk: Covaxin 0.5ml');
      });

      expect(screen.getByText('Facility #1')).toBeInTheDocument();
      expect(screen.getByText('AIIMS Central Hospital')).toBeInTheDocument();
      expect(screen.getByText('Covaxin 0.5ml')).toBeInTheDocument();
      expect(screen.getByText('Batch: CVX-2026-99')).toBeInTheDocument();
      expect(screen.getByText('12 in stock')).toBeInTheDocument();
      expect(screen.getByText('Min threshold: 50')).toBeInTheDocument();
      expect(screen.getByText('Est. 2 days to shortage')).toBeInTheDocument();
    });

    it('invokes Gemini AI explanation on alert detail with language selector', async () => {
      render(
        <MemoryRouter initialEntries={['/alerts/101']}>
          <Routes>
            <Route path="/alerts/:id" element={<AlertDetail />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('gemini-explain-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('gemini-explain-btn'));

      await waitFor(() => {
        expect(aiAPI.explainAlert).toHaveBeenCalledWith(101, 'English');
        expect(screen.getByTestId('gemini-explanation-output')).toBeInTheDocument();
        expect(screen.getByText(/High patient footfall coupled with delayed batch replenishment/)).toBeInTheDocument();
        expect(screen.getByText(/Probabilistic recommendation for operational planning/)).toBeInTheDocument();
      });
    });

    it('allows marking an alert as resolved with resolution notes', async () => {
      const resolvedAlert = {
        ...mockAlerts[0],
        status: 'RESOLVED' as const,
        resolution_notes: 'Emergency transfer completed from District Depot #3.',
      };
      (alertsAPI.update as any).mockResolvedValue({ data: resolvedAlert });

      render(
        <MemoryRouter initialEntries={['/alerts/101']}>
          <Routes>
            <Route path="/alerts/:id" element={<AlertDetail />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('resolve-alert-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('resolve-alert-btn'));

      // Modal appears
      const notesTextarea = screen.getByPlaceholderText(/Emergency batch transfer completed/i);
      fireEvent.change(notesTextarea, {
        target: { value: 'Emergency transfer completed from District Depot #3.' },
      });

      fireEvent.click(screen.getByText('Save Status'));

      await waitFor(() => {
        expect(alertsAPI.update).toHaveBeenCalledWith(101, {
          status: 'RESOLVED',
          resolution_notes: 'Emergency transfer completed from District Depot #3.',
        });
        expect(screen.getByText('Emergency transfer completed from District Depot #3.')).toBeInTheDocument();
      });
    });

    it('renders 404 state when alert ID does not exist', async () => {
      render(
        <MemoryRouter initialEntries={['/alerts/9999']}>
          <Routes>
            <Route path="/alerts/:id" element={<AlertDetail />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Alert Not Found')).toBeInTheDocument();
        expect(screen.getByText('Return to Alerts')).toBeInTheDocument();
      });
    });
  });

  describe('Predictions Page (/predictions)', () => {
    it('renders demand predictions with confidence scores and probabilistic wording', async () => {
      render(
        <MemoryRouter>
          <Predictions />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Demand Forecasts & Shortage Risk Analytics')).toBeInTheDocument();
        expect(screen.getByText('450 units')).toBeInTheDocument();
      });

      // Probabilistic disclaimer verification
      expect(
        screen.getByText(/All analytical outputs provide probabilistic estimates of predicted shortage risk/i)
      ).toBeInTheDocument();
      expect(screen.queryByText(/Guaranteed shortage/i)).not.toBeInTheDocument();

      // Confidence badges
      expect(screen.getByText('92% Confidence')).toBeInTheDocument();
      expect(screen.getByText('76% Confidence')).toBeInTheDocument();
    });

    it('filters predictions by minimum confidence score', async () => {
      render(
        <MemoryRouter>
          <Predictions />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('450 units')).toBeInTheDocument();
      });

      const confFilter = screen.getByTestId('predictions-confidence-filter');
      fireEvent.change(confFilter, { target: { value: '80' } });

      await waitFor(() => {
        expect(screen.getByText('450 units')).toBeInTheDocument();
        expect(screen.queryByText('120 units')).not.toBeInTheDocument();
      });
    });

    it('switches to Shortage Risk Overview tab and displays threshold guidance', async () => {
      render(
        <MemoryRouter>
          <Predictions />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('tab-shortage-risks')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('tab-shortage-risks'));

      await waitFor(() => {
        expect(screen.getByTestId('shortage-risks-tab')).toBeInTheDocument();
        expect(screen.getByText('Critical Shortage Risk')).toBeInTheDocument();
        expect(screen.getByText('< 7 Days Buffer')).toBeInTheDocument();
        expect(screen.getByText('7 - 21 Days Buffer')).toBeInTheDocument();
      });
    });

    it('explains a prediction using Gemini AI', async () => {
      render(
        <MemoryRouter>
          <Predictions />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('explain-prediction-201')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('explain-prediction-201'));

      await waitFor(() => {
        expect(aiAPI.explainPrediction).toHaveBeenCalledWith(201);
        expect(screen.getByTestId('prediction-gemini-output')).toBeInTheDocument();
        expect(screen.getByText(/Forecast indicates a 28% increase in demand/)).toBeInTheDocument();
      });
    });

    it('allows staff to trigger an on-demand forecast calculation', async () => {
      (predictionsAPI.forecast as any).mockResolvedValue({ data: { message: 'Forecast generated' } });

      render(
        <MemoryRouter>
          <Predictions />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('run-forecast-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('run-forecast-button'));

      // Modal appears
      const facilityInput = screen.getByTestId('forecast-facility-input');
      const itemInput = screen.getByTestId('forecast-item-input');

      fireEvent.change(facilityInput, { target: { value: '1' } });
      fireEvent.change(itemInput, { target: { value: '5' } });

      fireEvent.click(screen.getByTestId('forecast-submit-button'));

      await waitFor(() => {
        expect(predictionsAPI.forecast).toHaveBeenCalledWith(expect.objectContaining({
          facility_id: 1,
          item_id: 5,
        }));
      });
    });

    it('hides forecast generation and alert management buttons from public citizen role', async () => {
      mockCurrentUser = {
        id: 99,
        email: 'citizen@example.com',
        full_name: 'Citizen Patient',
        role: 'citizen',
        facility_id: null,
        state_id: null,
        district_id: null,
        is_active: true,
        created_at: '2026-01-01',
      };

      const { unmount } = render(
        <MemoryRouter>
          <Predictions />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('run-forecast-button')).not.toBeInTheDocument();
      });

      unmount();

      render(
        <MemoryRouter>
          <Alerts />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('ack-btn-101')).not.toBeInTheDocument();
      });
    });
  });
});
