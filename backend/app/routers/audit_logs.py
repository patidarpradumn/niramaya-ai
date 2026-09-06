"""Audit Logs API Router."""

from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserRoleEnum, AuditLog
from app.schemas import AuditLogResponse, PaginatedAuditLogResponse
from app.services.audit_service import audit_service
from app.utils import get_current_user, require_roles

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])

# Allowed administrative roles for viewing audit logs
ADMIN_ROLES = [UserRoleEnum.SUPER_ADMIN, UserRoleEnum.STATE_ADMIN, UserRoleEnum.DISTRICT_ADMIN]


@router.get("", response_model=PaginatedAuditLogResponse)
def list_audit_logs(
    user_id: Optional[int] = Query(None, description="Filter by actor/user ID"),
    action: Optional[str] = Query(None, description="Filter by action name"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type (e.g. equipment, inventory, transfer)"),
    entity_id: Optional[int] = Query(None, description="Filter by target entity ID"),
    correlation_id: Optional[str] = Query(None, description="Filter by request correlation ID"),
    start_date: Optional[datetime] = Query(None, description="Filter logs created on or after start timestamp"),
    end_date: Optional[datetime] = Query(None, description="Filter logs created on or before end timestamp"),
    search: Optional[str] = Query(None, description="Free text search across action, entity_type, details, correlation_id"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    """List system audit logs with administrative filtering."""
    total = audit_service.get_audit_log_count(
        db=db,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        correlation_id=correlation_id,
        start_date=start_date,
        end_date=end_date,
        search=search
    )

    logs = audit_service.get_audit_logs(
        db=db,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        correlation_id=correlation_id,
        start_date=start_date,
        end_date=end_date,
        search=search,
        skip=skip,
        limit=limit
    )

    # Format response items
    items = []
    for log in logs:
        user_email = log.user.email if log.user else None
        item = AuditLogResponse(
            id=log.id,
            user_id=log.user_id,
            user_email=user_email,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            details=log.details,
            correlation_id=log.correlation_id,
            created_at=log.created_at
        )
        items.append(item)

    pages = (total + limit - 1) // limit if total > 0 else 0
    page = (skip // limit) + 1 if limit > 0 else 1

    return PaginatedAuditLogResponse(
        items=items,
        total=total,
        page=page,
        size=limit,
        pages=pages
    )


@router.get("/{id}", response_model=AuditLogResponse)
def get_audit_log_by_id(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    """Get single audit log entry by ID."""
    log = audit_service.get_audit_log_by_id(db=db, log_id=id)
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audit log with ID {id} not found."
        )

    user_email = log.user.email if log.user else None
    return AuditLogResponse(
        id=log.id,
        user_id=log.user_id,
        user_email=user_email,
        action=log.action,
        entity_type=log.entity_type,
        entity_id=log.entity_id,
        details=log.details,
        correlation_id=log.correlation_id,
        created_at=log.created_at
    )
