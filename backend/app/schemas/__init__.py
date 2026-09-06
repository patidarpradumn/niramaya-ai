"""Pydantic schemas for request/response validation."""

from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from typing import Optional, List, Dict, Any
from app.models import (
    UserRole, FacilityType, AlertSeverity, AlertSeverityEnum, StockLevel, StockMovementTypeEnum,
    RiskCategoryEnum, AlertStatusEnum, RecommendationStatusEnum, TransferStatusEnum, EquipmentStatusEnum
)



# Auth Schemas
class Token(BaseModel):
    """JWT token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Token payload data."""
    user_id: Optional[int] = None
    firebase_uid: Optional[str] = None
    email: str
    role: UserRole
    token_type: str = "access"


class LoginRequest(BaseModel):
    """Login request payload."""
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    """Refresh token request."""
    refresh_token: str


class MessageResponse(BaseModel):
    """Generic message response."""
    message: str


# User Schemas
class UserBase(BaseModel):
    """Base user schema."""
    model_config = ConfigDict(extra="ignore")
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.CITIZEN

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role_value(cls, v: Any) -> Any:
        if isinstance(v, str):
            v_clean = v.strip().lower()
            if v_clean in ("admin", "super_admin"):
                return UserRole.SUPER_ADMIN
            elif v_clean == "state_admin":
                return UserRole.STATE_ADMIN
            elif v_clean == "district_admin":
                return UserRole.DISTRICT_ADMIN
            elif v_clean in ("hospital_admin", "facility_manager", "hospital"):
                return UserRole.HOSPITAL_ADMIN
            elif v_clean in ("facility_staff", "staff"):
                return UserRole.FACILITY_STAFF
            elif v_clean in ("citizen", "viewer"):
                return UserRole.CITIZEN
        return v


class UserCreate(UserBase):
    """User creation request."""
    password: Optional[str] = None
    firebase_uid: Optional[str] = None
    facility_id: Optional[int] = None
    state_id: Optional[int] = None
    district_id: Optional[int] = None


class UserRegister(UserBase):
    """Admin/Dev user registration request."""
    firebase_uid: Optional[str] = None
    facility_id: Optional[int] = None
    state_id: Optional[int] = None
    district_id: Optional[int] = None



class UserResponse(UserBase):
    """User response (without password or password hash)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: Optional[str] = None
    facility_id: Optional[int] = None
    state_id: Optional[int] = None
    district_id: Optional[int] = None
    is_active: bool = True
    approval_status: Optional[str] = None
    created_at: Optional[datetime] = None

    def model_post_init(self, __context: Any) -> None:
        if not self.name and self.full_name:
            self.name = self.full_name


class UserUpdate(BaseModel):
    """User update request."""
    full_name: Optional[str] = None
    password: Optional[str] = None
    facility_id: Optional[int] = None
    state_id: Optional[int] = None
    district_id: Optional[int] = None


# Facility Service Schemas
class FacilityServiceBase(BaseModel):
    """Base facility service schema."""
    service_name: str
    is_available: bool = True


class FacilityServiceCreate(FacilityServiceBase):
    """Facility service creation schema."""
    pass


class FacilityServiceResponse(FacilityServiceBase):
    """Facility service response schema."""
    id: int
    facility_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# Facility Schemas
class FacilityBase(BaseModel):
    """Base facility schema."""
    name: str
    location: str
    type: FacilityType
    district_id: Optional[int] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    is_active: bool = True
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    operational_status: str = "OPERATIONAL"

    @field_validator("latitude")
    def validate_latitude(cls, v):
        if v is not None and (v < -90.0 or v > 90.0):
            raise ValueError("Latitude must be between -90.0 and 90.0 degrees")
        return v

    @field_validator("longitude")
    def validate_longitude(cls, v):
        if v is not None and (v < -180.0 or v > 180.0):
            raise ValueError("Longitude must be between -180.0 and 180.0 degrees")
        return v


class FacilityCreate(FacilityBase):
    """Facility creation request."""
    pass


class FacilityUpdate(BaseModel):
    """Facility update request."""
    name: Optional[str] = None
    location: Optional[str] = None
    type: Optional[FacilityType] = None
    district_id: Optional[int] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    is_active: Optional[bool] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    operational_status: Optional[str] = None

    @field_validator("latitude")
    def validate_latitude(cls, v):
        if v is not None and (v < -90.0 or v > 90.0):
            raise ValueError("Latitude must be between -90.0 and 90.0 degrees")
        return v

    @field_validator("longitude")
    def validate_longitude(cls, v):
        if v is not None and (v < -180.0 or v > 180.0):
            raise ValueError("Longitude must be between -180.0 and 180.0 degrees")
        return v


class PublicFacilityResponse(BaseModel):
    """Public, citizen-safe facility representation omitting administrative contact details."""
    id: int
    name: str
    location: str
    type: FacilityType
    district_id: Optional[int] = None
    is_active: bool
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    operational_status: str
    facility_services: List[FacilityServiceResponse] = []
    model_config = ConfigDict(from_attributes=True)


class PaginatedPublicFacilityResponse(BaseModel):
    """Paginated public facility list response."""
    items: List[PublicFacilityResponse]
    total: int
    page: int
    size: int
    pages: int


class FacilityResponse(FacilityBase):
    """Facility response for administrative users."""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    facility_services: List[FacilityServiceResponse] = []
    model_config = ConfigDict(from_attributes=True)


class PaginatedFacilityResponse(BaseModel):
    """Paginated facility list response."""
    items: List[FacilityResponse]
    total: int
    page: int
    size: int
    pages: int


class PaginatedPublicFacilityResponse(BaseModel):
    """Paginated public facility list response."""
    items: List[PublicFacilityResponse]
    total: int
    page: int
    size: int
    pages: int


# Item Catalog Schemas
class ItemBase(BaseModel):
    """Base item schema."""
    name: str = Field(..., min_length=1, max_length=255)
    code: str = Field(..., min_length=1, max_length=50)
    category: str = Field(..., min_length=1, max_length=100)
    unit: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None


class ItemCreate(ItemBase):
    """Item creation request."""
    pass


class ItemUpdate(BaseModel):
    """Item update request."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    unit: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = None


