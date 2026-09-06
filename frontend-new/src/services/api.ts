import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  User, Facility, FacilityService, InventoryItem, Alert, Prediction,
  DashboardSummary, DashboardTrends, DashboardStockRisk, DashboardExpiryRisk,
  AIChatRequest, AIChatResponse, AIExplainResponse, AISummaryResponse,
  Recommendation, Equipment, StockMovement, AuditLog, Item,
  PaginatedResponse, ConsumptionRecord, ConsumptionSummaryResponse,
  FacilityCreateInput, FacilityUpdateInput, InventoryCreateInput, InventoryUpdateInput,
  StockMovementCreateInput, ConsumptionCreateInput,
  MaintenanceRecord, EquipmentDowntimeAnalysis, EquipmentCreateInput, EquipmentUpdateInput,
  MaintenanceRecordCreateInput,
} from '../types';

const API_BASE_URL = '/api/v1';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach JWT + X-Request-ID
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['X-Request-ID'] = crypto.randomUUID?.() ?? Date.now().toString();
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 with refresh (Now managed by Firebase mostly, but we can clear local storage)
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      // If we're not on the login or register page, redirect
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ───────────────────────────────────────────────

export const authAPI = {
  getMe: () => api.get<User>('/auth/me'),
  register: (data: any) => api.post<User>('/auth/register', data),
};

// ─── Dashboard ──────────────────────────────────────────

export const dashboardAPI = {
  getSummary: () => api.get<DashboardSummary>('/dashboard/'),
  getTrends: (params?: { start_date?: string; end_date?: string }) =>
    api.get<DashboardTrends>('/dashboard/trends', { params }),
  getStockRisks: () => api.get<DashboardStockRisk[]>('/dashboard/stock-risks'),
  getExpiryRisks: () => api.get<DashboardExpiryRisk[]>('/dashboard/expiry-risks'),
};

// ─── Facilities ─────────────────────────────────────────

export const facilitiesAPI = {
  list: (params?: {
    skip?: number;
    limit?: number;
    search?: string;
    type?: string;
    facility_type?: string;
    operational_status?: string;
    state_id?: number;
    district_id?: number;
  }) => api.get<Facility[]>('/facilities/', { params }),
  get: (id: number) => api.get<Facility>(`/facilities/${id}`),
  create: (data: FacilityCreateInput | Partial<Facility>) => api.post<Facility>('/facilities/', data),
  update: (id: number, data: FacilityUpdateInput | Partial<Facility>) => api.put<Facility>(`/facilities/${id}`, data),
  delete: (id: number) => api.delete(`/facilities/${id}`),
  getServices: (id: number) => api.get<FacilityService[]>(`/facilities/${id}/services`),
  addService: (id: number, data: { service_name: string; is_available?: boolean }) =>
    api.post<FacilityService>(`/facilities/${id}/services`, data),
};

// ─── Items ──────────────────────────────────────────────

export const itemsAPI = {
  list: (params?: { search?: string; category?: string; skip?: number; limit?: number }) =>
    api.get<Item[]>('/items/', { params }),
  get: (id: number) => api.get<Item>(`/items/${id}`),
  create: (data: Partial<Item>) => api.post<Item>('/items/', data),
  update: (id: number, data: Partial<Item>) => api.put<Item>(`/items/${id}`, data),
};

// ─── Inventory ──────────────────────────────────────────

export const inventoryAPI = {
  list: (params?: {
    facility_id?: number;
    item_id?: number;
    category?: string;
    is_low_stock?: boolean;
    low_stock?: boolean;
    batch_number?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }) => api.get<InventoryItem[]>('/inventory/', { params }),
  get: (id: number) => api.get<InventoryItem>(`/inventory/${id}`),
  getMovements: (id: number, params?: { skip?: number; limit?: number }) =>
    api.get<StockMovement[]>(`/inventory/${id}/movements`, { params }),
  getLowStock: (params?: { skip?: number; limit?: number }) =>
    api.get<InventoryItem[]>('/inventory/low-stock', { params }),
  create: (data: InventoryCreateInput | Partial<InventoryItem>) => api.post<InventoryItem>('/inventory/', data),
  update: (id: number, data: InventoryUpdateInput | Partial<InventoryItem>) => api.put<InventoryItem>(`/inventory/${id}`, data),
  delete: (id: number) => api.delete(`/inventory/${id}`),
};

// ─── Stock Movements ────────────────────────────────────

export const stockMovementsAPI = {
  list: (params?: {
    facility_id?: number;
    item_id?: number;
    movement_type?: string;
    start_date?: string;
    end_date?: string;
    skip?: number;
    limit?: number;
  }) => api.get<StockMovement[]>('/stock-movements/', { params }),
  create: (data: StockMovementCreateInput | {
    facility_id: number;
    item_id: number;
    movement_type: string;
    quantity: number;
    reference?: string;
    inventory_id?: number;
  }) => api.post<StockMovement>('/stock-movements/', data),
};

// ─── Consumption ────────────────────────────────────────

export const consumptionAPI = {
  list: (params?: {
    facility_id?: number;
    item_id?: number;
    start_date?: string;
    end_date?: string;
    skip?: number;
    limit?: number;
  }) => api.get<ConsumptionRecord[]>('/consumption/', { params }),
  get: (id: number) => api.get<ConsumptionRecord>(`/consumption/${id}`),
  getSummary: (params?: {
    facility_id?: number;
    item_id?: number;
    start_date?: string;
    end_date?: string;
    period?: string;
  }) => api.get<ConsumptionSummaryResponse>('/consumption/summary', { params }),
  create: (data: ConsumptionCreateInput | {
    facility_id: number;
    item_id: number;
    quantity_consumed: number;
    record_date?: string;
  }) => api.post<ConsumptionRecord>('/consumption/', data),
};

