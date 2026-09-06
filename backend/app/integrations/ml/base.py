"""Abstract Base Class for ML Providers."""

from abc import ABC, abstractmethod
from app.schemas import (
    DemandForecastRequest, DemandForecastResponse,
    StockoutRiskRequest, StockoutRiskResponse,
    ExpiryRiskRequest, ExpiryRiskResponse,
    RedistributionScoreRequest, RedistributionScoreResponse
)

class MLProvider(ABC):
    """Abstract interface defining required capabilities for ML Engine adapters."""

    @abstractmethod
    def predict_demand(self, request: DemandForecastRequest) -> DemandForecastResponse:
        """Predict future demand for a facility and item."""
        pass

    @abstractmethod
    def predict_stockout_risk(self, request: StockoutRiskRequest) -> StockoutRiskResponse:
        """Calculate stock-out risk score and risk level for an item at a facility."""
        pass

    @abstractmethod
    def predict_expiry_risk(self, request: ExpiryRiskRequest) -> ExpiryRiskResponse:
        """Calculate batch expiry risk score and identify at-risk quantities."""
        pass

    @abstractmethod
    def predict_redistribution_score(self, request: RedistributionScoreRequest) -> RedistributionScoreResponse:
        """Calculate feasibility and score for redistributing stock between facilities."""
        pass
