"""Backend configuration using pydantic-settings."""

from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Allow extra variables from .env without causing validation errors.
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    # Application
    PROJECT_NAME: str = "MediGuard AI"
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "sqlite:///./mediguard.db"

    # JWT Authentication
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Firebase Authentication
    FIREBASE_PROJECT_ID: str = "niramaya-ai-dev"
    FIREBASE_CREDENTIALS_PATH: str = "./firebase-credentials.json"

    # Google Gemini API
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"
    GEMINI_TIMEOUT: float = 10.0
    GEMINI_MOCK: bool = True

    # ML Engine
    ML_ENGINE_BASE_URL: str = "http://localhost:8001"
    ML_ENGINE_URL: str = "http://localhost:8001"
    ML_ENGINE_TIMEOUT: float = 5.0
    ML_ENGINE_API_KEY: str = ""
    ML_PROVIDER_TYPE: str = "mock"
    ML_ENGINE_MOCK: bool = True

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Risk & Alert Thresholds
    ALERT_STOCKOUT_CRITICAL_DAYS: float = 3.0
    ALERT_STOCKOUT_HIGH_DAYS: float = 7.0
    ALERT_STOCKOUT_MEDIUM_DAYS: float = 14.0

    ALERT_EXPIRY_CRITICAL_DAYS: int = 7
    ALERT_EXPIRY_HIGH_DAYS: int = 30
    ALERT_EXPIRY_MEDIUM_DAYS: int = 60

    ALERT_DUPLICATE_WINDOW_HOURS: int = 24

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


settings = Settings()