class ItemResponse(ItemBase):
    """Item response."""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class PaginatedItemResponse(BaseModel):
    """Paginated item response."""
    items: List[ItemResponse]
    total: int
    page: int
    size: int
    pages: int


# Inventory Schemas
class InventoryBase(BaseModel):
    """Base inventory schema."""
    facility_id: int
    item_id: Optional[int] = None
    item_name: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    current_stock: int = Field(0, ge=0, description="Current stock quantity")
    min_threshold: int = Field(10, ge=0, description="Minimum threshold")
    max_threshold: int = Field(100, ge=0, description="Maximum threshold")
    batch_number: Optional[str] = "BATCH-001"
    expiry_date: Optional[datetime] = None

    @field_validator("current_stock")
    def validate_stock_non_negative(cls, v):
        if v < 0:
            raise ValueError("Stock quantity cannot be negative")
        return v

    @field_validator("min_threshold")
    def validate_min_non_negative(cls, v):
        if v < 0:
            raise ValueError("Minimum stock level cannot be negative")
        return v


class InventoryCreate(InventoryBase):
    """Inventory creation request."""
    quantity: Optional[int] = Field(None, ge=0)
    min_stock_level: Optional[int] = Field(None, ge=0)
    max_stock_level: Optional[int] = Field(None, ge=0)


class InventoryUpdate(BaseModel):
    """Inventory update request."""
    current_stock: Optional[int] = Field(None, ge=0)
    quantity: Optional[int] = Field(None, ge=0)
    min_threshold: Optional[int] = Field(None, ge=0)
    min_stock_level: Optional[int] = Field(None, ge=0)
    max_threshold: Optional[int] = Field(None, ge=0)
    max_stock_level: Optional[int] = Field(None, ge=0)
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    unit: Optional[str] = None
    item_name: Optional[str] = None
    category: Optional[str] = None

    @field_validator("current_stock", "quantity")
    def validate_stock(cls, v):
        if v is not None and v < 0:
            raise ValueError("Stock quantity cannot be negative")
        return v


