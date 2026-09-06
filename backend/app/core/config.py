"""Application configuration using Pydantic Settings."""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "MediGuard AI"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "sqlite:///./mediguard.db"

    # JWT Authentication Settings (For future phases)
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Firebase Authentication
    FIREBASE_PROJECT_ID: str = "niramaya-ai-dev"
    FIREBASE_CREDENTIALS_PATH: str = "./firebase-credentials.json"


    # External Integrations
    GEMINI_API_KEY: str = ""
    ML_ENGINE_URL: str = "http://localhost:8001"

    # CORS Configuration
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        if not self.CORS_ORIGINS:
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )


settings = Settings()
