// TypeScript type definitions for MediGuard AI
// Aligned with backend app/schemas/__init__.py and app/models/__init__.py

// === Enums (matching backend exactly) ===

export type UserRole =
  | 'super_admin'
  | 'state_admin'
  | 'district_admin'
  | 'hospital_admin'
  | 'facility_staff'
  | 'citizen'
  | 'SUPER_ADMIN'
  | 'STATE_ADMIN'
  | 'DISTRICT_ADMIN'
  | 'HOSPITAL_ADMIN'
  | 'FACILITY_STAFF'
  | 'CITIZEN';

export type FacilityType =
  | 'DISTRICT_HOSPITAL'
  | 'CIVIL_HOSPITAL'
  | 'CHC'
  | 'PHC'
  | 'OTHER'
  | 'hospital'
  | 'clinic'
  | 'warehouse'
  | 'distribution_center';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
export type StockLevel = 'critical' | 'low' | 'adequate' | 'overstocked';
export type RiskCategory = 'STOCK_OUT' | 'EXPIRY' | 'EQUIPMENT' | 'RESOURCE';
export type RecommendationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
export type TransferStatus = 'PENDING' | 'APPROVED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
export type EquipmentStatus = 'OPERATIONAL' | 'UNDER_MAINTENANCE' | 'NON_FUNCTIONAL' | 'RETIRED';
export type StockMovementType = 'RECEIVED' | 'ISSUED' | 'TRANSFERRED_IN' | 'TRANSFERRED_OUT' | 'ADJUSTMENT' | 'DAMAGED' | 'EXPIRED';

// === Auth ===

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// === User ===

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  facility_id: number | null;
  state_id: number | null;
  district_id: number | null;
  is_active: boolean;
  created_at: string;
}

// === Facility ===

export interface FacilityService {
  id: number;
  facility_id: number;
  service_name: string;
  is_available: boolean;
  created_at: string;
}

export interface Facility {
  id: number;
  name: string;
  location: string;
  type: FacilityType;
  district_id: number | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  latitude: number | null;
  longitude: number | null;
  operational_status: string;
  facility_services: FacilityService[];
  created_at: string;
  updated_at: string | null;
}

// === Item ===

export interface Item {
  id: number;
  name: string;
  code: string;
  category: string;
  unit: string;
  description: string | null;
  created_at: string;
  updated_at: string | null;
}

// === Inventory ===

export interface InventoryItem {
  id: number;
  facility_id: number;
  item_id: number | null;
  item_name: string | null;
  category: string | null;
  unit: string;
  current_stock: number;
  quantity: number;
  min_threshold: number;
  min_stock_level: number;
  max_threshold: number;
  max_stock_level: number;
  batch_number: string | null;
  expiry_date: string | null;
  is_low_stock: boolean;
  stock_level: StockLevel;
  created_at: string | null;
  updated_at: string | null;
  last_updated: string | null;
}

// === Alert ===

export interface Alert {
  id: number;
  facility_id: number;
  item_id: number | null;
  prediction_id: number | null;
  risk_id: number | null;
  severity: AlertSeverity;
  title: string;
  description: string;
  risk_category: RiskCategory;
  status: AlertStatus;
  details: Record<string, unknown> | null;
  acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledged_by: number | null;
  resolved_at: string | null;
  resolved_by: number | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string | null;
}

// === Prediction ===

export interface Prediction {
  id: number;
  facility_id: number;
  item_id: number;
  predicted_demand: number;
  confidence: number;
  predicted_date: string;
  created_at: string;
}

// === Stock Movement ===

export interface StockMovement {
  id: number;
  facility_id: number;
  item_id: number;
  movement_type: StockMovementType;
  quantity: number;
  reference: string | null;
  created_by_user_id: number | null;
  created_at: string;
  facility_name: string | null;
  item_name: string | null;
  user_name: string | null;
}

// === Recommendation ===

export interface ApprovalAction {
  id: number;
  recommendation_id: number | null;
  transfer_id: number | null;
  user_id: number;
  action: string;
  notes: string | null;
  created_at: string;
}

export interface Recommendation {
  id: number;
  title: string;
  action_type: string;
  facility_id: number | null;
  source_facility_id: number | null;
  destination_facility_id: number | null;
  item_id: number | null;
  prediction_id: number | null;
  risk_id: number | null;
  suggested_quantity: number | null;
  reasoning: string;
  details: Record<string, unknown> | null;
  status: RecommendationStatus;
  created_at: string;
  updated_at: string | null;
  facility_name: string | null;
  source_facility_name: string | null;
  destination_facility_name: string | null;
  item_name: string | null;
  approval_actions: ApprovalAction[] | null;
}

// === Equipment ===

export interface Equipment {
  id: number;
  facility_id: number;
  name: string;
  equipment_type: string | null;
  serial_number: string | null;
  status: EquipmentStatus;
  installation_date: string | null;
  purchase_date: string | null;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  downtime_hours: number;
  facility_name: string | null;
  is_overdue_maintenance: boolean;
  downtime_days: number;
  created_at: string;
  updated_at: string | null;
}

export interface MaintenanceRecord {
  id: number;
  equipment_id: number;
  equipment_name?: string | null;
  facility_id?: number | null;
  description: string;
  performed_by?: string | null;
  cost: number;
  maintenance_date: string;
  next_due_date?: string | null;
  maintenance_type?: string | null;
  downtime_hours: number;
  created_at: string;
}