class InventoryResponse(BaseModel):
    """Inventory response with dynamic stock status and batch information."""
    id: int
    facility_id: int
    item_id: Optional[int] = None
    item_name: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = "units"
    current_stock: int
    quantity: int
    min_threshold: int
    min_stock_level: int
    max_threshold: int
    max_stock_level: int
    batch_number: Optional[str] = "BATCH-001"
    expiry_date: Optional[datetime] = None
    is_low_stock: bool = False
    stock_level: StockLevel
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_updated: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PaginatedInventoryResponse(BaseModel):
    """Paginated inventory response."""
    items: List[InventoryResponse]
    total: int
    page: int
    size: int
    pages: int


# Alert Schemas
class AlertBase(BaseModel):
    """Base alert schema."""
    severity: AlertSeverityEnum
    title: str
    description: str

    @field_validator("severity", mode="before")
    @classmethod
    def validate_severity(cls, v: Any) -> Any:
        if isinstance(v, str):
            v_lower = v.lower()
            for sev in AlertSeverityEnum:
                if sev.value == v_lower or sev.name.lower() == v_lower:
                    return sev
        return v


class AlertCreate(AlertBase):
    """Alert creation request."""
    facility_id: int
    item_id: Optional[int] = None
    prediction_id: Optional[int] = None
    risk_id: Optional[int] = None
    risk_category: Optional[RiskCategoryEnum] = RiskCategoryEnum.STOCK_OUT
    details: Optional[Dict[str, Any]] = None


class AlertUpdate(BaseModel):
    """Alert update request (status, severity, notes)."""
    status: Optional[AlertStatusEnum] = None
    severity: Optional[AlertSeverityEnum] = None
    title: Optional[str] = None
    description: Optional[str] = None
    resolution_notes: Optional[str] = None
    acknowledged: Optional[bool] = None

    @field_validator("severity", mode="before")
    @classmethod
    def validate_severity(cls, v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, str):
            v_lower = v.lower()
            for sev in AlertSeverityEnum:
                if sev.value == v_lower or sev.name.lower() == v_lower:
                    return sev
        return v


class AlertResponse(AlertBase):
    """Alert response schema."""
    id: int
    facility_id: int
    item_id: Optional[int] = None
    prediction_id: Optional[int] = None
    risk_id: Optional[int] = None
    risk_category: RiskCategoryEnum = RiskCategoryEnum.STOCK_OUT
    status: AlertStatusEnum = AlertStatusEnum.ACTIVE
    details: Optional[Dict[str, Any]] = None
    acknowledged: bool = False
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[int] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[int] = None
    resolution_notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AlertAcknowledge(BaseModel):
    """Alert acknowledgement request payload (optional notes)."""
    notes: Optional[str] = None


# Prediction Schemas
class PredictionBase(BaseModel):
    """Base prediction schema."""
    predicted_demand: int
    confidence: float = Field(ge=0.0, le=1.0)
    predicted_date: datetime


class PredictionCreate(PredictionBase):
    """Prediction creation request."""
    facility_id: int
    item_id: int


class PredictionResponse(PredictionBase):
    """Prediction response."""
    id: int
    facility_id: int
    item_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# AI Schemas
class AIQueryRequest(BaseModel):
    """AI query request."""
    query: str
    context: Optional[str] = None


class AIExplainRequest(BaseModel):
    """AI explanation request."""
    prediction_id: int


class AIResponse(BaseModel):
    """AI response."""
    response: str
    sources: Optional[List[str]] = None


class AIExplainAlertRequest(BaseModel):
    """Request schema for explaining an alert."""
    alert_id: int
    language: Optional[str] = "English"


class AIExplainPredictionRequest(BaseModel):
    """Request schema for explaining a prediction."""
    prediction_id: int
    language: Optional[str] = "English"


class AIExplainRecommendationRequest(BaseModel):
    """Request schema for explaining a redistribution recommendation."""
    recommendation_id: int
    language: Optional[str] = "English"


class AIFacilitySummaryRequest(BaseModel):
    """Request schema for generating a facility summary."""
    facility_id: int
    language: Optional[str] = "English"


class AIDistrictSummaryRequest(BaseModel):
    """Request schema for generating a district summary."""
    district_id: int
    language: Optional[str] = "English"


class AIChatRequest(BaseModel):
    """Request schema for natural-language chat query."""
    query: str
    facility_id: Optional[int] = None
    language: Optional[str] = "English"


class AIChatResponse(BaseModel):
    """Structured response schema for AI chat."""
    response: str
    intent_classified: str
    sources_used: List[str]
    disclaimer: str


