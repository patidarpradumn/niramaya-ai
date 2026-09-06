"""Health check response schema."""

from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(..., description="Overall status of the API (e.g. 'ok', 'degraded')")
    environment: str = Field(..., description="Application environment")
    version: str = Field(..., description="API Version")
    database: Dict[str, Any] = Field(..., description="Database connection status details")
    details: Optional[Dict[str, Any]] = None
