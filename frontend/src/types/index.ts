// NIRAMAYA AI — Core TypeScript Types

export type UserRole =
  | 'SUPER_ADMIN'
  | 'STATE_ADMIN'
  | 'DISTRICT_ADMIN'
  | 'FACILITY_ADMIN'
  | 'HOSPITAL_ADMIN'
  | 'STAFF'
  | 'FACILITY_STAFF'
  | 'CITIZEN';

export interface User {
  id: string;
  firebase_uid?: string;
  name: string;
  email: string;
  role: UserRole;
  state?: string;
  district?: string;
  state_id?: number | string;
  district_id?: number | string;
  facility_id?: number | string;
  facilityId?: string;
  status?: string;
  is_active?: boolean;
  approval_status?: string;
  avatar?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export type FacilityStatus = 'Critical Risk' | 'Moderate' | 'Stable' | 'Operational';
export type FacilityType =
  | 'Tier 1 District Hospital'
  | 'Community Health Center'
  | 'Specialty Care'
  | 'Primary Health Center'
  | 'Sub-District Hospital';

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  location: string;
  district: string;
  state: string;
  status: FacilityStatus;
  resourceHealth: number; // 0-100
  riskScore: number; // 0-10
  lastUpdated: string;
  bedCapacity: number;
  bedsOccupied: number;
  staffCount: number;
  contactPhone?: string;
  services?: string[];
  coordinates?: { lat: number; lng: number };
}

export type StockStatus = 'Healthy' | 'Moderate' | 'Elevated Risk' | 'Critical';

export interface InventoryItem {
  id: string;
  resourceName: string;
  category: string;
  facilityId: string;
  facilityName: string;
  currentStock: number;
  unit: string;
  estimatedRequirement: number;
  stockHealth: number; // 0-100
  expiryDate: string;
  daysRemaining: number;
  batchNumber: string;
  quantity: number;
  status: StockStatus;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export type AlertSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
export type AlertType =
  | 'Predicted Shortage'
  | 'Expiry Risk'
  | 'Equipment Issue'
  | 'Logistics Delay'
  | 'Resource Pressure';
export type AlertStatus = 'Active' | 'Under Review' | 'Resolved';

export interface Alert {
  id: string;
  title: string;
  facilityId: string;
  facilityName: string;
  severity: AlertSeverity;
  type: AlertType;
  status: AlertStatus;
  createdAt: string;
  description: string;
  aiExplanation?: string;
  district: string;
  state: string;
}

export interface PredictionSummary {
  criticalDistricts: number;
  elevatedFacilities: number;
  stableHubs: number;
  modelActive: boolean;
  lastSynthesized: string;
}

export interface DemandDataPoint {
  label: string;
  actual?: number;
  forecast?: number;
  isCurrent?: boolean;
  isForecast?: boolean;
}

export interface AISynthesis {
  text: string;
  confidence?: number;
  forecastHorizon?: string;
  estimatedTransit?: string;
  generatedAt: string;
}

export type RecommendationStatus = 'Pending Review' | 'Approved' | 'Rejected' | 'Modified';

export interface Recommendation {
  id: string;
  sourceFacilityId: string;
  sourceFacilityName: string;
  destinationFacilityId: string;
  destinationFacilityName: string;
  resourceName: string;
  recommendedQuantity: number;
  unit: string;
  reason: string;
  estimatedTransit: string;
  potentialRiskReduction: number; // percentage
  confidence?: number;
  status: RecommendationStatus;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

export type EquipmentStatus = 'Operational' | 'Maintenance Due' | 'Issue Detected' | 'Critical';

export interface Equipment {
  id: string;
  name: string;
  category: string;
  facilityId: string;
  facilityName: string;
  status: EquipmentStatus;
  issue?: string;
  maintenanceStatus: string;
  lastMaintenance: string;
  nextMaintenance: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  serialNumber: string;
  installDate: string;
  maintenanceHistory?: MaintenanceEvent[];
}

export interface MaintenanceEvent {
  date: string;
  type: string;
  technician: string;
  notes: string;
  status: 'Completed' | 'Scheduled' | 'Overdue';
}

export interface AuditEvent {
  id: string;
  event: string;
  actor: string;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed';
  type: 'prediction' | 'alert' | 'transfer' | 'review' | 'approval' | 'system';
  details?: string;
}

export interface DashboardMetrics {
  totalFacilities: number;
  facilitiesOnline: number;
  criticalAlerts: number;
  predictedShortages: number;
  expiryRisks: number;
  redistributionOpportunities: number;
  equipmentIssues: number;
  lastUpdated: string;
}

export interface RiskDistribution {
  criticalShortage: number;
  nearExpiry: number;
  logisticsDelay: number;
  total: number;
}

export interface StockRiskDataPoint {
  week: string;
  actual?: number;
  forecast?: number;
}

export interface PublicFacilityService {
  id: number;
  facility_id: number;
  service_name: string;
  is_available: boolean;
  created_at?: string;
}

export interface PublicFacility {
  id: number;
  name: string;
  location: string;
  type: string;
  district_id?: number | null;
  is_active: boolean;
  latitude?: number | null;
  longitude?: number | null;
  operational_status: string;
  facility_services: PublicFacilityService[];
  distance_km?: number;
}

export interface PaginatedPublicFacilityResponse {
  items: PublicFacility[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface CitizenAssistantResponse {
  answer: string;
  recommended_facilities: PublicFacility[];
  disclaimer: string;
  intent: string;
  sources_used: string[];
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  structured?: {
    summary?: string;
    metrics?: { label: string; value: string }[];
    confidence?: number;
    sources?: string[];
    relatedFacilities?: string[];
  };
}