class AIExplainResponse(BaseModel):
    """Structured response schema for AI explanations."""
    explanation: str
    disclaimer: str


class AISummaryResponse(BaseModel):
    """Structured response schema for AI summaries."""
    summary: str
    key_insights: List[str]
    disclaimer: str



# Dashboard Schemas
class DashboardKPIs(BaseModel):
    """Dashboard KPI metrics."""
    total_facilities: int
    total_items: int
    critical_alerts: int
    low_stock_items: int
    predicted_demand_count: int


class RecentAlert(BaseModel):
    """Recent alert for dashboard."""
    id: int
    severity: AlertSeverity
    title: str
    facility_name: str
    created_at: datetime


class DashboardSummary(BaseModel):
    """Dashboard summary response."""
    kpis: DashboardKPIs
    recent_alerts: List[RecentAlert]
    stock_summary: dict


class TrendDataPoint(BaseModel):
    """Trend data point."""
    date: str
    value: float


class DashboardTrendsResponse(BaseModel):
    """Dashboard trends response."""
    consumption_trend: List[TrendDataPoint]
    alert_trend: List[TrendDataPoint]


class DashboardStockRisk(BaseModel):
    """Dashboard stock risk item."""
    inventory_id: int
    item_name: str
    facility_name: str
    current_stock: int
    min_threshold: int
    status: str


class DashboardExpiryRisk(BaseModel):
    """Dashboard expiry risk item."""
    inventory_id: int
    item_name: str
    facility_name: str
    quantity: int
    expiry_date: datetime
    days_to_expiry: int


# Stock Movement Schemas
class StockMovementBase(BaseModel):
    """Base stock movement schema."""
    facility_id: int
    item_id: int
    movement_type: StockMovementTypeEnum
    quantity: int = Field(..., gt=0, description="Quantity moved must be greater than 0")
    reference: Optional[str] = None


class StockMovementCreate(StockMovementBase):
    """Stock movement creation request."""
    inventory_id: Optional[int] = None


class StockMovementResponse(StockMovementBase):
    """Stock movement response."""
    id: int
    created_by_user_id: Optional[int] = None
    created_at: datetime
    facility_name: Optional[str] = None
    item_name: Optional[str] = None
    user_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PaginatedStockMovementResponse(BaseModel):
    """Paginated stock movement response."""
    items: List[StockMovementResponse]
    total: int
    page: int
    size: int
    pages: int


# Consumption Record Schemas

class ConsumptionBase(BaseModel):
    """Base schema for consumption record."""
    facility_id: int
    item_id: int
    quantity_consumed: int = Field(..., gt=0, description="Quantity consumed must be greater than 0")
    record_date: Optional[datetime] = None


class ConsumptionCreate(ConsumptionBase):
    """Consumption record creation request."""
    pass


class ConsumptionResponse(ConsumptionBase):
    """Consumption record response."""
    id: int
    record_date: datetime
    created_at: datetime
    facility_name: Optional[str] = None
    item_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PaginatedConsumptionResponse(BaseModel):
    """Paginated consumption records response."""
    items: List[ConsumptionResponse]
    total: int
    page: int
    size: int
    pages: int


class ConsumptionSummaryItem(BaseModel):
    """Individual aggregated consumption period summary."""
    period_start: str
    period_end: str
    facility_id: Optional[int] = None
    item_id: Optional[int] = None
    total_quantity: int
    record_count: int
    average_daily: float


class ConsumptionSummaryResponse(BaseModel):
    """Aggregated consumption summary response."""
    period: str  # "daily" or "weekly"
    facility_id: Optional[int] = None
    item_id: Optional[int] = None
    total_consumed: int
    summary: List[ConsumptionSummaryItem]


class MLConsumptionDataPoint(BaseModel):
    """Data point formatted for ML consumption input."""
    ds: str  # YYYY-MM-DD
    y: int   # aggregated quantity consumed
    facility_id: int
    item_id: int


class MLInputPreparationResponse(BaseModel):
    """ML Engine consumption history payload format."""
    facility_id: Optional[int] = None
    item_id: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    total_records: int
    total_quantity: int
    data_points: List[MLConsumptionDataPoint]


# ML Provider Integration Schemas
class DemandForecastRequest(BaseModel):
    """Request schema for demand forecast prediction."""
    facility_id: int
    item_id: int
    historical_days: int = 30
    historical_data: Optional[List[Dict[str, Any]]] = None


