"""Alerts API routes for Risk + Alert processing."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from app.database import get_db
from app.models import (
    User, Alert, Facility, District, AlertSeverity, AlertSeverityEnum, UserRoleEnum,
    RiskCategoryEnum, AlertStatusEnum
)
from app.schemas import AlertResponse, AlertCreate, AlertUpdate, AlertAcknowledge
from app.utils import get_current_user, require_roles, check_facility_access, normalize_role
from app.services.alert_service import alert_service

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("", response_model=List[AlertResponse])
@router.get("/", response_model=List[AlertResponse])
def list_alerts(
    facility_id: Optional[int] = None,
    item_id: Optional[int] = None,
    risk_category: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    acknowledged: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List alerts with optional filters and RBAC boundary checks."""
    user_role = normalize_role(current_user.role)

    if user_role == UserRoleEnum.CITIZEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizens do not have access to administrative alert data"
        )

    query = db.query(Alert)

    if facility_id:
        facility = db.query(Facility).filter(Facility.id == facility_id).first()
        if not facility:
            raise HTTPException(status_code=404, detail="Facility not found")
        check_facility_access(current_user, facility, db)
        query = query.filter(Alert.facility_id == facility_id)
    else:
        if user_role == UserRoleEnum.SUPER_ADMIN:
            pass
        elif user_role == UserRoleEnum.STATE_ADMIN:
            if current_user.state_id:
                query = query.join(Facility).join(District).filter(District.state_id == current_user.state_id)
            else:
                return []
        elif user_role == UserRoleEnum.DISTRICT_ADMIN:
            if current_user.district_id:
                query = query.join(Facility).filter(Facility.district_id == current_user.district_id)
            else:
                return []
        elif user_role in (UserRoleEnum.HOSPITAL_ADMIN, UserRoleEnum.FACILITY_STAFF):
            if current_user.facility_id:
                query = query.filter(Alert.facility_id == current_user.facility_id)
            else:
                return []

    if item_id:
        query = query.filter(Alert.item_id == item_id)

    if risk_category:
        cat_upper = risk_category.upper()
        for cat in RiskCategoryEnum:
            if cat.value == cat_upper or cat.name == cat_upper:
                query = query.filter(Alert.risk_category == cat)
                break
        else:
            query = query.filter(Alert.risk_category == risk_category)

    if severity:
        sev_lower = severity.lower()
        for sev in AlertSeverityEnum:
            if sev.value == sev_lower or sev.name.lower() == sev_lower:
                query = query.filter(Alert.severity == sev)
                break
        else:
            query = query.filter(Alert.severity == severity)

    if status_filter:
        st_upper = status_filter.upper()
        for st in AlertStatusEnum:
            if st.value == st_upper or st.name == st_upper:
                query = query.filter(Alert.status == st)
                break
        else:
            query = query.filter(Alert.status == status_filter)

    if acknowledged is not None:
        query = query.filter(Alert.acknowledged == (True if acknowledged else False))

    alerts = query.order_by(Alert.created_at.desc()).offset(skip).limit(limit).all()
    return alerts


@router.get("/{alert_id}", response_model=AlertResponse)
def get_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get alert by ID with boundary checks."""
    user_role = normalize_role(current_user.role)
    if user_role == UserRoleEnum.CITIZEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizens do not have access to administrative alert data"
        )

    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    facility = db.query(Facility).filter(Facility.id == alert.facility_id).first()
    if facility:
        check_facility_access(current_user, facility, db)

    return alert


@router.post("", response_model=AlertResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=AlertResponse, status_code=status.HTTP_201_CREATED)
def create_alert(
    request: AlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRoleEnum.SUPER_ADMIN, UserRoleEnum.STATE_ADMIN, UserRoleEnum.DISTRICT_ADMIN,
        UserRoleEnum.HOSPITAL_ADMIN, UserRoleEnum.FACILITY_STAFF
    ))
):
    """Create a new alert with RBAC boundary check."""
    facility = db.query(Facility).filter(Facility.id == request.facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")

    check_facility_access(current_user, facility, db)

    alert = Alert(
        facility_id=request.facility_id,
        item_id=request.item_id,
        prediction_id=request.prediction_id,
        risk_id=request.risk_id,
        risk_category=request.risk_category or RiskCategoryEnum.STOCK_OUT,
        severity=request.severity,
        status=AlertStatusEnum.ACTIVE,
        title=request.title,
        description=request.description,
        details=request.details or {},
        acknowledged=False
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.patch("/{alert_id}", response_model=AlertResponse)
def update_alert(
    alert_id: int,
    request: AlertUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRoleEnum.SUPER_ADMIN, UserRoleEnum.STATE_ADMIN, UserRoleEnum.DISTRICT_ADMIN,
        UserRoleEnum.HOSPITAL_ADMIN, UserRoleEnum.FACILITY_STAFF
    ))
):
    """Update alert status, severity, or resolution notes."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    facility = db.query(Facility).filter(Facility.id == alert.facility_id).first()
    if facility:
        check_facility_access(current_user, facility, db)

    updated_alert = alert_service.update_alert(
        db=db,
        alert_id=alert_id,
        user_id=current_user.id,
        status=request.status,
        severity=request.severity,
        resolution_notes=request.resolution_notes
    )
    return updated_alert


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
@router.put("/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(
    alert_id: int,
    payload: Optional[AlertAcknowledge] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRoleEnum.SUPER_ADMIN, UserRoleEnum.STATE_ADMIN, UserRoleEnum.DISTRICT_ADMIN,
        UserRoleEnum.HOSPITAL_ADMIN, UserRoleEnum.FACILITY_STAFF
    ))
):
    """Acknowledge an alert with boundary check."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    facility = db.query(Facility).filter(Facility.id == alert.facility_id).first()
    if facility:
        check_facility_access(current_user, facility, db)

    acknowledged_alert = alert_service.acknowledge_alert(
        db=db,
        alert_id=alert_id,
        user_id=current_user.id
    )
    return acknowledged_alert


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRoleEnum.SUPER_ADMIN, UserRoleEnum.STATE_ADMIN, UserRoleEnum.DISTRICT_ADMIN, UserRoleEnum.HOSPITAL_ADMIN
    ))
):
    """Delete an alert with boundary check."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    facility = db.query(Facility).filter(Facility.id == alert.facility_id).first()
    if facility:
        check_facility_access(current_user, facility, db)

    db.delete(alert)
    db.commit()
    return None