export interface EquipmentDowntimeAnalysis {
  equipment_id: number;
  equipment_name: string;
  status: EquipmentStatus;
  total_downtime_hours: number;
  total_downtime_days: number;
  uptime_percentage: number;
  last_maintenance_date?: string | null;
  next_maintenance_date?: string | null;
  is_overdue: boolean;
  maintenance_count: number;
}

// === Audit Log ===

export interface AuditLog {
  id: number;
  user_id: number | null;
  user_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: string | null;
  correlation_id: string | null;
  created_at: string;
}

// === Dashboard ===

export interface DashboardKPIs {
  total_facilities: number;
  total_items: number;
  critical_alerts: number;
  low_stock_items: number;
  predicted_demand_count: number;
}

export interface RecentAlert {
  id: number;
  severity: AlertSeverity;
  title: string;
  facility_name: string;
  created_at: string;
}

export interface DashboardSummary {
  kpis: DashboardKPIs;
  recent_alerts: RecentAlert[];
  stock_summary: {
    critical: number;
    low: number;
    adequate: number;
    overstocked: number;
  };
}

export interface TrendDataPoint {
  date: string;
  value: number;
}

export interface DashboardTrends {
  consumption_trend: TrendDataPoint[];
  alert_trend: TrendDataPoint[];
}

export interface DashboardStockRisk {
  inventory_id: number;
  item_name: string;
  facility_name: string;
  current_stock: number;
  min_threshold: number;
  status: string;
}

export interface DashboardExpiryRisk {
  inventory_id: number;
  item_name: string;
  facility_name: string;
  quantity: number;
  expiry_date: string;
  days_to_expiry: number;
}

// === AI ===

export interface AIChatRequest {
  query: string;
  facility_id?: number;
  language?: string;
}

export interface AIChatResponse {
  response: string;
  intent_classified: string;
  sources_used: string[];
  disclaimer: string;
}

export interface AIExplainResponse {
  explanation: string;
  disclaimer: string;
}

export interface AISummaryResponse {
  summary: string;
  key_insights: string[];
  disclaimer: string;
}

// === Paginated Response ===

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// === Consumption Records ===

export interface ConsumptionRecord {
  id: number;
  facility_id: number;
  item_id: number;
  quantity_consumed: number;
  record_date: string;
  created_at: string;
  facility_name?: string | null;
  item_name?: string | null;
}

export interface ConsumptionSummaryItem {
  period_start: string;
  period_end: string;
  facility_id?: number | null;
  item_id?: number | null;
  total_quantity: number;
  record_count: number;
  average_daily: number;
}

export interface ConsumptionSummaryResponse {
  period: string; // "daily" or "weekly"
  facility_id?: number | null;
  item_id?: number | null;
  total_consumed: number;
  summary: ConsumptionSummaryItem[];
}

// === Form Inputs ===

export interface FacilityCreateInput {
  name: string;
  location: string;
  type: FacilityType;
  district_id?: number | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  is_active?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  operational_status?: string;
}

export interface FacilityUpdateInput {
  name?: string;
  location?: string;
  type?: FacilityType;
  district_id?: number | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  is_active?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  operational_status?: string;
}

export interface InventoryCreateInput {
  facility_id: number;
  item_id?: number | null;
  item_name?: string | null;
  category?: string | null;
  unit?: string | null;
  current_stock: number;
  quantity?: number;
  min_threshold: number;
  min_stock_level?: number;
  max_threshold: number;
  max_stock_level?: number;
  batch_number?: string | null;
  expiry_date?: string | null;
}

export interface InventoryUpdateInput {
  current_stock?: number;
  quantity?: number;
  min_threshold?: number;
  min_stock_level?: number;
  max_threshold?: number;
  max_stock_level?: number;
  batch_number?: string | null;
  expiry_date?: string | null;
  unit?: string | null;
  item_name?: string | null;
  category?: string | null;
}

export interface StockMovementCreateInput {
  facility_id: number;
  item_id: number;
  movement_type: StockMovementType;
  quantity: number;
  reference?: string | null;
  inventory_id?: number | null;
}

export interface ConsumptionCreateInput {
  facility_id: number;
  item_id: number;
  quantity_consumed: number;
  record_date?: string | null;
}

export interface EquipmentCreateInput {
  facility_id: number;
  name: string;
  equipment_type?: string | null;
  serial_number?: string | null;
  status?: EquipmentStatus;
  installation_date?: string | null;
  purchase_date?: string | null;
  last_maintenance_date?: string | null;
  next_maintenance_date?: string | null;
  downtime_hours?: number;
}

export interface EquipmentUpdateInput {
  name?: string;
  equipment_type?: string | null;
  serial_number?: string | null;
  status?: EquipmentStatus;
  installation_date?: string | null;
  purchase_date?: string | null;
  last_maintenance_date?: string | null;
  next_maintenance_date?: string | null;
  downtime_hours?: number;
}

export interface MaintenanceRecordCreateInput {
  equipment_id: number;
  description: string;
  performed_by?: string | null;
  cost?: number;
  maintenance_date: string;
  next_due_date?: string | null;
  maintenance_type?: string;
  downtime_hours?: number;
  update_equipment_status?: EquipmentStatus;
}