class DemandForecastResponse(BaseModel):
    """Response schema for demand forecast prediction."""
    facility_id: int
    item_id: int
    predicted_demand: int
    confidence: float = Field(ge=0.0, le=1.0)
    predicted_date: str
    provider: str = "mock"
    is_mock: bool = True


class StockoutRiskRequest(BaseModel):
    """Request schema for stock-out risk assessment."""
    facility_id: int
    item_id: int
    current_stock: int
    min_stock: int
    lead_time_days: int = 7


class StockoutRiskResponse(BaseModel):
    """Response schema for stock-out risk assessment."""
    facility_id: int
    item_id: int
    stockout_risk_score: float = Field(ge=0.0, le=1.0)
    risk_level: str
    estimated_days_to_stockout: Optional[int] = None
    provider: str = "mock"
    is_mock: bool = True


class BatchExpiryInfo(BaseModel):
    """Information about a single batch for expiry evaluation."""
    batch_number: str
    quantity: int
    expiry_date: str


class ExpiryRiskRequest(BaseModel):
    """Request schema for batch expiry risk assessment."""
    facility_id: int
    item_id: int
    batches: List[BatchExpiryInfo]


class ExpiryRiskResponse(BaseModel):
    """Response schema for batch expiry risk assessment."""
    facility_id: int
    item_id: int
    expiry_risk_score: float = Field(ge=0.0, le=1.0)
    at_risk_quantity: int
    risk_level: str
    provider: str = "mock"
    is_mock: bool = True


class RedistributionScoreRequest(BaseModel):
    """Request schema for redistribution scoring."""
    source_facility_id: int
    target_facility_id: int
    item_id: int
    quantity: int


class RedistributionScoreResponse(BaseModel):
    """Response schema for redistribution scoring."""
    source_facility_id: int
    target_facility_id: int
    item_id: int
    quantity: int
    redistribution_score: float = Field(ge=0.0, le=1.0)
    feasibility_rating: str
    estimated_impact: str
    provider: str = "mock"
    is_mock: bool = True


# Redistribution & Recommendation Workflow Schemas
class RecommendationBase(BaseModel):
    """Base schema for recommendation."""
    title: str
    action_type: str = "REDISTRIBUTION"
    facility_id: Optional[int] = None
    source_facility_id: Optional[int] = None
    destination_facility_id: Optional[int] = None
    item_id: Optional[int] = None
    prediction_id: Optional[int] = None
    risk_id: Optional[int] = None
    suggested_quantity: Optional[int] = Field(None, gt=0)
    reasoning: str
    details: Optional[Dict[str, Any]] = None


class RecommendationCreate(RecommendationBase):
    """Schema for creating a recommendation."""
    pass


class RecommendationModify(BaseModel):
    """Schema for modifying a recommendation."""
    suggested_quantity: Optional[int] = Field(None, gt=0)
    source_facility_id: Optional[int] = None
    destination_facility_id: Optional[int] = None
    reasoning: Optional[str] = None
    notes: Optional[str] = None


class RecommendationApprove(BaseModel):
    """Schema for approving a recommendation."""
    override_quantity: Optional[int] = Field(None, gt=0)
    notes: Optional[str] = None


class RecommendationReject(BaseModel):
    """Schema for rejecting a recommendation."""
    notes: Optional[str] = None


class ApprovalActionResponse(BaseModel):
    """Response schema for human approval actions."""
    id: int
    recommendation_id: Optional[int] = None
    transfer_id: Optional[int] = None
    user_id: int
    action: str
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TransferResponse(BaseModel):
    """Response schema for cross-facility stock transfer requests."""
    id: int
    source_facility_id: int
    destination_facility_id: int
    item_id: int
    quantity: int
    status: TransferStatusEnum
    created_at: datetime
    updated_at: Optional[datetime] = None

    source_facility_name: Optional[str] = None
    destination_facility_name: Optional[str] = None
    item_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RecommendationResponse(RecommendationBase):
    """Response schema for recommendations."""
    id: int
    status: RecommendationStatusEnum
    created_at: datetime
    updated_at: Optional[datetime] = None

    facility_name: Optional[str] = None
    source_facility_name: Optional[str] = None
    destination_facility_name: Optional[str] = None
    item_name: Optional[str] = None
    approval_actions: Optional[List[ApprovalActionResponse]] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("status", mode="before")
    @classmethod
    def parse_status(cls, v: Any) -> Any:
        if isinstance(v, str):
            v_upper = v.upper()
            for member in RecommendationStatusEnum:
                if member.value == v_upper:
                    return member
        return v