// ─── Alerts ─────────────────────────────────────────────

export const alertsAPI = {
  list: (params?: {
    facility_id?: number;
    item_id?: number;
    severity?: string;
    status?: string;
    acknowledged?: boolean;
    risk_category?: string;
    skip?: number;
    limit?: number;
  }) => api.get<Alert[]>('/alerts', { params }),
  get: (id: number) => api.get<Alert>(`/alerts/${id}`),
  create: (data: Partial<Alert>) => api.post<Alert>('/alerts', data),
  acknowledge: (id: number, notes?: string) =>
    api.post<Alert>(`/alerts/${id}/acknowledge`, { notes }),
  update: (id: number, data: Partial<Alert>) => api.patch<Alert>(`/alerts/${id}`, data),
  delete: (id: number) => api.delete(`/alerts/${id}`),
};

// ─── Predictions ────────────────────────────────────────

export const predictionsAPI = {
  getDemand: (params?: { facility_id?: number; item_id?: number; skip?: number; limit?: number }) =>
    api.get<Prediction[]>('/predictions/demand', { params }),
  getRisk: (params?: { facility_id?: number }) =>
    api.get<any[]>('/predictions/risk', { params }),
  generate: (data: { facility_id: number; item_id: number }) =>
    api.post<Prediction>('/predictions/generate', data),
  forecast: (data: { facility_id: number; item_id: number; historical_days?: number }) =>
    api.post('/predictions/forecast', data),
  stockoutRisk: (data: { facility_id: number; item_id: number; current_stock: number; min_stock: number; lead_time_days?: number }) =>
    api.post('/predictions/stockout-risk', data),
  expiryRisk: (data: { facility_id: number; item_id: number; batches: { batch_number: string; quantity: number; expiry_date: string }[] }) =>
    api.post('/predictions/expiry-risk', data),
};

// ─── Recommendations ────────────────────────────────────

export const recommendationsAPI = {
  list: (params?: { status?: string; facility_id?: number; skip?: number; limit?: number }) =>
    api.get<Recommendation[]>('/recommendations/', { params }),
  get: (id: number) => api.get<Recommendation>(`/recommendations/${id}`),
  generate: (data: { facility_id?: number; item_id?: number }) =>
    api.post('/recommendations/generate', data),
  approve: (id: number, data?: { override_quantity?: number; notes?: string }) =>
    api.post(`/recommendations/${id}/approve`, data || {}),
  reject: (id: number, data?: { notes?: string }) =>
    api.post(`/recommendations/${id}/reject`, data || {}),
  modify: (id: number, data: { suggested_quantity?: number; reasoning?: string; notes?: string }) =>
    api.post(`/recommendations/${id}/modify`, data),
};

// ─── Equipment ──────────────────────────────────────────

export const equipmentAPI = {
  list: (params?: { facility_id?: number; status?: string; equipment_type?: string; is_overdue?: boolean; search?: string; skip?: number; limit?: number }) =>
    api.get<Equipment[]>('/equipment/', { params }),
  get: (id: number) => api.get<Equipment>(`/equipment/${id}`),
  create: (data: EquipmentCreateInput) =>
    api.post<Equipment>('/equipment/', data),
  update: (id: number, data: EquipmentUpdateInput) =>
    api.put<Equipment>(`/equipment/${id}`, data),
  delete: (id: number) => api.delete(`/equipment/${id}`),
  getOverdue: (params?: { facility_id?: number }) =>
    api.get<Equipment[]>('/equipment/overdue', { params }),
  getDowntime: (id: number) =>
    api.get<EquipmentDowntimeAnalysis>(`/equipment/${id}/downtime`),
  getMaintenanceHistory: (id: number, params?: { skip?: number; limit?: number }) =>
    api.get<MaintenanceRecord[]>(`/equipment/${id}/maintenance`, { params }),
};

// ─── Maintenance ────────────────────────────────────────

export const maintenanceAPI = {
  list: (params?: { equipment_id?: number; facility_id?: number; maintenance_type?: string; skip?: number; limit?: number }) =>
    api.get<MaintenanceRecord[]>('/maintenance/', { params }),
  get: (id: number) => api.get<MaintenanceRecord>(`/maintenance/${id}`),
  create: (data: MaintenanceRecordCreateInput) =>
    api.post<MaintenanceRecord>('/maintenance/', data),
};

// ─── Audit Logs ─────────────────────────────────────────

export const auditLogsAPI = {
  list: (params?: {
    user_id?: number; action?: string; entity_type?: string;
    search?: string; skip?: number; limit?: number;
  }) => api.get<PaginatedResponse<AuditLog>>('/audit-logs', { params }),
  get: (id: number) => api.get<AuditLog>(`/audit-logs/${id}`),
};

// ─── AI ─────────────────────────────────────────────────

export const aiAPI = {
  chat: (data: AIChatRequest) => api.post<AIChatResponse>('/ai/chat', data),
  explainAlert: (alert_id: number, language?: string) =>
    api.post<AIExplainResponse>('/ai/explain-alert', { alert_id, language }),
  explainPrediction: (prediction_id: number, language?: string) =>
    api.post<AIExplainResponse>('/ai/explain-prediction', { prediction_id, language }),
  explainRecommendation: (recommendation_id: number, language?: string) =>
    api.post<AIExplainResponse>('/ai/explain-recommendation', { recommendation_id, language }),
  facilitySummary: (facility_id: number, language?: string) =>
    api.post<AISummaryResponse>('/ai/facility-summary', { facility_id, language }),
  districtSummary: (district_id: number, language?: string) =>
    api.post<AISummaryResponse>('/ai/district-summary', { district_id, language }),
};

export default api;