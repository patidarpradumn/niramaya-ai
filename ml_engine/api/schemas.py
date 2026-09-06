"""
MediGuard AI - API Data Schemas
Defines strictly validated Pydantic models for API requests and responses.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class DailyConsumptionRecord(BaseModel):
    date: str = Field(..., description="Date formatted as YYYY-MM-DD", examples=["2025-01-01"])
    quantity_consumed: float = Field(..., ge=0.0, description="Nonnegative daily consumption", examples=[45.0])


class BatchInventoryRecord(BaseModel):
    batch_id: str = Field(..., examples=["BAT-1001"])
    quantity: float = Field(..., ge=0.0, examples=[500.0])
    expiry_date: str = Field(..., description="Expiry date as YYYY-MM-DD", examples=["2026-06-30"])
    received_date: Optional[str] = Field(None, examples=["2025-01-10"])


class ForecastRequest(BaseModel):
    facility_id: str = Field(..., examples=["FAC001"])
    resource_id: str = Field(..., examples=["RES001"])
    horizon_days: int = Field(7, description="Forecast horizon in days (e.g. 7, 14, 30)", examples=[7])
    history: Optional[List[DailyConsumptionRecord]] = Field(
        None, description="Optional historical consumption records. If omitted, uses central database series."
    )
    current_stock: Optional[float] = Field(None, ge=0.0, examples=[1200.0])
    lead_time_days: Optional[int] = Field(7, ge=1, examples=[7])
    min_stock: Optional[float] = Field(500.0, ge=0.0, examples=[500.0])
    reorder_level: Optional[float] = Field(1200.0, ge=0.0, examples=[1200.0])
    facility_type: Optional[str] = Field("CHC", examples=["District Hospital"])
    resource_category: Optional[str] = Field("Analgesics", examples=["Analgesics"])
    capacity: Optional[float] = Field(50.0, examples=[300.0])
    batches: Optional[List[BatchInventoryRecord]] = Field(None, description="Optional batch inventory for expiry analysis")

    @field_validator("horizon_days")
    @classmethod
    def validate_horizon(cls, v: int) -> int:
        if v not in [7, 14, 30]:
            if v < 1 or v > 90:
                raise ValueError("horizon_days must be between 1 and 90 (standard: 7, 14, 30).")
        return v


class ForecastPoint(BaseModel):
    step: int
    date: str
    predicted_demand: float


class StockRiskResponse(BaseModel):
    risk_level: str
    stock_cover_days: float
    daily_burn_rate: float
    current_stock: float
    lead_time_days: int
    projected_stock_before_replenishment: float
    projected_deficit: float
    min_stock: float
    reorder_level: float
    reorder_recommended: bool
    recommended_order_quantity: float
    risk_factors: List[str]


class ExpiryBatchResponse(BaseModel):
    batch_id: str
    quantity: float
    expiry_date: str
    days_to_expiry: int
    status: str
    potential_excess_quantity: float
    recommended_action: str


class ExpiryRiskResponse(BaseModel):
    overall_status: str
    as_of_date: str
    daily_burn_rate: float
    total_stock: float
    expired_quantity: float
    at_risk_excess_quantity: float
    safe_quantity: float
    batches: List[ExpiryBatchResponse]


class ForecastResponse(BaseModel):
    facility_id: str
    resource_id: str
    horizon_days: int
    model_version: str
    model_type: str
    is_fallback: bool
    predictions: List[ForecastPoint]
    total_predicted_demand: float
    daily_burn_rate: float
    stock_out_risk: Optional[StockRiskResponse] = None
    expiry_risk: Optional[ExpiryRiskResponse] = None
    timestamp: str


class BatchForecastRequest(BaseModel):
    requests: List[ForecastRequest]


class BatchForecastResponse(BaseModel):
    total_requests: int
    successful_count: int
    failed_count: int
    results: List[ForecastResponse]
    errors: List[Dict[str, Any]]


class ScenarioSimulationRequest(BaseModel):
    facility_id: str = Field(..., examples=["FAC001"])
    resource_id: str = Field(..., examples=["RES001"])
    normal_forecast_demand: float = Field(..., gt=0.0, examples=[850.0])
    current_stock: float = Field(..., ge=0.0, examples=[1200.0])
    multiplier: float = Field(1.40, gt=0.0, examples=[1.40], description="Multiplier such as 1.20, 1.40, 1.60, 2.00")
    horizon_days: Optional[int] = Field(7, examples=[7])
    lead_time_days: Optional[int] = Field(7, examples=[7])
    min_stock: Optional[float] = Field(500.0, examples=[500.0])
    reorder_level: Optional[float] = Field(1200.0, examples=[1200.0])
    scenario_name: Optional[str] = Field(None, examples=["Monsoon Dengue Epidemic (+40%)"])


class FacilityStateInput(BaseModel):
    facility_id: str
    name: Optional[str] = None
    latitude: float
    longitude: float
    current_stock: float
    daily_burn_rate: float
    min_stock: float = 500.0
    stock_cover_days: float
    risk_level: str
    near_expiry_excess: Optional[float] = 0.0


class RedistributionRequest(BaseModel):
    resource_id: str = Field(..., examples=["RES001"])
    resource_name: Optional[str] = Field(None, examples=["Paracetamol 500mg"])
    facilities: Optional[List[FacilityStateInput]] = None
    max_transfer_distance_km: Optional[float] = 300.0
