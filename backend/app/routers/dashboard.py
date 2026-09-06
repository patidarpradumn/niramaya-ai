"""Dashboard API routes for KPI and summary data."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from datetime import datetime, timedelta, date, timezone
from typing import List, Optional

from app.database import get_db
from app.models import User, Facility, Inventory, Alert, Prediction, District, UserRoleEnum, AlertSeverity, StockLevel, ConsumptionRecord, Item
from app.schemas import (
    DashboardSummary, DashboardKPIs, RecentAlert, 
    DashboardTrendsResponse, TrendDataPoint, 
    DashboardStockRisk, DashboardExpiryRisk
)
from app.utils import get_current_user, normalize_role

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

def _get_scoped_facility_ids(db: Session, current_user: User) -> List[int]:
    user_role = normalize_role(current_user.role)
    if user_role == UserRoleEnum.CITIZEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizens do not have access to administrative dashboard data"
        )

    facility_query = db.query(Facility.id)
    if user_role == UserRoleEnum.SUPER_ADMIN:
        pass
    elif user_role == UserRoleEnum.STATE_ADMIN:
        if current_user.state_id:
            facility_query = facility_query.join(District, Facility.district_id == District.id).filter(District.state_id == current_user.state_id)
        else:
            facility_query = facility_query.filter(Facility.id == -1)
    elif user_role == UserRoleEnum.DISTRICT_ADMIN:
        if current_user.district_id:
            facility_query = facility_query.filter(Facility.district_id == current_user.district_id)
        else:
            facility_query = facility_query.filter(Facility.id == -1)
    elif user_role in (UserRoleEnum.HOSPITAL_ADMIN, UserRoleEnum.FACILITY_STAFF):
        if current_user.facility_id:
            facility_query = facility_query.filter(Facility.id == current_user.facility_id)
        else:
            facility_query = facility_query.filter(Facility.id == -1)
            
    return [f[0] for f in facility_query.all()]

@router.get("/", response_model=DashboardSummary, include_in_schema=False)
@router.get("/overview", response_model=DashboardSummary)
def get_dashboard_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get dashboard summary with KPIs and recent alerts scoped by user role and hierarchy."""
    scoped_facility_ids = _get_scoped_facility_ids(db, current_user)
    total_facilities = len(scoped_facility_ids)

    if scoped_facility_ids:
        total_items = db.query(Inventory).filter(Inventory.facility_id.in_(scoped_facility_ids)).count()
        critical_alerts = db.query(Alert).filter(
            Alert.facility_id.in_(scoped_facility_ids),
            Alert.severity == AlertSeverity.CRITICAL,
            Alert.acknowledged == 0
        ).count()
        low_stock_items = db.query(Inventory).filter(
            Inventory.facility_id.in_(scoped_facility_ids),
            Inventory.current_stock <= Inventory.min_threshold
        ).count()
        predicted_demand_count = db.query(Prediction).filter(
            Prediction.facility_id.in_(scoped_facility_ids)
        ).count()
    else:
        total_items = 0
        critical_alerts = 0
        low_stock_items = 0
        predicted_demand_count = 0

    kpis = DashboardKPIs(
        total_facilities=total_facilities,
        total_items=total_items,
        critical_alerts=critical_alerts,
        low_stock_items=low_stock_items,
        predicted_demand_count=predicted_demand_count
    )

    recent_alerts = []
    if scoped_facility_ids:
        alert_query = (
            db.query(Alert, Facility.name)
            .join(Facility, Alert.facility_id == Facility.id)
            .filter(Alert.facility_id.in_(scoped_facility_ids))
            .order_by(Alert.created_at.desc())
            .limit(10)
        )
        for alert, facility_name in alert_query.all():
            recent_alerts.append(RecentAlert(
                id=alert.id,
                severity=alert.severity,
                title=alert.title,
                facility_name=facility_name,
                created_at=alert.created_at
            ))

    if scoped_facility_ids:
        stock_summary = {
            "critical": db.query(Inventory).filter(
                Inventory.facility_id.in_(scoped_facility_ids),
                Inventory.current_stock <= Inventory.min_threshold * 0.5
            ).count(),
            "low": db.query(Inventory).filter(
                Inventory.facility_id.in_(scoped_facility_ids),
                Inventory.current_stock <= Inventory.min_threshold,
                Inventory.current_stock > Inventory.min_threshold * 0.5
            ).count(),
            "adequate": db.query(Inventory).filter(
                Inventory.facility_id.in_(scoped_facility_ids),
                Inventory.current_stock > Inventory.min_threshold,
                Inventory.current_stock < Inventory.max_threshold
            ).count(),
            "overstocked": db.query(Inventory).filter(
                Inventory.facility_id.in_(scoped_facility_ids),
                Inventory.current_stock >= Inventory.max_threshold
            ).count()
        }
    else:
        stock_summary = {"critical": 0, "low": 0, "adequate": 0, "overstocked": 0}

    return DashboardSummary(
        kpis=kpis,
        recent_alerts=recent_alerts,
        stock_summary=stock_summary
    )


