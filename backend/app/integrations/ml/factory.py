"""ML Provider Factory for selecting mock vs real provider implementation."""

from typing import Optional
from app.config import settings
from app.integrations.ml.base import MLProvider
from app.integrations.ml.mock_provider import MockMLProvider
from app.integrations.ml.real_provider import RealMLProvider

def get_ml_provider(provider_type: Optional[str] = None) -> MLProvider:
    """
    Factory function returning MLProvider instance based on configuration or explicit parameter.
    
    Priority order:
    1. Explicit provider_type parameter ('mock' or 'real')
    2. settings.ML_PROVIDER_TYPE ('mock' or 'real')
    3. Fallback to settings.ML_ENGINE_MOCK boolean toggle
    """
    if provider_type:
        p_type = provider_type.lower()
    elif hasattr(settings, "ML_PROVIDER_TYPE") and settings.ML_PROVIDER_TYPE:
        p_type = settings.ML_PROVIDER_TYPE.lower()
    elif settings.ML_ENGINE_MOCK:
        p_type = "mock"
    else:
        p_type = "real"

    if p_type == "real":
        return RealMLProvider()
    return MockMLProvider()
