"""Real ML Provider implementation interfacing with external ML Engine service over HTTP."""

import time
import logging
from typing import Optional, Dict, Any
import httpx
from pydantic import ValidationError

from app.config import settings
from app.integrations.ml.base import MLProvider
from app.integrations.ml.exceptions import (
    MLException,
    MLTimeoutException,
    MLConnectionException,
    MLResponseException,
    MLValidationError,
)
from app.schemas import (
    DemandForecastRequest, DemandForecastResponse,
    StockoutRiskRequest, StockoutRiskResponse,
    ExpiryRiskRequest, ExpiryRiskResponse,
    RedistributionScoreRequest, RedistributionScoreResponse
)

logger = logging.getLogger("mediguard.ml_provider")


class RealMLProvider(MLProvider):
    """Production provider connecting to external ML microservice via HTTP requests."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
        api_key: Optional[str] = None,
        max_retries: int = 2
    ):
        self.base_url = (base_url or settings.ML_ENGINE_BASE_URL or settings.ML_ENGINE_URL).rstrip("/")
        self.timeout = timeout if timeout is not None else settings.ML_ENGINE_TIMEOUT
        self.api_key = api_key if api_key is not None else settings.ML_ENGINE_API_KEY
        self.max_retries = max_retries

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
            headers["X-API-Key"] = self.api_key
        return headers

    def _log_safe(self, message: str, level: str = "info"):
        # Redact API key if present in string
        if self.api_key and self.api_key in message:
            message = message.replace(self.api_key, "[REDACTED_API_KEY]")
        if level == "error":
            logger.error(message)
        elif level == "warning":
            logger.warning(message)
        else:
            logger.info(message)

    def _send_request(self, endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send POST request to external ML Engine with timeout, retry, and connection failure handling.
        """
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = self._get_headers()

        last_exception = None

        for attempt in range(1 + self.max_retries):
            try:
                self._log_safe(f"Calling ML Engine endpoint '{endpoint}' (attempt {attempt + 1})")
                with httpx.Client(timeout=self.timeout) as client:
                    response = client.post(url, json=payload, headers=headers)

                # Check HTTP status code
                if response.status_code >= 500:
                    self._log_safe(
                        f"ML Engine returned server error status {response.status_code}: {response.text[:200]}",
                        level="warning"
                    )
                    last_exception = MLResponseException(f"ML Engine server error HTTP {response.status_code}")
                    if attempt < self.max_retries:
                        time.sleep(0.2 * (2 ** attempt))
                        continue
                    raise last_exception

                if response.status_code >= 400:
                    self._log_safe(
                        f"ML Engine returned client error status {response.status_code}: {response.text[:200]}",
                        level="error"
                    )
                    raise MLResponseException(f"ML Engine HTTP error {response.status_code}: {response.text[:200]}")

                try:
                    return response.json()
                except Exception as exc:
                    self._log_safe(f"Failed to decode JSON from ML Engine response: {exc}", level="error")
                    raise MLResponseException("Invalid JSON response received from ML Engine") from exc

            except httpx.TimeoutException as exc:
                self._log_safe(f"Timeout connecting to ML Engine at {url} after {self.timeout}s", level="warning")
                last_exception = MLTimeoutException(f"ML Engine request timed out after {self.timeout}s")
                if attempt < self.max_retries:
                    time.sleep(0.2 * (2 ** attempt))
                    continue
                raise last_exception from exc

            except httpx.RequestError as exc:
                self._log_safe(f"Network error connecting to ML Engine at {url}: {exc}", level="warning")
                last_exception = MLConnectionException(f"Failed to connect to ML Engine: {str(exc)}")
                if attempt < self.max_retries:
                    time.sleep(0.2 * (2 ** attempt))
                    continue
                raise last_exception from exc

        if last_exception:
            raise last_exception
        raise MLConnectionException("Failed to complete request to ML Engine")

    def predict_demand(self, request: DemandForecastRequest) -> DemandForecastResponse:
        """Fetch demand prediction from external ML Engine."""
        payload = request.model_dump()
        raw_response = self._send_request("predict/demand", payload)
        try:
            raw_response["provider"] = "real"
            raw_response["is_mock"] = False
            return DemandForecastResponse(**raw_response)
        except ValidationError as exc:
            self._log_safe(f"Demand forecast response schema validation error: {exc}", level="error")
            raise MLValidationError(f"Invalid schema in ML Engine response: {exc}") from exc

    def predict_stockout_risk(self, request: StockoutRiskRequest) -> StockoutRiskResponse:
        """Fetch stock-out risk assessment from external ML Engine."""
        payload = request.model_dump()
        raw_response = self._send_request("predict/stockout-risk", payload)
        try:
            raw_response["provider"] = "real"
            raw_response["is_mock"] = False
            return StockoutRiskResponse(**raw_response)
        except ValidationError as exc:
            self._log_safe(f"Stockout risk response schema validation error: {exc}", level="error")
            raise MLValidationError(f"Invalid schema in ML Engine response: {exc}") from exc

    def predict_expiry_risk(self, request: ExpiryRiskRequest) -> ExpiryRiskResponse:
        """Fetch batch expiry risk assessment from external ML Engine."""
        payload = request.model_dump()
        raw_response = self._send_request("predict/expiry-risk", payload)
        try:
            raw_response["provider"] = "real"
            raw_response["is_mock"] = False
            return ExpiryRiskResponse(**raw_response)
        except ValidationError as exc:
            self._log_safe(f"Expiry risk response schema validation error: {exc}", level="error")
            raise MLValidationError(f"Invalid schema in ML Engine response: {exc}") from exc

    def predict_redistribution_score(self, request: RedistributionScoreRequest) -> RedistributionScoreResponse:
        """Fetch redistribution scoring recommendation from external ML Engine."""
        payload = request.model_dump()
        raw_response = self._send_request("predict/redistribution-score", payload)
        try:
            raw_response["provider"] = "real"
            raw_response["is_mock"] = False
            return RedistributionScoreResponse(**raw_response)
        except ValidationError as exc:
            self._log_safe(f"Redistribution score response schema validation error: {exc}", level="error")
            raise MLValidationError(f"Invalid schema in ML Engine response: {exc}") from exc