@router.get("/trends", response_model=DashboardTrendsResponse)
def get_dashboard_trends(
    days: int = Query(30, ge=7, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get trends for consumption and alerts over the specified number of days."""
    scoped_facility_ids = _get_scoped_facility_ids(db, current_user)
    
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    consumption_trend = []
    alert_trend = []
    
    if scoped_facility_ids:
        # Group consumption by date
        consumption_data = db.query(
            func.date(ConsumptionRecord.record_date).label('date'),
            func.sum(ConsumptionRecord.quantity_consumed).label('value')
        ).filter(
            ConsumptionRecord.facility_id.in_(scoped_facility_ids),
            ConsumptionRecord.record_date >= cutoff_date
        ).group_by(func.date(ConsumptionRecord.record_date)).order_by('date').all()
        
        consumption_trend = [
            TrendDataPoint(date=str(row.date), value=float(row.value or 0))
            for row in consumption_data
        ]
        
        # Group alerts by date
        alert_data = db.query(
            func.date(Alert.created_at).label('date'),
            func.count(Alert.id).label('value')
        ).filter(
            Alert.facility_id.in_(scoped_facility_ids),
            Alert.created_at >= cutoff_date
        ).group_by(func.date(Alert.created_at)).order_by('date').all()
        
        alert_trend = [
            TrendDataPoint(date=str(row.date), value=float(row.value or 0))
            for row in alert_data
        ]
        
    return DashboardTrendsResponse(
        consumption_trend=consumption_trend,
        alert_trend=alert_trend
    )


@router.get("/stock-risks", response_model=List[DashboardStockRisk])
def get_dashboard_stock_risks(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get items at high risk of stock-out based on current stock vs minimum threshold."""
    scoped_facility_ids = _get_scoped_facility_ids(db, current_user)
    
    risks = []
    if scoped_facility_ids:
        query = (
            db.query(Inventory, Item.name.label("item_name"), Facility.name.label("facility_name"))
            .join(Item, Inventory.item_id == Item.id)
            .join(Facility, Inventory.facility_id == Facility.id)
            .filter(
                Inventory.facility_id.in_(scoped_facility_ids),
                Inventory.current_stock <= Inventory.min_threshold
            )
            .order_by((Inventory.current_stock * 1.0 / Inventory.min_threshold).asc())
            .limit(limit)
        )
        
        for inv, item_name, facility_name in query.all():
            status = "critical" if inv.current_stock <= (inv.min_threshold * 0.5) else "low"
            if inv.current_stock == 0:
                status = "stock-out"
                
            risks.append(DashboardStockRisk(
                inventory_id=inv.id,
                item_name=item_name,
                facility_name=facility_name,
                current_stock=inv.current_stock,
                min_threshold=inv.min_threshold,
                status=status
            ))
            
    return risks


@router.get("/expiry-risks", response_model=List[DashboardExpiryRisk])
def get_dashboard_expiry_risks(
    days: int = Query(90, ge=1, le=365),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get items at high risk of expiry within the specified timeframe."""
    scoped_facility_ids = _get_scoped_facility_ids(db, current_user)
    
    risks = []
    if scoped_facility_ids:
        cutoff_date = datetime.now(timezone.utc) + timedelta(days=days)
        
        query = (
            db.query(Inventory, Item.name.label("item_name"), Facility.name.label("facility_name"))
            .join(Item, Inventory.item_id == Item.id)
            .join(Facility, Inventory.facility_id == Facility.id)
            .filter(
                Inventory.facility_id.in_(scoped_facility_ids),
                Inventory.expiry_date != None,
                Inventory.expiry_date <= cutoff_date,
                Inventory.current_stock > 0
            )
            .order_by(Inventory.expiry_date.asc())
            .limit(limit)
        )
        
        now = datetime.now(timezone.utc).date()
        for inv, item_name, facility_name in query.all():
            # Calculate days to expiry
            days_to_expiry = (inv.expiry_date.date() - now).days if isinstance(inv.expiry_date, datetime) else (inv.expiry_date - now).days
            
            risks.append(DashboardExpiryRisk(
                inventory_id=inv.id,
                item_name=item_name,
                facility_name=facility_name,
                quantity=inv.current_stock,
                expiry_date=inv.expiry_date,
                days_to_expiry=max(0, days_to_expiry)
            ))
            
    return risks