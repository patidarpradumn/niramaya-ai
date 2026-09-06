"""Service layer for Audit Logging."""

import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models import AuditLog, User

logger = logging.getLogger("mediguard.audit_service")

# Sensitive fields to sanitize/redact
SENSITIVE_KEYS = {
    "password", "password_hash", "hashed_password", "current_password", "new_password",
    "token", "access_token", "refresh_token", "secret", "api_key", "authorization", "bearer"
}


def sanitize_metadata(data: Any) -> Any:
    """Recursively sanitize sensitive key-value pairs in metadata/details."""
    if isinstance(data, dict):
        cleaned = {}
        for key, value in data.items():
            if key.lower() in SENSITIVE_KEYS:
                cleaned[key] = "[REDACTED]"
            else:
                cleaned[key] = sanitize_metadata(value)
        return cleaned
    elif isinstance(data, list):
        return [sanitize_metadata(item) for item in data]
    return data


class AuditService:
    """Service handling audit logging creation, sanitization, and querying."""

    @staticmethod
    def create_log(
        db: Session,
        action: str,
        user_id: Optional[int] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        details: Optional[str | Dict[str, Any]] = None,
        correlation_id: Optional[str] = None,
    ) -> AuditLog:
        """Create and persist an immutable audit log record with sanitized metadata."""
        details_str = None
        if isinstance(details, (dict, list)):
            sanitized = sanitize_metadata(details)
            details_str = json.dumps(sanitized)
        elif isinstance(details, str):
            try:
                parsed = json.loads(details)
                sanitized = sanitize_metadata(parsed)
                details_str = json.dumps(sanitized)
            except (json.JSONDecodeError, TypeError):
                details_str = details
        elif details is not None:
            details_str = str(details)

        audit_log = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details_str,
            correlation_id=correlation_id,
        )
        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)
        return audit_log

    @staticmethod
    def get_audit_logs(
        db: Session,
        user_id: Optional[int] = None,
        action: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        correlation_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[AuditLog]:
        """Retrieve audit logs with administrative filtering."""
        query = db.query(AuditLog)

        if user_id is not None:
            query = query.filter(AuditLog.user_id == user_id)
        if action:
            query = query.filter(AuditLog.action.ilike(f"%{action}%"))
        if entity_type:
            query = query.filter(AuditLog.entity_type.ilike(f"%{entity_type}%"))
        if entity_id is not None:
            query = query.filter(AuditLog.entity_id == entity_id)
        if correlation_id:
            query = query.filter(AuditLog.correlation_id == correlation_id)
        if start_date:
            query = query.filter(AuditLog.created_at >= start_date)
        if end_date:
            query = query.filter(AuditLog.created_at <= end_date)
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    AuditLog.action.ilike(search_pattern),
                    AuditLog.entity_type.ilike(search_pattern),
                    AuditLog.details.ilike(search_pattern),
                    AuditLog.correlation_id.ilike(search_pattern)
                )
            )

        return query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def get_audit_log_count(
        db: Session,
        user_id: Optional[int] = None,
        action: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        correlation_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        search: Optional[str] = None,
    ) -> int:
        """Get total count of audit logs matching filters."""
        query = db.query(AuditLog)

        if user_id is not None:
            query = query.filter(AuditLog.user_id == user_id)
        if action:
            query = query.filter(AuditLog.action.ilike(f"%{action}%"))
        if entity_type:
            query = query.filter(AuditLog.entity_type.ilike(f"%{entity_type}%"))
        if entity_id is not None:
            query = query.filter(AuditLog.entity_id == entity_id)
        if correlation_id:
            query = query.filter(AuditLog.correlation_id == correlation_id)
        if start_date:
            query = query.filter(AuditLog.created_at >= start_date)
        if end_date:
            query = query.filter(AuditLog.created_at <= end_date)
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    AuditLog.action.ilike(search_pattern),
                    AuditLog.entity_type.ilike(search_pattern),
                    AuditLog.details.ilike(search_pattern),
                    AuditLog.correlation_id.ilike(search_pattern)
                )
            )

        return query.count()

    @staticmethod
    def get_audit_log_by_id(db: Session, log_id: int) -> Optional[AuditLog]:
        """Get single audit log entry by ID."""
        return db.query(AuditLog).filter(AuditLog.id == log_id).first()


audit_service = AuditService()
