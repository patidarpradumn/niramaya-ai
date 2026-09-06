"""API routers package."""

from app.routers import (
    users,
    facilities,
    items,
    inventory,
    stock_movements,
    consumption,
    alerts,
    predictions,
    ai,
    dashboard,
    recommendations,
    equipment,
    maintenance,
    audit_logs,
    public,
)

__all__ = [
    "users",
    "facilities",
    "items",
    "inventory",
    "stock_movements",
    "consumption",
    "alerts",
    "predictions",
    "ai",
    "dashboard",
    "recommendations",
    "equipment",
    "maintenance",
    "audit_logs",
    "public",
]