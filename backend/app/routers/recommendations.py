"""Cross-Facility Redistribution Recommendation API Router."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserRoleEnum
from app.schemas import (
    RecommendationResponse, RecommendationApprove, RecommendationReject, RecommendationModify,
    PaginatedRecommendationResponse
)
from app.utils import get_current_user
from app.services import RedistributionService

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


@router.get("", response_model=List[RecommendationResponse])
@router.get("/", response_model=List[RecommendationResponse])
def list_recommendations(
    facility_id: Optional[int] = None,
    item_id: Optional[int] = None,
    action_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List cross-facility recommendations with filtering and RBAC access control."""
    recs, _ = RedistributionService.list_recommendations(
        db=db,
        current_user=current_user,
        skip=skip,
        limit=limit,
        status_filter=status_filter,
        facility_id=facility_id,
        item_id=item_id,
        action_type=action_type
    )
    return recs


@router.post("/generate", response_model=List[RecommendationResponse])
def generate_recommendations(
    facility_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trigger decision-support recommendation generation across facilities based on surplus/deficit analysis."""
    if current_user.role == UserRoleEnum.CITIZEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizens are not authorized to generate recommendations."
        )

    recs = RedistributionService.generate_redistribution_recommendations(db=db, facility_id=facility_id)
    for r in recs:
        r.facility_name = r.facility.name if r.facility else None
        r.source_facility_name = r.source_facility.name if r.source_facility else None
        r.destination_facility_name = r.destination_facility.name if r.destination_facility else None
        r.item_name = r.item.name if r.item else None
    return recs


@router.get("/{recommendation_id}", response_model=RecommendationResponse)
def get_recommendation(
    recommendation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve single recommendation by ID."""
    return RedistributionService.get_recommendation(
        db=db,
        recommendation_id=recommendation_id,
        current_user=current_user
    )


@router.post("/{recommendation_id}/approve", response_model=RecommendationResponse)
def approve_recommendation(
    recommendation_id: int,
    approve_in: Optional[RecommendationApprove] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve a recommendation, execute cross-facility stock movement, record Transfer and AuditLog."""
    return RedistributionService.approve_recommendation(
        db=db,
        recommendation_id=recommendation_id,
        current_user=current_user,
        approve_in=approve_in
    )


@router.post("/{recommendation_id}/reject", response_model=RecommendationResponse)
def reject_recommendation(
    recommendation_id: int,
    reject_in: Optional[RecommendationReject] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reject a recommendation without modifying inventory levels."""
    return RedistributionService.reject_recommendation(
        db=db,
        recommendation_id=recommendation_id,
        current_user=current_user,
        reject_in=reject_in
    )


@router.post("/{recommendation_id}/modify", response_model=RecommendationResponse)
def modify_recommendation(
    recommendation_id: int,
    modify_in: RecommendationModify,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Modify recommendation parameters while preserving PENDING state for future approval."""
    return RedistributionService.modify_recommendation(
        db=db,
        recommendation_id=recommendation_id,
        current_user=current_user,
        modify_in=modify_in
    )
