"""API v1 router composition."""

from fastapi import APIRouter
from app.api.v1.endpoints import health, auth
from app.routers import (
    facilities,
    items,
    inventory,
    stock_movements,
    consumption,
    alerts,
    predictions,
    dashboard,
    ai,
    users,
    recommendations,
    equipment,
    maintenance,
    audit_logs,
    public,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health Check"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(public.router, prefix="/public", tags=["Public APIs"])
api_router.include_router(facilities.router)
api_router.include_router(items.router)
api_router.include_router(inventory.router)
api_router.include_router(stock_movements.router)
api_router.include_router(consumption.router)
api_router.include_router(alerts.router)
api_router.include_router(predictions.router)
api_router.include_router(dashboard.router)
api_router.include_router(ai.router)
api_router.include_router(users.router)
api_router.include_router(recommendations.router)
api_router.include_router(equipment.router)
api_router.include_router(maintenance.router)
api_router.include_router(audit_logs.router)



