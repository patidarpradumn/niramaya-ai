"""Service layer for Risk assessment, Alert generation, threshold evaluation, and management."""

import json
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.models import (
    Alert, Risk, Facility, Item, Prediction, User,
    AlertSeverityEnum, RiskCategoryEnum, AlertStatusEnum, RiskStatusEnum
)
from app.config import settings


class AlertService:
    """Service handling risk evaluation, alert creation, duplicate prevention, and lifecycle management."""

    @staticmethod
    def calculate_stockout_severity(days_to_shortage: float) -> AlertSeverityEnum:
        """Calculate alert severity based on estimated days to stock-out shortage."""
        if days_to_shortage <= settings.ALERT_STOCKOUT_CRITICAL_DAYS:
            return AlertSeverityEnum.CRITICAL
        elif days_to_shortage <= settings.ALERT_STOCKOUT_HIGH_DAYS:
            return AlertSeverityEnum.HIGH
        elif days_to_shortage <= settings.ALERT_STOCKOUT_MEDIUM_DAYS:
            return AlertSeverityEnum.MEDIUM
        return AlertSeverityEnum.LOW

    @staticmethod
    def calculate_expiry_severity(days_to_expiry: int) -> AlertSeverityEnum:
        """Calculate alert severity based on days remaining until batch expiry."""
        if days_to_expiry <= settings.ALERT_EXPIRY_CRITICAL_DAYS:
            return AlertSeverityEnum.CRITICAL
        elif days_to_expiry <= settings.ALERT_EXPIRY_HIGH_DAYS:
            return AlertSeverityEnum.HIGH
        elif days_to_expiry <= settings.ALERT_EXPIRY_MEDIUM_DAYS:
            return AlertSeverityEnum.MEDIUM
        return AlertSeverityEnum.LOW

    @staticmethod
    def is_duplicate_active_alert(
        db: Session,
        facility_id: int,
        item_id: Optional[int],
        risk_category: RiskCategoryEnum
    ) -> bool:
        """Check if an active alert for the same facility, item, and category exists within the duplicate window."""
        window_start = datetime.now(timezone.utc) - timedelta(hours=settings.ALERT_DUPLICATE_WINDOW_HOURS)
        
        query = db.query(Alert).filter(
            Alert.facility_id == facility_id,
            Alert.risk_category == risk_category,
            Alert.status == AlertStatusEnum.ACTIVE,
            Alert.created_at >= window_start
        )
        if item_id is not None:
            query = query.filter(Alert.item_id == item_id)
        
        return query.first() is not None

    def create_stockout_alert(
        self,
        db: Session,
        facility_id: int,
        item_id: int,
        current_stock: int,
        predicted_demand: int,
        estimated_days_to_shortage: float,
        prediction_id: Optional[int] = None
    ) -> Optional[Alert]:
        """Create stock-out risk and alert record with required details."""
        facility = db.query(Facility).filter(Facility.id == facility_id).first()
        item = db.query(Item).filter(Item.id == item_id).first()
        if not facility or not item:
            raise ValueError("Invalid facility_id or item_id")

        if self.is_duplicate_active_alert(db, facility_id, item_id, RiskCategoryEnum.STOCK_OUT):
            return None  # Prevent duplicate active alert

        severity = self.calculate_stockout_severity(estimated_days_to_shortage)

        # Create Risk record
        risk = Risk(
            facility_id=facility_id,
            item_id=item_id,
            prediction_id=prediction_id,
            risk_type="STOCK_OUT",
            severity=severity,
            description=f"Stock-out predicted for {item.name} at {facility.name} within {estimated_days_to_shortage:.1f} days.",
            status=RiskStatusEnum.ACTIVE
        )
        db.add(risk)
        db.commit()
        db.refresh(risk)

        # Build stock-out metadata details
        details = {
            "current_stock": current_stock,
            "estimated_days_to_shortage": round(estimated_days_to_shortage, 1),
            "predicted_demand": predicted_demand,
            "risk_level": severity.value.upper()
        }

        # Create Alert record
        alert = Alert(
            facility_id=facility_id,
            item_id=item_id,
            prediction_id=prediction_id,
            risk_id=risk.id,
            risk_category=RiskCategoryEnum.STOCK_OUT,
            severity=severity,
            status=AlertStatusEnum.ACTIVE,
            title=f"Stock-Out Warning: {item.name}",
            description=f"{facility.name} has {current_stock} units remaining. Shortage anticipated in {estimated_days_to_shortage:.1f} days.",
            details=details,
            acknowledged=False
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        return alert

    def create_expiry_alert(
        self,
        db: Session,
        facility_id: int,
        item_id: int,
        quantity: int,
        expiry_date: datetime,
        expected_consumption_context: Optional[str] = None,
        batch_number: Optional[str] = None
    ) -> Optional[Alert]:
        """Create batch expiry risk and alert record with required details."""
        facility = db.query(Facility).filter(Facility.id == facility_id).first()
        item = db.query(Item).filter(Item.id == item_id).first()
        if not facility or not item:
            raise ValueError("Invalid facility_id or item_id")

        if self.is_duplicate_active_alert(db, facility_id, item_id, RiskCategoryEnum.EXPIRY):
            return None  # Prevent duplicate active alert

        now = datetime.now(timezone.utc)
        if expiry_date.tzinfo is None:
            expiry_date = expiry_date.replace(tzinfo=timezone.utc)
        days_to_expiry = max(0, (expiry_date - now).days)

        severity = self.calculate_expiry_severity(days_to_expiry)

        # Create Risk record
        risk = Risk(
            facility_id=facility_id,
            item_id=item_id,
            risk_type="EXPIRY",
            severity=severity,
            description=f"Expiry risk for {quantity} units of {item.name} at {facility.name} on {expiry_date.strftime('%Y-%m-%d')}.",
            status=RiskStatusEnum.ACTIVE
        )
        db.add(risk)
        db.commit()
        db.refresh(risk)

        # Build expiry metadata details
        details = {
            "quantity": quantity,
            "expiry_date": expiry_date.strftime('%Y-%m-%d'),
            "expected_consumption_context": expected_consumption_context or "Average consumption pattern",
            "batch_number": batch_number or "N/A",
            "days_to_expiry": days_to_expiry
        }

        # Create Alert record
        alert = Alert(
            facility_id=facility_id,
            item_id=item_id,
            risk_id=risk.id,
            risk_category=RiskCategoryEnum.EXPIRY,
            severity=severity,
            status=AlertStatusEnum.ACTIVE,
            title=f"Expiry Warning: {item.name}",
            description=f"{quantity} units of {item.name} (Batch {batch_number or 'N/A'}) expiring on {expiry_date.strftime('%Y-%m-%d')} at {facility.name}.",
            details=details,
            acknowledged=False
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        return alert

    def create_operational_alert(
        self,
        db: Session,
        facility_id: int,
        risk_category: RiskCategoryEnum,
        severity: AlertSeverityEnum,
        title: str,
        description: str,
        item_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> Alert:
        """Create manual or operational alert (EQUIPMENT, RESOURCE, etc.)."""
        facility = db.query(Facility).filter(Facility.id == facility_id).first()
        if not facility:
            raise ValueError("Invalid facility_id")

        if item_id:
            item = db.query(Item).filter(Item.id == item_id).first()
            if not item:
                raise ValueError("Invalid item_id")

        alert = Alert(
            facility_id=facility_id,
            item_id=item_id,
            risk_category=risk_category,
            severity=severity,
            status=AlertStatusEnum.ACTIVE,
            title=title,
            description=description,
            details=details or {},
            acknowledged=False
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        return alert

    def acknowledge_alert(self, db: Session, alert_id: int, user_id: int) -> Alert:
        """Mark alert as ACKNOWLEDGED."""
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            raise ValueError("Alert not found")

        alert.status = AlertStatusEnum.ACKNOWLEDGED
        alert.acknowledged = True
        alert.acknowledged_at = datetime.now(timezone.utc)
        alert.acknowledged_by = user_id
        db.commit()
        db.refresh(alert)
        return alert

    def resolve_alert(
        self,
        db: Session,
        alert_id: int,
        user_id: int,
        resolution_notes: Optional[str] = None
    ) -> Alert:
        """Mark alert as RESOLVED."""
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            raise ValueError("Alert not found")

        alert.status = AlertStatusEnum.RESOLVED
        alert.resolved_at = datetime.now(timezone.utc)
        alert.resolved_by = user_id
        if resolution_notes:
            alert.resolution_notes = resolution_notes
        db.commit()
        db.refresh(alert)
        return alert

    def update_alert(
        self,
        db: Session,
        alert_id: int,
        user_id: int,
        status: Optional[AlertStatusEnum] = None,
        severity: Optional[AlertSeverityEnum] = None,
        resolution_notes: Optional[str] = None
    ) -> Alert:
        """Update status, severity, or resolution notes of an alert."""
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            raise ValueError("Alert not found")

        if severity:
            alert.severity = severity

        if status:
            alert.status = status
            if status == AlertStatusEnum.ACKNOWLEDGED and not alert.acknowledged:
                alert.acknowledged = True
                alert.acknowledged_at = datetime.now(timezone.utc)
                alert.acknowledged_by = user_id
            elif status == AlertStatusEnum.RESOLVED:
                alert.resolved_at = datetime.now(timezone.utc)
                alert.resolved_by = user_id

        if resolution_notes:
            alert.resolution_notes = resolution_notes

        db.commit()
        db.refresh(alert)
        return alert


alert_service = AlertService()
