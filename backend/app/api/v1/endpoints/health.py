"""Health check endpoint implementation."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import get_db
from app.core.config import settings
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, status_code=status.HTTP_200_OK)
def check_health(db: Session = Depends(get_db)) -> HealthResponse:
    """
    Health check endpoint.
    Verifies API status and database connectivity.
    """
    db_connected = False
    db_error = None

    try:
        db.execute(text("SELECT 1"))
        db_connected = True
    except Exception as e:
        db_error = str(e)

    overall_status = "ok" if db_connected else "degraded"

    return HealthResponse(
        status=overall_status,
        environment=settings.ENVIRONMENT,
        version="1.0.0",
        database={
            "connected": db_connected,
            "error": db_error,
        },
    )
