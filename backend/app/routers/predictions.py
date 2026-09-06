"""Predictions API routes."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models import User, Prediction, Inventory, Facility, District, UserRoleEnum
from app.schemas import (
    PredictionResponse, PredictionCreate,
    DemandForecastRequest, DemandForecastResponse,
    StockoutRiskRequest, StockoutRiskResponse,
    ExpiryRiskRequest, ExpiryRiskResponse,
    RedistributionScoreRequest, RedistributionScoreResponse
)
from app.utils import get_current_user, require_roles, check_facility_access, normalize_role
from app.services import ml_service, ml_adapter_service
from app.integrations.ml import MLException, MLTimeoutException, MLConnectionException

router = APIRouter(prefix="/predictions", tags=["Predictions"])


@router.get("/demand", response_model=List[PredictionResponse])
def get_demand_predictions(
    facility_id: Optional[int] = None,
    item_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get demand predictions scoped by role and location hierarchy."""
    user_role = normalize_role(current_user.role)

    if user_role == UserRoleEnum.CITIZEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizens do not have access to prediction data"
        )

    query = db.query(Prediction)

    if facility_id:
        facility = db.query(Facility).filter(Facility.id == facility_id).first()
        if not facility:
            raise HTTPException(status_code=404, detail="Facility not found")
        check_facility_access(current_user, facility, db)
        query = query.filter(Prediction.facility_id == facility_id)
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
                query = query.filter(Prediction.facility_id == current_user.facility_id)
            else:
                return []

    if item_id:
        query = query.filter(Prediction.item_id == item_id)

    predictions = query.order_by(Prediction.predicted_date.desc()).offset(skip).limit(limit).all()
    return predictions


@router.get("/risk", response_model=List[dict])
def get_risk_assessment(
    facility_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get risk assessment for facilities with boundary check."""
    user_role = normalize_role(current_user.role)

    if user_role == UserRoleEnum.CITIZEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizens do not have access to risk assessment data"
        )

    if facility_id:
        facility = db.query(Facility).filter(Facility.id == facility_id).first()
        if not facility:
            raise HTTPException(status_code=404, detail="Facility not found")
        check_facility_access(current_user, facility, db)
        facility_ids = [facility_id]
    else:
        if user_role == UserRoleEnum.SUPER_ADMIN:
            facilities = db.query(Facility).all()
            facility_ids = [f.id for f in facilities]
        elif user_role == UserRoleEnum.STATE_ADMIN:
            if not current_user.state_id:
                return []
            facilities = db.query(Facility).join(District).filter(District.state_id == current_user.state_id).all()
            facility_ids = [f.id for f in facilities]
        elif user_role == UserRoleEnum.DISTRICT_ADMIN:
            if not current_user.district_id:
                return []
            facilities = db.query(Facility).filter(Facility.district_id == current_user.district_id).all()
            facility_ids = [f.id for f in facilities]
        elif user_role in (UserRoleEnum.HOSPITAL_ADMIN, UserRoleEnum.FACILITY_STAFF):
            if not current_user.facility_id:
                return []
            facility_ids = [current_user.facility_id]
        else:
            return []

    results = []
    for fid in facility_ids:
        items = db.query(Inventory).filter(Inventory.facility_id == fid).all()
        risks = ml_service.assess_risk(fid, items)
        results.extend(risks)

    return results


@router.post("/generate", response_model=PredictionResponse, status_code=status.HTTP_201_CREATED)
def generate_prediction(
    request: PredictionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRoleEnum.SUPER_ADMIN, UserRoleEnum.STATE_ADMIN, UserRoleEnum.DISTRICT_ADMIN,
        UserRoleEnum.HOSPITAL_ADMIN, UserRoleEnum.FACILITY_STAFF
    ))
):
    """Generate a new demand prediction with boundary check."""
    facility = db.query(Facility).filter(Facility.id == request.facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")

    check_facility_access(current_user, facility, db)

    item = db.query(Inventory).filter(Inventory.id == request.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    historical_data = [item.current_stock] * 7

    prediction_result = ml_service.predict_demand(
        request.facility_id,
        request.item_id,
        item.item_name,
        historical_data
    )

    prediction = Prediction(
        facility_id=request.facility_id,
        item_id=request.item_id,
        predicted_demand=prediction_result["predicted_demand"],
        confidence=prediction_result["confidence"],
        predicted_date=datetime.fromisoformat(prediction_result["predicted_date"])
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return prediction


# Provider-based ML Adapter endpoints

@router.post("/forecast", response_model=DemandForecastResponse, status_code=status.HTTP_200_OK)
def get_demand_forecast(
    request: DemandForecastRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate demand forecast via ML Provider interface and persist result."""
    user_role = normalize_role(current_user.role)
    if user_role == UserRoleEnum.CITIZEN:
        raise HTTPException(status_code=403, detail="Citizens do not have access to prediction data")

    facility = db.query(Facility).filter(Facility.id == request.facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")
    check_facility_access(current_user, facility, db)

    try:
        return ml_adapter_service.predict_and_store_demand(db, request)
    except MLTimeoutException as e:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=f"ML Engine timeout: {str(e)}")
    except MLConnectionException as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"ML Engine unavailable: {str(e)}")
    except MLException as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"ML Engine error: {str(e)}")


