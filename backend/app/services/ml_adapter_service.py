"""Service layer coordinating ML Engine predictions with PostgreSQL persistence."""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.models import Prediction, Risk, AlertSeverityEnum, RiskStatusEnum, Facility, Item
from app.schemas import (
    DemandForecastRequest, DemandForecastResponse,
    StockoutRiskRequest, StockoutRiskResponse,
    ExpiryRiskRequest, ExpiryRiskResponse,
    RedistributionScoreRequest, RedistributionScoreResponse
)
from app.integrations.ml import get_ml_provider, MLProvider, MLException


class MLAdapterService:
    """Service managing prediction requests, ML provider delegation, and DB persistence."""

    def __init__(self, provider: Optional[MLProvider] = None):
        self.provider = provider or get_ml_provider()

    def get_provider(self, override_provider: Optional[MLProvider] = None) -> MLProvider:
        return override_provider or self.provider

    def predict_and_store_demand(
        self,
        db: Session,
        request: DemandForecastRequest,
        provider: Optional[MLProvider] = None
    ) -> DemandForecastResponse:
        """Execute demand prediction and persist the prediction result to PostgreSQL."""
        active_provider = self.get_provider(provider)
        response = active_provider.predict_demand(request)

        # Parse date string to datetime for DB column
        try:
            predicted_dt = datetime.fromisoformat(response.predicted_date.replace("Z", "+00:00"))
        except ValueError:
            predicted_dt = datetime.strptime(response.predicted_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)

        db_prediction = Prediction(
            facility_id=response.facility_id,
            item_id=response.item_id,
            predicted_demand=response.predicted_demand,
            confidence=response.confidence,
            predicted_date=predicted_dt
        )
        db.add(db_prediction)
        db.commit()
        db.refresh(db_prediction)

        return response

    def assess_and_store_stockout_risk(
        self,
        db: Session,
        request: StockoutRiskRequest,
        provider: Optional[MLProvider] = None
    ) -> StockoutRiskResponse:
        """Assess stock-out risk and persist risk record if severe."""
        active_provider = self.get_provider(provider)
        response = active_provider.predict_stockout_risk(request)

        if response.risk_level in ("HIGH", "CRITICAL"):
            severity = AlertSeverityEnum.CRITICAL if response.risk_level == "CRITICAL" else AlertSeverityEnum.HIGH
            db_risk = Risk(
                facility_id=response.facility_id,
                item_id=response.item_id,
                risk_type="STOCKOUT_RISK",
                severity=severity,
                description=f"Stock-out risk score {response.risk_level} ({response.stockout_risk_score}). Estimated days to stockout: {response.estimated_days_to_stockout}",
                status=RiskStatusEnum.ACTIVE
            )
            db.add(db_risk)
            db.commit()

        return response

    def assess_and_store_expiry_risk(
        self,
        db: Session,
        request: ExpiryRiskRequest,
        provider: Optional[MLProvider] = None
    ) -> ExpiryRiskResponse:
        """Assess batch expiry risk and persist risk record if severe."""
        active_provider = self.get_provider(provider)
        response = active_provider.predict_expiry_risk(request)

        if response.risk_level in ("HIGH", "CRITICAL"):
            severity = AlertSeverityEnum.CRITICAL if response.risk_level == "CRITICAL" else AlertSeverityEnum.HIGH
            db_risk = Risk(
                facility_id=response.facility_id,
                item_id=response.item_id,
                risk_type="EXPIRY_RISK",
                severity=severity,
                description=f"Expiry risk score {response.risk_level} ({response.expiry_risk_score}). At risk quantity: {response.at_risk_quantity}",
                status=RiskStatusEnum.ACTIVE
            )
            db.add(db_risk)
            db.commit()

        return response

    def score_redistribution(
        self,
        db: Session,
        request: RedistributionScoreRequest,
        provider: Optional[MLProvider] = None
    ) -> RedistributionScoreResponse:
        """Calculate redistribution recommendation score."""
        active_provider = self.get_provider(provider)
        return active_provider.predict_redistribution_score(request)


# Global instance for service reuse
ml_adapter_service = MLAdapterService()
