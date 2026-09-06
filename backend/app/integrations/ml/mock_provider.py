"""Mock ML Provider implementation for local development and testing."""

from datetime import datetime, timedelta, timezone
from app.integrations.ml.base import MLProvider
from app.schemas import (
    DemandForecastRequest, DemandForecastResponse,
    StockoutRiskRequest, StockoutRiskResponse,
    ExpiryRiskRequest, ExpiryRiskResponse,
    RedistributionScoreRequest, RedistributionScoreResponse
)

class MockMLProvider(MLProvider):
    """Deterministic mock provider for offline local development and automated testing."""

    def predict_demand(self, request: DemandForecastRequest) -> DemandForecastResponse:
        """Calculate deterministic mock demand prediction based on facility and item IDs."""
        if request.historical_data:
            quantities = [d.get("y", d.get("quantity", 0)) for d in request.historical_data if isinstance(d, dict)]
            base_demand = int(sum(quantities) / len(quantities)) if quantities else 50
        else:
            base_demand = (request.facility_id * 10) + (request.item_id * 5) + 30

        predicted_demand = max(1, int(base_demand * 1.15))
        confidence = min(0.95, round(0.70 + (request.item_id % 5) * 0.05, 2))
        predicted_date = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")

        return DemandForecastResponse(
            facility_id=request.facility_id,
            item_id=request.item_id,
            predicted_demand=predicted_demand,
            confidence=confidence,
            predicted_date=predicted_date,
            provider="mock",
            is_mock=True
        )

    def predict_stockout_risk(self, request: StockoutRiskRequest) -> StockoutRiskResponse:
        """Calculate deterministic stock-out risk score based on stock ratio."""
        if request.min_stock <= 0:
            ratio = 1.0
        else:
            ratio = request.current_stock / request.min_stock

        if ratio <= 0.2:
            score = 0.95
            level = "CRITICAL"
            days = 2
        elif ratio <= 0.5:
            score = 0.75
            level = "HIGH"
            days = 5
        elif ratio <= 1.0:
            score = 0.50
            level = "MEDIUM"
            days = 10
        else:
            score = 0.15
            level = "LOW"
            days = 30

        return StockoutRiskResponse(
            facility_id=request.facility_id,
            item_id=request.item_id,
            stockout_risk_score=score,
            risk_level=level,
            estimated_days_to_stockout=days,
            provider="mock",
            is_mock=True
        )

    def predict_expiry_risk(self, request: ExpiryRiskRequest) -> ExpiryRiskResponse:
        """Calculate deterministic expiry risk based on batch expiry dates."""
        total_at_risk = 0
        now = datetime.now(timezone.utc)

        for batch in request.batches:
            try:
                exp_dt = datetime.fromisoformat(batch.expiry_date.replace("Z", "+00:00"))
                if exp_dt.tzinfo is None:
                    exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                days_remaining = (exp_dt - now).days
                if days_remaining <= 60:
                    total_at_risk += batch.quantity
            except ValueError:
                # If date format is simple YYYY-MM-DD
                try:
                    exp_dt = datetime.strptime(batch.expiry_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    days_remaining = (exp_dt - now).days
                    if days_remaining <= 60:
                        total_at_risk += batch.quantity
                except ValueError:
                    pass

        total_qty = sum(b.quantity for b in request.batches) or 1
        risk_score = round(min(1.0, total_at_risk / total_qty), 2)

        if risk_score >= 0.7:
            risk_level = "CRITICAL"
        elif risk_score >= 0.4:
            risk_level = "HIGH"
        elif risk_score > 0.0:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        return ExpiryRiskResponse(
            facility_id=request.facility_id,
            item_id=request.item_id,
            expiry_risk_score=risk_score,
            at_risk_quantity=total_at_risk,
            risk_level=risk_level,
            provider="mock",
            is_mock=True
        )

    def predict_redistribution_score(self, request: RedistributionScoreRequest) -> RedistributionScoreResponse:
        """Calculate deterministic redistribution feasibility and score."""
        same_facility = request.source_facility_id == request.target_facility_id
        if same_facility:
            return RedistributionScoreResponse(
                source_facility_id=request.source_facility_id,
                target_facility_id=request.target_facility_id,
                item_id=request.item_id,
                quantity=request.quantity,
                redistribution_score=0.0,
                feasibility_rating="INVALID",
                estimated_impact="No transfer needed within same facility",
                provider="mock",
                is_mock=True
            )

        score = round(min(0.98, 0.60 + (request.quantity % 10) * 0.03), 2)

        return RedistributionScoreResponse(
            source_facility_id=request.source_facility_id,
            target_facility_id=request.target_facility_id,
            item_id=request.item_id,
            quantity=request.quantity,
            redistribution_score=score,
            feasibility_rating="HIGH" if score > 0.75 else "MEDIUM",
            estimated_impact=f"Redistributing {request.quantity} units will reduce stockout risk at target facility",
            provider="mock",
            is_mock=True
        )