@router.post("/stockout-risk", response_model=StockoutRiskResponse, status_code=status.HTTP_200_OK)
def get_stockout_risk(
    request: StockoutRiskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Assess stock-out risk via ML Provider interface and store critical risks."""
    user_role = normalize_role(current_user.role)
    if user_role == UserRoleEnum.CITIZEN:
        raise HTTPException(status_code=403, detail="Citizens do not have access to prediction data")

    facility = db.query(Facility).filter(Facility.id == request.facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")
    check_facility_access(current_user, facility, db)

    try:
        return ml_adapter_service.assess_and_store_stockout_risk(db, request)
    except MLTimeoutException as e:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=f"ML Engine timeout: {str(e)}")
    except MLConnectionException as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"ML Engine unavailable: {str(e)}")
    except MLException as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"ML Engine error: {str(e)}")


@router.post("/expiry-risk", response_model=ExpiryRiskResponse, status_code=status.HTTP_200_OK)
def get_expiry_risk(
    request: ExpiryRiskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Assess batch expiry risk via ML Provider interface and store critical risks."""
    user_role = normalize_role(current_user.role)
    if user_role == UserRoleEnum.CITIZEN:
        raise HTTPException(status_code=403, detail="Citizens do not have access to prediction data")

    facility = db.query(Facility).filter(Facility.id == request.facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")
    check_facility_access(current_user, facility, db)

    try:
        return ml_adapter_service.assess_and_store_expiry_risk(db, request)
    except MLTimeoutException as e:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=f"ML Engine timeout: {str(e)}")
    except MLConnectionException as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"ML Engine unavailable: {str(e)}")
    except MLException as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"ML Engine error: {str(e)}")


@router.post("/redistribution-score", response_model=RedistributionScoreResponse, status_code=status.HTTP_200_OK)
def get_redistribution_score(
    request: RedistributionScoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Evaluate redistribution scoring recommendation via ML Provider interface."""
    user_role = normalize_role(current_user.role)
    if user_role == UserRoleEnum.CITIZEN:
        raise HTTPException(status_code=403, detail="Citizens do not have access to prediction data")

    source_facility = db.query(Facility).filter(Facility.id == request.source_facility_id).first()
    if not source_facility:
        raise HTTPException(status_code=404, detail="Source facility not found")
    check_facility_access(current_user, source_facility, db)

    try:
        return ml_adapter_service.score_redistribution(db, request)
    except MLTimeoutException as e:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=f"ML Engine timeout: {str(e)}")
    except MLConnectionException as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"ML Engine unavailable: {str(e)}")
    except MLException as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"ML Engine error: {str(e)}")