"""Service layer for historical consumption records and ML data preparation."""

from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from app.models import (
    ConsumptionRecord, Facility, Item, User, UserRoleEnum, District
)
from app.schemas import (
    ConsumptionCreate, ConsumptionResponse,
    ConsumptionSummaryItem, ConsumptionSummaryResponse,
    MLConsumptionDataPoint, MLInputPreparationResponse
)
from app.utils import check_facility_access, normalize_role


class ConsumptionService:
    """Service handling consumption record tracking, aggregation, and ML input preparation."""

    @staticmethod
    def _apply_rbac_filter(query, user: User, db: Session, facility_id: Optional[int] = None):
        """Apply geographic/role scoping to consumption queries."""
        user_role = normalize_role(user.role)

        if user_role == UserRoleEnum.SUPER_ADMIN:
            if facility_id:
                query = query.filter(ConsumptionRecord.facility_id == facility_id)
            return query

        if user_role == UserRoleEnum.CITIZEN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Citizens do not have access to administrative consumption data"
            )

        if user_role in (UserRoleEnum.HOSPITAL_ADMIN, UserRoleEnum.FACILITY_STAFF):
            if not user.facility_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User has no facility assigned"
                )
            if facility_id and facility_id != user.facility_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Resource belongs to another facility"
                )
            query = query.filter(ConsumptionRecord.facility_id == user.facility_id)
            return query

        if user_role == UserRoleEnum.DISTRICT_ADMIN:
            if not user.district_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User has no district assigned"
                )
            district_facility_ids = [
                f.id for f in db.query(Facility.id).filter(Facility.district_id == user.district_id).all()
            ]
            if facility_id:
                if facility_id not in district_facility_ids:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied: Facility belongs to another district"
                    )
                query = query.filter(ConsumptionRecord.facility_id == facility_id)
            else:
                query = query.filter(ConsumptionRecord.facility_id.in_(district_facility_ids))
            return query

        if user_role == UserRoleEnum.STATE_ADMIN:
            if not user.state_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User has no state assigned"
                )
            state_facility_ids = [
                f.id for f in db.query(Facility.id).join(District).filter(District.state_id == user.state_id).all()
            ]
            if facility_id:
                if facility_id not in state_facility_ids:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied: Facility belongs to another state"
                    )
                query = query.filter(ConsumptionRecord.facility_id == facility_id)
            else:
                query = query.filter(ConsumptionRecord.facility_id.in_(state_facility_ids))
            return query

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )

    @staticmethod
    def create_consumption_record(
        db: Session, user: User, data: ConsumptionCreate
    ) -> ConsumptionResponse:
        """Create a new historical consumption record."""
        # 1. Enforce RBAC & facility boundary access
        check_facility_access(user, data.facility_id, db)

        # 1.5 Validate facility existence
        facility = db.query(Facility).filter(Facility.id == data.facility_id).first()
        if not facility:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Facility with ID {data.facility_id} not found"
            )

        # 2. Validate quantity
        if data.quantity_consumed <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Quantity consumed must be greater than 0"
            )

        # 3. Validate item existence
        item = db.query(Item).filter(Item.id == data.item_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item with ID {data.item_id} not found"
            )

        # 4. Set record date default
        record_date = data.record_date or datetime.now(timezone.utc)

        # 5. Create consumption record
        record = ConsumptionRecord(
            facility_id=data.facility_id,
            item_id=data.item_id,
            quantity_consumed=data.quantity_consumed,
            record_date=record_date
        )

        db.add(record)
        db.commit()
        db.refresh(record)

        facility = db.query(Facility).filter(Facility.id == data.facility_id).first()

        resp = ConsumptionResponse.model_validate(record)
        resp.facility_name = facility.name if facility else None
        resp.item_name = item.name if item else None
        return resp

    @staticmethod
    def get_consumption_record(
        db: Session, user: User, record_id: int
    ) -> ConsumptionResponse:
        """Retrieve a specific consumption record by ID."""
        user_role = normalize_role(user.role)
        if user_role == UserRoleEnum.CITIZEN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Citizens do not have access to administrative consumption data"
            )

        record = db.query(ConsumptionRecord).filter(ConsumptionRecord.id == record_id).first()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Consumption record with ID {record_id} not found"
            )

        check_facility_access(user, record.facility_id, db)

        resp = ConsumptionResponse.model_validate(record)
        if record.facility:
            resp.facility_name = record.facility.name
        if record.item:
            resp.item_name = record.item.name
        return resp

    @classmethod
    def list_consumption_records(
        cls,
        db: Session,
        user: User,
        facility_id: Optional[int] = None,
        item_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50
    ) -> Tuple[List[ConsumptionResponse], int]:
        """List consumption records with filtering and pagination."""
        query = db.query(ConsumptionRecord)
        query = cls._apply_rbac_filter(query, user, db, facility_id=facility_id)

        if item_id:
            query = query.filter(ConsumptionRecord.item_id == item_id)
        if start_date:
            query = query.filter(ConsumptionRecord.record_date >= start_date)
        if end_date:
            query = query.filter(ConsumptionRecord.record_date <= end_date)

        total = query.count()
        records = (
            query.order_by(ConsumptionRecord.record_date.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        result = []
        for rec in records:
            resp = ConsumptionResponse.model_validate(rec)
            if rec.facility:
                resp.facility_name = rec.facility.name
            if rec.item:
                resp.item_name = rec.item.name
            result.append(resp)

        return result, total

    @classmethod
    def aggregate_consumption(
        cls,
        db: Session,
        user: User,
        facility_id: Optional[int] = None,
        item_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        period: str = "daily"
    ) -> ConsumptionSummaryResponse:
        """Aggregate consumption history by daily or weekly periods."""
        period_lower = period.lower()
        if period_lower not in ("daily", "weekly"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Period must be either 'daily' or 'weekly'"
            )

        query = db.query(ConsumptionRecord)
        query = cls._apply_rbac_filter(query, user, db, facility_id=facility_id)

        if item_id:
            query = query.filter(ConsumptionRecord.item_id == item_id)
        if start_date:
            query = query.filter(ConsumptionRecord.record_date >= start_date)
        if end_date:
            query = query.filter(ConsumptionRecord.record_date <= end_date)

        records = query.order_by(ConsumptionRecord.record_date.asc()).all()

        aggregated: Dict[str, Dict[str, Any]] = {}

        for rec in records:
            dt = rec.record_date
            if period_lower == "daily":
                key = dt.strftime("%Y-%m-%d")
                period_start = key
                period_end = key
                days_count = 1
            else:  # weekly
                # Start of week (Monday)
                start_of_week = dt.date() - timedelta(days=dt.weekday())
                end_of_week = start_of_week + timedelta(days=6)
                key = f"{start_of_week.isoformat()}_to_{end_of_week.isoformat()}"
                period_start = start_of_week.isoformat()
                period_end = end_of_week.isoformat()
                days_count = 7

            if key not in aggregated:
                aggregated[key] = {
                    "period_start": period_start,
                    "period_end": period_end,
                    "total_quantity": 0,
                    "record_count": 0,
                    "days_count": days_count
                }

            aggregated[key]["total_quantity"] += rec.quantity_consumed
            aggregated[key]["record_count"] += 1

        summary_items = []
        total_consumed = 0

        for key, val in aggregated.items():
            tot = val["total_quantity"]
            total_consumed += tot
            avg_daily = round(tot / val["days_count"], 2)

            summary_items.append(ConsumptionSummaryItem(
                period_start=val["period_start"],
                period_end=val["period_end"],
                facility_id=facility_id,
                item_id=item_id,
                total_quantity=tot,
                record_count=val["record_count"],
                average_daily=avg_daily
            ))

        return ConsumptionSummaryResponse(
            period=period_lower,
            facility_id=facility_id,
            item_id=item_id,
            total_consumed=total_consumed,
            summary=summary_items
        )

    @classmethod
    def prepare_ml_input(
        cls,
        db: Session,
        user: User,
        facility_id: Optional[int] = None,
        item_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> MLInputPreparationResponse:
        """
        Extract and format historical consumption into time-series data points
        specifically structured as input for external ML forecast engines.
        """
        query = db.query(ConsumptionRecord)
        query = cls._apply_rbac_filter(query, user, db, facility_id=facility_id)

        if item_id:
            query = query.filter(ConsumptionRecord.item_id == item_id)
        if start_date:
            query = query.filter(ConsumptionRecord.record_date >= start_date)
        if end_date:
            query = query.filter(ConsumptionRecord.record_date <= end_date)

        records = query.order_by(ConsumptionRecord.record_date.asc()).all()

        # Group by (facility_id, item_id, YYYY-MM-DD)
        daily_groups: Dict[Tuple[int, int, str], int] = {}

        for rec in records:
            ds = rec.record_date.strftime("%Y-%m-%d")
            group_key = (rec.facility_id, rec.item_id, ds)
            daily_groups[group_key] = daily_groups.get(group_key, 0) + rec.quantity_consumed

        data_points = []
        total_quantity = 0

        for (f_id, i_id, ds), qty in sorted(daily_groups.items(), key=lambda x: x[0][2]):
            data_points.append(MLConsumptionDataPoint(
                ds=ds,
                y=qty,
                facility_id=f_id,
                item_id=i_id
            ))
            total_quantity += qty

        return MLInputPreparationResponse(
            facility_id=facility_id,
            item_id=item_id,
            start_date=start_date.isoformat() if start_date else None,
            end_date=end_date.isoformat() if end_date else None,
            total_records=len(records),
            total_quantity=total_quantity,
            data_points=data_points
        )