class PaginatedRecommendationResponse(BaseModel):
    """Paginated recommendations response."""
    items: List[RecommendationResponse]
    total: int
    page: int
    size: int
    pages: int


# Equipment & Maintenance Schemas
class EquipmentBase(BaseModel):
    """Base equipment schema."""
    name: str
    equipment_type: Optional[str] = None
    serial_number: Optional[str] = None
    status: EquipmentStatusEnum = EquipmentStatusEnum.OPERATIONAL
    installation_date: Optional[datetime] = None
    purchase_date: Optional[datetime] = None
    last_maintenance_date: Optional[datetime] = None
    next_maintenance_date: Optional[datetime] = None
    downtime_hours: float = 0.0

    @field_validator("status", mode="before")
    @classmethod
    def parse_status(cls, v: Any) -> Any:
        if isinstance(v, str):
            v_upper = v.upper()
            for member in EquipmentStatusEnum:
                if member.value == v_upper or member.name == v_upper:
                    return member
        return v


class EquipmentCreate(EquipmentBase):
    """Equipment creation schema."""
    facility_id: int


class EquipmentUpdate(BaseModel):
    """Equipment update schema."""
    name: Optional[str] = None
    equipment_type: Optional[str] = None
    serial_number: Optional[str] = None
    status: Optional[EquipmentStatusEnum] = None
    installation_date: Optional[datetime] = None
    purchase_date: Optional[datetime] = None
    last_maintenance_date: Optional[datetime] = None
    next_maintenance_date: Optional[datetime] = None
    downtime_hours: Optional[float] = None

    @field_validator("status", mode="before")
    @classmethod
    def parse_status(cls, v: Any) -> Any:
        if isinstance(v, str):
            v_upper = v.upper()
            for member in EquipmentStatusEnum:
                if member.value == v_upper or member.name == v_upper:
                    return member
        return v


class EquipmentResponse(EquipmentBase):
    """Equipment response schema."""
    id: int
    facility_id: int
    facility_name: Optional[str] = None
    is_overdue_maintenance: bool = False
    downtime_days: float = 0.0
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PaginatedEquipmentResponse(BaseModel):
    """Paginated equipment list response."""
    items: List[EquipmentResponse]
    total: int
    page: int
    size: int
    pages: int


class MaintenanceRecordBase(BaseModel):
    """Base maintenance record schema."""
    description: str
    performed_by: Optional[str] = None
    cost: float = 0.0
    maintenance_date: datetime
    next_due_date: Optional[datetime] = None
    maintenance_type: Optional[str] = "ROUTINE"
    downtime_hours: float = 0.0


class MaintenanceRecordCreate(MaintenanceRecordBase):
    """Maintenance record creation schema."""
    equipment_id: int
    update_equipment_status: Optional[EquipmentStatusEnum] = None


class MaintenanceRecordResponse(MaintenanceRecordBase):
    """Maintenance record response schema."""
    id: int
    equipment_id: int
    equipment_name: Optional[str] = None
    facility_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedMaintenanceResponse(BaseModel):
    """Paginated maintenance records response."""
    items: List[MaintenanceRecordResponse]
    total: int
    page: int
    size: int
    pages: int


class EquipmentDowntimeAnalysis(BaseModel):
    """Downtime and availability metrics for equipment."""
    equipment_id: int
    equipment_name: str
    status: EquipmentStatusEnum
    total_downtime_hours: float
    total_downtime_days: float
    uptime_percentage: float
    last_maintenance_date: Optional[datetime] = None
    next_maintenance_date: Optional[datetime] = None
    is_overdue: bool = False
    maintenance_count: int = 0


# Audit Log Schemas
class AuditLogResponse(BaseModel):
    """Audit log response schema."""
    id: int
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    details: Optional[str] = None
    correlation_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedAuditLogResponse(BaseModel):
    """Paginated audit log response."""
    items: List[AuditLogResponse]
    total: int
    page: int
    size: int
    pages: int