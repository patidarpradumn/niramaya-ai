"""Service layer for Cross-Facility Redistribution Recommendations, Approval Workflows, and Transfers."""

import math
from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.models import (
    Recommendation, Transfer, ApprovalAction, AuditLog, Inventory, Item, Facility, User,
    UserRoleEnum, RecommendationStatusEnum, TransferStatusEnum, StockMovement,
    StockMovementTypeEnum
)
from app.schemas import (
    RecommendationCreate, RecommendationModify, RecommendationApprove, RecommendationReject
)
from app.utils import check_facility_access


def calculate_haversine_distance(
    lat1: Optional[float], lon1: Optional[float],
    lat2: Optional[float], lon2: Optional[float]
) -> float:
    """Calculate physical distance in kilometers between two lat/lon coordinates using Haversine formula."""
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return 10.0  # Default estimate if coordinates unavailable

    r = 6371.0  # Radius of Earth in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return round(r * c, 2)


class RedistributionService:
    """Business logic service for cross-facility redistribution recommendations and transfers."""

    @staticmethod
    def calculate_distance(
        lat1: Optional[float], lon1: Optional[float],
        lat2: Optional[float], lon2: Optional[float]
    ) -> float:
        """Expose Haversine distance calculation."""
        return calculate_haversine_distance(lat1, lon1, lat2, lon2)

    @staticmethod
    def _check_user_recommendation_access(user: User, rec: Recommendation, db: Session) -> None:
        """Verify user authorization for a recommendation involving source/destination facilities."""
        if user.role == UserRoleEnum.CITIZEN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Citizens are not authorized to perform recommendation actions."
            )
        if user.role == UserRoleEnum.SUPER_ADMIN:
            return

        # Check access to source, destination, or target facility
        allowed = False
        relevant_facilities = [
            fid for fid in (rec.source_facility_id, rec.destination_facility_id, rec.facility_id)
            if fid is not None
        ]

        if not relevant_facilities:
            return

        for fid in relevant_facilities:
            try:
                check_facility_access(user, fid, db)
                allowed = True
                break
            except HTTPException:
                continue

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have authorization for facilities involved in this recommendation."
            )

    @staticmethod
    def generate_redistribution_recommendations(
        db: Session,
        facility_id: Optional[int] = None
    ) -> List[Recommendation]:
        """Scan facilities and inventory to identify surplus vs deficit items and generate decision-support recommendations.
        
        Note: Does NOT alter stock levels or execute automatic transfers.
        """
        # Fetch active facilities
        fac_query = db.query(Facility).filter(Facility.is_active == True)
        if facility_id:
            fac_query = fac_query.filter(Facility.id == facility_id)
        facilities = fac_query.all()

        if len(facilities) == 0:
            return []

        # Find items with stock across facilities
        inventories = db.query(Inventory).filter(Inventory.current_stock > 0).all()
        
        # Group inventory by item_id
        item_fac_map: Dict[int, List[Inventory]] = {}
        for inv in inventories:
            item_fac_map.setdefault(inv.item_id, []).append(inv)

        created_recommendations: List[Recommendation] = []

        for item_id, inv_list in item_fac_map.items():
            if len(inv_list) < 2:
                continue

            surplus_invs = []
            deficit_invs = []

            for inv in inv_list:
                # Surplus condition: current_stock > 2 * min_threshold
                if inv.current_stock > (inv.min_threshold * 2):
                    surplus_invs.append(inv)
                # Deficit condition: current_stock <= min_threshold
                elif inv.current_stock <= inv.min_threshold:
                    deficit_invs.append(inv)

            for deficit in deficit_invs:
                target_fac = db.query(Facility).filter(Facility.id == deficit.facility_id).first()
                item = db.query(Item).filter(Item.id == item_id).first()
                if not target_fac or not item:
                    continue

                needed_qty = (deficit.min_threshold * 2) - deficit.current_stock

                for surplus in surplus_invs:
                    if surplus.facility_id == deficit.facility_id:
                        continue

                    source_fac = db.query(Facility).filter(Facility.id == surplus.facility_id).first()
                    if not source_fac:
                        continue

                    available_surplus = surplus.current_stock - surplus.min_threshold
                    if available_surplus <= 0:
                        continue

                    transfer_qty = min(needed_qty, available_surplus)
                    if transfer_qty <= 0:
                        continue

                    distance_km = calculate_haversine_distance(
                        source_fac.latitude, source_fac.longitude,
                        target_fac.latitude, target_fac.longitude
                    )

                    # Check for duplicate pending recommendation
                    existing = db.query(Recommendation).filter(
                        Recommendation.source_facility_id == source_fac.id,
                        Recommendation.destination_facility_id == target_fac.id,
                        Recommendation.item_id == item.id,
                        Recommendation.status == RecommendationStatusEnum.PENDING
                    ).first()

                    if existing:
                        continue

                    reasoning = (
                        f"Facility '{source_fac.name}' has surplus stock ({surplus.current_stock} units, min threshold {surplus.min_threshold}) "
                        f"for Item '{item.name}'. Facility '{target_fac.name}' is experiencing low stock ({deficit.current_stock} units). "
                        f"Distance between facilities: {distance_km} km. Suggested transfer: {transfer_qty} units."
                    )

                    rec = Recommendation(
                        title=f"Redistribute {item.name} from {source_fac.name} to {target_fac.name}",
                        action_type="REDISTRIBUTION",
                        facility_id=target_fac.id,
                        source_facility_id=source_fac.id,
                        destination_facility_id=target_fac.id,
                        item_id=item.id,
                        suggested_quantity=transfer_qty,
                        reasoning=reasoning,
                        details={
                            "source_facility_name": source_fac.name,
                            "destination_facility_name": target_fac.name,
                            "source_current_stock": surplus.current_stock,
                            "target_current_stock": deficit.current_stock,
                            "distance_km": distance_km,
                            "transfer_qty": transfer_qty
                        },
                        status=RecommendationStatusEnum.PENDING
                    )
                    db.add(rec)
                    created_recommendations.append(rec)

        if created_recommendations:
            db.commit()
            for r in created_recommendations:
                db.refresh(r)

        return created_recommendations

    @staticmethod
    def list_recommendations(
        db: Session,
        current_user: User,
        skip: int = 0,
        limit: int = 100,
        status_filter: Optional[str] = None,
        facility_id: Optional[int] = None,
        item_id: Optional[int] = None,
        action_type: Optional[str] = None
    ) -> Tuple[List[Recommendation], int]:
        """List recommendations with filtering, RBAC geographic bounds, and detailed metadata."""
        if current_user.role == UserRoleEnum.CITIZEN:
            return [], 0

        query = db.query(Recommendation)

        # RBAC scope filtering
        if current_user.role in (UserRoleEnum.HOSPITAL_ADMIN, UserRoleEnum.FACILITY_STAFF):
            if current_user.facility_id:
                query = query.filter(
                    or_(
                        Recommendation.facility_id == current_user.facility_id,
                        Recommendation.source_facility_id == current_user.facility_id,
                        Recommendation.destination_facility_id == current_user.facility_id
                    )
                )
            else:
                return [], 0
        elif current_user.role == UserRoleEnum.DISTRICT_ADMIN:
            if current_user.district_id:
                dist_fac_ids = [
                    f.id for f in db.query(Facility.id).filter(Facility.district_id == current_user.district_id).all()
                ]
                query = query.filter(
                    or_(
                        Recommendation.facility_id.in_(dist_fac_ids),
                        Recommendation.source_facility_id.in_(dist_fac_ids),
                        Recommendation.destination_facility_id.in_(dist_fac_ids)
                    )
                )
            else:
                return [], 0
        elif current_user.role == UserRoleEnum.STATE_ADMIN:
            if current_user.state_id:
                state_fac_ids = [
                    f.id for f in db.query(Facility.id).join(Facility.district).filter(Facility.district.has(state_id=current_user.state_id)).all()
                ]
                query = query.filter(
                    or_(
                        Recommendation.facility_id.in_(state_fac_ids),
                        Recommendation.source_facility_id.in_(state_fac_ids),
                        Recommendation.destination_facility_id.in_(state_fac_ids)
                    )
                )
            else:
                return [], 0

        # Additional query parameters
        if facility_id:
            query = query.filter(
                or_(
                    Recommendation.facility_id == facility_id,
                    Recommendation.source_facility_id == facility_id,
                    Recommendation.destination_facility_id == facility_id
                )
            )

        if item_id:
            query = query.filter(Recommendation.item_id == item_id)

        if action_type:
            query = query.filter(Recommendation.action_type.ilike(f"%{action_type}%"))

        if status_filter:
            status_upper = status_filter.upper()
            try:
                st_enum = RecommendationStatusEnum[status_upper]
                query = query.filter(Recommendation.status == st_enum)
            except KeyError:
                query = query.filter(Recommendation.status.cast(String).ilike(f"%{status_filter}%"))

        total = query.count()
        recs = query.order_by(Recommendation.created_at.desc()).offset(skip).limit(limit).all()

        for r in recs:
            r.facility_name = r.facility.name if r.facility else None
            r.source_facility_name = r.source_facility.name if r.source_facility else None
            r.destination_facility_name = r.destination_facility.name if r.destination_facility else None
            r.item_name = r.item.name if r.item else None

        return recs, total

    @staticmethod
    def get_recommendation(
        db: Session,
        recommendation_id: int,
        current_user: User
    ) -> Recommendation:
        """Fetch single recommendation by ID with access check."""
        rec = db.query(Recommendation).filter(Recommendation.id == recommendation_id).first()
        if not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recommendation with ID {recommendation_id} not found."
            )

        RedistributionService._check_user_recommendation_access(current_user, rec, db)

        rec.facility_name = rec.facility.name if rec.facility else None
        rec.source_facility_name = rec.source_facility.name if rec.source_facility else None
        rec.destination_facility_name = rec.destination_facility.name if rec.destination_facility else None
        rec.item_name = rec.item.name if rec.item else None

        return rec

    @staticmethod
    def approve_recommendation(
        db: Session,
        recommendation_id: int,
        current_user: User,
        approve_in: Optional[RecommendationApprove] = None
    ) -> Recommendation:
        """Approve a recommendation, execute atomic stock movements, create Transfer record, ApprovalAction, and AuditLog."""
        rec = db.query(Recommendation).filter(Recommendation.id == recommendation_id).first()
        if not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recommendation with ID {recommendation_id} not found."
            )

        if rec.status != RecommendationStatusEnum.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot approve recommendation with status '{rec.status.value}'. Only PENDING recommendations can be approved."
            )

        RedistributionService._check_user_recommendation_access(current_user, rec, db)

        source_id = rec.source_facility_id or rec.facility_id
        dest_id = rec.destination_facility_id or rec.facility_id
        item_id = rec.item_id
        transfer_qty = (approve_in.override_quantity if approve_in and approve_in.override_quantity else rec.suggested_quantity) or 1

        if not source_id or not dest_id or not item_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Recommendation lacks required source facility, destination facility, or item details."
            )

        if source_id == dest_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Source and destination facility cannot be identical for redistribution transfer."
            )

        try:
            # Lock source inventory record
            source_inv = db.query(Inventory).filter(
                Inventory.facility_id == source_id,
                Inventory.item_id == item_id
            ).with_for_update().first()

            if not source_inv or source_inv.current_stock < transfer_qty:
                available_stock = source_inv.current_stock if source_inv else 0
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient stock at source facility (ID: {source_id}). Current stock: {available_stock}, requested transfer: {transfer_qty}."
                )

            # Deduct from source facility inventory
            source_inv.current_stock -= transfer_qty

            # Lock or create destination inventory record
            dest_inv = db.query(Inventory).filter(
                Inventory.facility_id == dest_id,
                Inventory.item_id == item_id
            ).with_for_update().first()

            if not dest_inv:
                dest_inv = Inventory(
                    facility_id=dest_id,
                    item_id=item_id,
                    current_stock=transfer_qty,
                    min_threshold=10,
                    max_threshold=100
                )
                db.add(dest_inv)
            else:
                dest_inv.current_stock += transfer_qty

            # Record stock movements
            m_out = StockMovement(
                facility_id=source_id,
                item_id=item_id,
                movement_type=StockMovementTypeEnum.TRANSFERRED_OUT,
                quantity=transfer_qty,
                reference=f"Recommendation #{rec.id} Approved",
                created_by_user_id=current_user.id
            )
            db.add(m_out)

            m_in = StockMovement(
                facility_id=dest_id,
                item_id=item_id,
                movement_type=StockMovementTypeEnum.TRANSFERRED_IN,
                quantity=transfer_qty,
                reference=f"Recommendation #{rec.id} Approved",
                created_by_user_id=current_user.id
            )
            db.add(m_in)

            # Create Transfer Request record
            transfer = Transfer(
                source_facility_id=source_id,
                destination_facility_id=dest_id,
                item_id=item_id,
                quantity=transfer_qty,
                status=TransferStatusEnum.COMPLETED
            )
            db.add(transfer)
            db.flush()

            # Update Recommendation status
            rec.status = RecommendationStatusEnum.APPROVED
            if approve_in and approve_in.override_quantity:
                rec.suggested_quantity = approve_in.override_quantity

            # Create ApprovalAction record
            approval_notes = approve_in.notes if approve_in and approve_in.notes else f"Approved by User {current_user.email}"
            action_rec = ApprovalAction(
                recommendation_id=rec.id,
                transfer_id=transfer.id,
                user_id=current_user.id,
                action="APPROVE",
                notes=approval_notes
            )
            db.add(action_rec)

            # Create AuditLog record
            audit_entry = AuditLog(
                user_id=current_user.id,
                action="RECOMMENDATION_APPROVED",
                entity_type="Recommendation",
                entity_id=rec.id,
                details=f"Approved recommendation #{rec.id}. Created Transfer #{transfer.id} for {transfer_qty} units from Facility {source_id} to Facility {dest_id}."
            )
            db.add(audit_entry)

            db.commit()
            db.refresh(rec)

            rec.facility_name = rec.facility.name if rec.facility else None
            rec.source_facility_name = rec.source_facility.name if rec.source_facility else None
            rec.destination_facility_name = rec.destination_facility.name if rec.destination_facility else None
            rec.item_name = rec.item.name if rec.item else None

            return rec

        except HTTPException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to approve recommendation: {str(e)}"
            )

    @staticmethod
    def reject_recommendation(
        db: Session,
        recommendation_id: int,
        current_user: User,
        reject_in: Optional[RecommendationReject] = None
    ) -> Recommendation:
        """Reject a recommendation without changing stock levels."""
        rec = db.query(Recommendation).filter(Recommendation.id == recommendation_id).first()
        if not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recommendation with ID {recommendation_id} not found."
            )

        if rec.status != RecommendationStatusEnum.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reject recommendation with status '{rec.status.value}'. Only PENDING recommendations can be rejected."
            )

        RedistributionService._check_user_recommendation_access(current_user, rec, db)

        rec.status = RecommendationStatusEnum.REJECTED

        reject_notes = reject_in.notes if reject_in and reject_in.notes else f"Rejected by User {current_user.email}"
        action_rec = ApprovalAction(
            recommendation_id=rec.id,
            user_id=current_user.id,
            action="REJECT",
            notes=reject_notes
        )
        db.add(action_rec)

        audit_entry = AuditLog(
            user_id=current_user.id,
            action="RECOMMENDATION_REJECTED",
            entity_type="Recommendation",
            entity_id=rec.id,
            details=f"Rejected recommendation #{rec.id}. Notes: {reject_notes}"
        )
        db.add(audit_entry)

        db.commit()
        db.refresh(rec)

        rec.facility_name = rec.facility.name if rec.facility else None
        rec.source_facility_name = rec.source_facility.name if rec.source_facility else None
        rec.destination_facility_name = rec.destination_facility.name if rec.destination_facility else None
        rec.item_name = rec.item.name if rec.item else None

        return rec

    @staticmethod
    def modify_recommendation(
        db: Session,
        recommendation_id: int,
        current_user: User,
        modify_in: RecommendationModify
    ) -> Recommendation:
        """Modify recommendation parameters while preserving PENDING state for future approval."""
        rec = db.query(Recommendation).filter(Recommendation.id == recommendation_id).first()
        if not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recommendation with ID {recommendation_id} not found."
            )

        if rec.status != RecommendationStatusEnum.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot modify recommendation with status '{rec.status.value}'. Only PENDING recommendations can be modified."
            )

        RedistributionService._check_user_recommendation_access(current_user, rec, db)

        if modify_in.suggested_quantity is not None:
            rec.suggested_quantity = modify_in.suggested_quantity
        if modify_in.source_facility_id is not None:
            rec.source_facility_id = modify_in.source_facility_id
        if modify_in.destination_facility_id is not None:
            rec.destination_facility_id = modify_in.destination_facility_id
            rec.facility_id = modify_in.destination_facility_id
        if modify_in.reasoning is not None:
            rec.reasoning = modify_in.reasoning

        mod_notes = modify_in.notes if modify_in.notes else f"Modified parameters by User {current_user.email}"
        action_rec = ApprovalAction(
            recommendation_id=rec.id,
            user_id=current_user.id,
            action="MODIFY",
            notes=mod_notes
        )
        db.add(action_rec)

        audit_entry = AuditLog(
            user_id=current_user.id,
            action="RECOMMENDATION_MODIFIED",
            entity_type="Recommendation",
            entity_id=rec.id,
            details=f"Modified recommendation #{rec.id}. Notes: {mod_notes}"
        )
        db.add(audit_entry)

        db.commit()
        db.refresh(rec)

        rec.facility_name = rec.facility.name if rec.facility else None
        rec.source_facility_name = rec.source_facility.name if rec.source_facility else None
        rec.destination_facility_name = rec.destination_facility.name if rec.destination_facility else None
        rec.item_name = rec.item.name if rec.item else None

        return rec
