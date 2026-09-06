"""API routers package."""

from app.routers import auth, users, facilities, inventory, alerts, predictions, ai, dashboard, recommendations, equipment, maintenance, audit_logs

__all__ = ["auth", "users", "facilities", "inventory", "alerts", "predictions", "ai", "dashboard", "recommendations", "equipment", "maintenance", "audit_logs"]