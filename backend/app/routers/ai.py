"""AI API routes for Gemini-powered features in MediGuard."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List, Dict, Any

from app.database import get_db
from app.models import (
    User,
    Prediction,
    Inventory,
    Alert,
    Facility,
    District,
    Item,
    Recommendation,
    Equipment,
    UserRoleEnum,
    AlertStatusEnum,
    AlertSeverityEnum,
    EquipmentStatusEnum,
    RecommendationStatusEnum,
)
from app.schemas import (
    AIQueryRequest,
    AIExplainRequest,
    AIResponse,
    AIExplainAlertRequest,
    AIExplainPredictionRequest,
    AIExplainRecommendationRequest,
    AIFacilitySummaryRequest,
    AIDistrictSummaryRequest,
    AIChatRequest,
    AIChatResponse,
    AIExplainResponse,
    AISummaryResponse,
)
from app.utils import get_current_user, check_facility_access, normalize_role
from app.services import (
    gemini_service,
    GeminiAPIException,
    GeminiTimeoutException,
    GeminiConnectionException,
    GeminiResponseException,
)

router = APIRouter(prefix="/ai", tags=["AI"])


def _handle_gemini_exceptions(func_call):
    """Helper to translate Gemini exceptions into HTTPExceptions."""
    try:
        return func_call()
    except GeminiTimeoutException as e:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=e.message)
    except GeminiConnectionException as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except GeminiResponseException as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=e.message)
    except GeminiAPIException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/explain-alert", response_model=AIExplainResponse)
def explain_alert(
    request: AIExplainAlertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate grounded AI explanation for an active alert.
    Administrative access only. Citizens are restricted.
    """
    user_role = normalize_role(current_user.role)
    if user_role == UserRoleEnum.CITIZEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizens do not have access to administrative alert explanations"
        )

    alert = db.query(Alert).filter(Alert.id == request.alert_id).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    # Geographic / Facility RBAC check
    if alert.facility_id:
        check_facility_access(current_user, alert.facility_id, db)

    facility = db.query(Facility).filter(Facility.id == alert.facility_id).first() if alert.facility_id else None
    item = db.query(Item).filter(Item.id == alert.item_id).first() if alert.item_id else None

    alert_data = {
        "id": alert.id,
        "title": alert.title,
        "severity": alert.severity.value if hasattr(alert.severity, "value") else str(alert.severity),
        "description": alert.description,
        "facility_id": alert.facility_id,
        "facility_name": facility.name if facility else "System-Wide",
        "item_name": item.name if item else None,
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
        "metadata": alert.details,
    }

    return _handle_gemini_exceptions(
        lambda: gemini_service.explain_alert(alert_data, request.language or "English")
    )


@router.post("/explain-prediction", response_model=AIExplainResponse)
def explain_prediction(
    request: AIExplainPredictionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate grounded AI explanation for an ML demand/risk prediction.
    Administrative access only. Citizens are restricted.
    """
    user_role = normalize_role(current_user.role)
    if user_role == UserRoleEnum.CITIZEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizens do not have access to AI prediction explanations"
        )

    prediction = db.query(Prediction).filter(Prediction.id == request.prediction_id).first()
    if not prediction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prediction not found")

    if prediction.facility_id:
        check_facility_access(current_user, prediction.facility_id, db)

    facility = db.query(Facility).filter(Facility.id == prediction.facility_id).first() if prediction.facility_id else None
    item = db.query(Item).filter(Item.id == prediction.item_id).first() if prediction.item_id else None

    prediction_data = {
        "id": prediction.id,
        "facility_id": prediction.facility_id,
        "facility_name": facility.name if facility else f"Facility #{prediction.facility_id}",
        "item_id": prediction.item_id,
        "item_name": item.name if item else f"Item #{prediction.item_id}",
        "predicted_demand": prediction.predicted_demand,
        "confidence": prediction.confidence,
        "predicted_date": prediction.predicted_date.isoformat() if prediction.predicted_date else None,
    }

    return _handle_gemini_exceptions(
        lambda: gemini_service.explain_prediction(prediction_data, request.language or "English")
    )


@router.post("/explain-recommendation", response_model=AIExplainResponse)
def explain_recommendation(
    request: AIExplainRecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate grounded AI explanation for a redistribution recommendation.
    Administrative access only. Citizens are restricted.
    """
    user_role = normalize_role(current_user.role)
    if user_role == UserRoleEnum.CITIZEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizens do not have access to recommendation explanations"
        )

    rec = db.query(Recommendation).filter(Recommendation.id == request.recommendation_id).first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found")

    # Access check on source facility
    check_facility_access(current_user, rec.facility_id, db)

    src_facility = db.query(Facility).filter(Facility.id == rec.source_facility_id).first() if rec.source_facility_id else None
    dst_facility = db.query(Facility).filter(Facility.id == rec.destination_facility_id).first() if rec.destination_facility_id else None
    item = db.query(Item).filter(Item.id == rec.item_id).first() if rec.item_id else None

    rec_data = {
        "id": rec.id,
        "source_facility_id": rec.source_facility_id,
        "source_facility_name": src_facility.name if src_facility else f"Facility #{rec.source_facility_id}",
        "destination_facility_id": rec.destination_facility_id,
        "destination_facility_name": dst_facility.name if dst_facility else f"Facility #{rec.destination_facility_id}",
        "item_id": rec.item_id,
        "item_name": item.name if item else f"Item #{rec.item_id}",
        "recommended_quantity": rec.suggested_quantity,
        "distance_km": rec.details.get("distance_km") if rec.details else None,
        "status": rec.status.value if hasattr(rec.status, "value") else str(rec.status),
        "rationale": rec.reasoning,
    }

    return _handle_gemini_exceptions(
        lambda: gemini_service.explain_recommendation(rec_data, request.language or "English")
    )


@router.post("/facility-summary", response_model=AISummaryResponse)
def generate_facility_summary(
    request: AIFacilitySummaryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate grounded AI executive summary for a specific facility.
    Administrative access only. Citizens are restricted.
    """
    user_role = normalize_role(current_user.role)
    if user_role == UserRoleEnum.CITIZEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizens do not have access to administrative facility summaries"
        )

    facility = db.query(Facility).filter(Facility.id == request.facility_id).first()
    if not facility:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facility not found")

    check_facility_access(current_user, facility, db)

    district = db.query(District).filter(District.id == facility.district_id).first() if facility.district_id else None

    # Aggregate database facts safely
    inv_items = db.query(Inventory).filter(Inventory.facility_id == facility.id).all()
    total_inv = len(inv_items)
    low_stock = sum(1 for it in inv_items if it.current_stock <= it.min_threshold)

    active_alerts = db.query(Alert).filter(
        Alert.facility_id == facility.id,
        Alert.status == AlertStatusEnum.ACTIVE
    ).all()
    total_active_alerts = len(active_alerts)
    critical_alerts = sum(1 for a in active_alerts if a.severity in (AlertSeverityEnum.CRITICAL, "CRITICAL"))
    high_alerts = sum(1 for a in active_alerts if a.severity in (AlertSeverityEnum.HIGH, "HIGH"))

    equipment_list = db.query(Equipment).filter(Equipment.facility_id == facility.id).all()
    total_equipment = len(equipment_list)
    op_equipment = sum(1 for eq in equipment_list if eq.status == EquipmentStatusEnum.OPERATIONAL)
    non_op_equipment = total_equipment - op_equipment

    facility_data = {
        "id": facility.id,
        "name": facility.name,
        "facility_type": facility.type.value if hasattr(facility.type, "value") else str(facility.type),
        "district": district.name if district else "N/A",
        "state": district.state.name if district and district.state else "N/A",
        "total_inventory_items": total_inv,
        "low_stock_count": low_stock,
        "total_active_alerts": total_active_alerts,
        "critical_alerts": critical_alerts,
        "high_alerts": high_alerts,
        "total_equipment": total_equipment,
        "operational_equipment": op_equipment,
        "non_functional_equipment": non_op_equipment,
    }

    return _handle_gemini_exceptions(
        lambda: gemini_service.generate_facility_summary(facility_data, request.language or "English")
    )


@router.post("/district-summary", response_model=AISummaryResponse)
def generate_district_summary(
    request: AIDistrictSummaryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate grounded AI executive summary for a district.
    Administrative access only. Citizens are restricted.
    """
    user_role = normalize_role(current_user.role)
    if user_role == UserRoleEnum.CITIZEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizens do not have access to administrative district summaries"
        )

    district = db.query(District).filter(District.id == request.district_id).first()
    if not district:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="District not found")

    # Scoping check for DISTRICT_ADMIN / HOSPITAL_ADMIN / FACILITY_STAFF
    if user_role in (UserRoleEnum.DISTRICT_ADMIN, UserRoleEnum.HOSPITAL_ADMIN, UserRoleEnum.FACILITY_STAFF):
        if current_user.district_id and current_user.district_id != district.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Cannot access district summary outside your assigned district"
            )

    facilities = db.query(Facility).filter(Facility.district_id == district.id).all()
    facility_ids = [f.id for f in facilities]

    total_inventory = db.query(Inventory).filter(Inventory.facility_id.in_(facility_ids)).count() if facility_ids else 0
    low_stock = db.query(Inventory).filter(
        Inventory.facility_id.in_(facility_ids),
        Inventory.current_stock <= Inventory.min_threshold
    ).count() if facility_ids else 0

    active_alerts = db.query(Alert).filter(
        Alert.facility_id.in_(facility_ids),
        Alert.status == AlertStatusEnum.ACTIVE
    ).all() if facility_ids else []

    total_alerts = len(active_alerts)
    critical_alerts = sum(1 for a in active_alerts if a.severity in (AlertSeverityEnum.CRITICAL, "CRITICAL"))

    # Identify high risk facilities
    high_risk_facility_ids = list({a.facility_id for a in active_alerts if a.severity in (AlertSeverityEnum.CRITICAL, AlertSeverityEnum.HIGH, "CRITICAL", "HIGH")})
    high_risk_names = [f.name for f in facilities if f.id in high_risk_facility_ids]

    district_data = {
        "district_id": district.id,
        "district_name": district.name,
        "state_name": district.state.name if district.state else "N/A",
        "total_facilities": len(facilities),
        "total_inventory_items": total_inventory,
        "total_low_stock": low_stock,
        "total_alerts": total_alerts,
        "critical_alerts": critical_alerts,
        "high_risk_facilities": high_risk_names,
    }

    return _handle_gemini_exceptions(
        lambda: gemini_service.generate_district_summary(district_data, request.language or "English")
    )


@router.post("/chat", response_model=AIChatResponse)
def ai_chat(
    request: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Natural-language AI Chat interface grounded in application data.
    Queries are classified by intent, facts are retrieved from PostgreSQL,
    and Gemini synthesizes a grounded answer.
    """
    user_role = normalize_role(current_user.role)
    query_text = request.query.strip()
    query_lower = query_text.lower()

    # 1. CITIZEN RESTRICTIONS & PUBLIC SAFE MODE
    if user_role == UserRoleEnum.CITIZEN:
        # Check if query asks for sensitive administrative data
        admin_keywords = ["password", "credential", "token", "secret", "user list", "admin email", "hash", "audit log"]
        if any(kw in query_lower for kw in admin_keywords):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Citizens are restricted from querying administrative security data"
            )

        # Citizens are served public facility information context ONLY
        public_facilities = db.query(Facility).filter(Facility.is_active == True).limit(5).all()
        grounded_facts = {
            "public_facilities": [
                {
                    "name": f.name,
                    "type": f.type.value if hasattr(f.type, "value") else str(f.type),
                    "address": f.location,
                    "contact_phone": f.contact_phone
                }
                for f in public_facilities
            ]
        }
        sources = ["PublicFacilityCatalog"]
        intent_classified = "CITIZEN_PUBLIC_QUERY"

        return _handle_gemini_exceptions(
            lambda: gemini_service.chat_with_grounded_context(
                query=query_text,
                intent_classified=intent_classified,
                grounded_facts=grounded_facts,
                sources_used=sources,
                language=request.language or "English"
            )
        )

    # 2. ADMINISTRATIVE INTENT CLASSIFICATION & GROUNDED CONTEXT RETRIEVAL
    facility_id = request.facility_id or current_user.facility_id
    if facility_id:
        check_facility_access(current_user, facility_id, db)

    sources = []
    grounded_facts: Dict[str, Any] = {}

    # Intent Classification Logic
    if any(term in query_lower for term in ["stock", "inventory", "supplies", "medicine", "items", "quantity"]):
        intent_classified = "INVENTORY_QUERY"
        sources.append("InventoryDatabase")

        query_builder = db.query(Inventory)
        if facility_id:
            query_builder = query_builder.filter(Inventory.facility_id == facility_id)
        
        inv_items = query_builder.limit(10).all()
        grounded_facts["inventory_items"] = [
            {
                "item_name": it.item_name or (it.item.name if it.item else "Unknown Item"),
                "category": it.category or (it.item.category if it.item else "N/A"),
                "current_stock": it.current_stock,
                "min_threshold": it.min_threshold,
                "unit": it.unit or "units",
                "batch_number": it.batch_number,
                "is_low_stock": it.current_stock <= it.min_threshold
            }
            for it in inv_items
        ]

    elif any(term in query_lower for term in ["alert", "risk", "warning", "critical", "shortage"]):
        intent_classified = "ALERT_QUERY"
        sources.append("AlertDatabase")

        query_builder = db.query(Alert).filter(Alert.status == AlertStatusEnum.ACTIVE)
        if facility_id:
            query_builder = query_builder.filter(Alert.facility_id == facility_id)

        alerts = query_builder.limit(10).all()
        grounded_facts["alerts"] = [
            {
                "title": al.title,
                "severity": al.severity.value if hasattr(al.severity, "value") else str(al.severity),
                "description": al.description,
                "facility_id": al.facility_id
            }
            for al in alerts
        ]

    elif any(term in query_lower for term in ["redistribut", "transfer", "surplus", "deficit", "move"]):
        intent_classified = "RECOMMENDATION_QUERY"
        sources.append("RedistributionRecommendationDatabase")

        query_builder = db.query(Recommendation).filter(Recommendation.status == RecommendationStatusEnum.PENDING)
        if facility_id:
            query_builder = query_builder.filter(
                (Recommendation.facility_id == facility_id) | (Recommendation.target_facility_id == facility_id)
            )

        recs = query_builder.limit(5).all()
        grounded_facts["recommendations"] = [
            {
                "source_facility_id": r.facility_id,
                "target_facility_id": r.target_facility_id,
                "recommended_quantity": r.recommended_quantity,
                "rationale": r.rationale
            }
            for r in recs
        ]

    else:
        intent_classified = "GENERAL_QUERY"
        sources.append("SystemMetrics")

        fac_count = db.query(Facility).count()
        inv_count = db.query(Inventory).count()
        active_alert_count = db.query(Alert).filter(Alert.status == AlertStatusEnum.ACTIVE).count()

        grounded_facts["system_stats"] = {
            "total_facilities": fac_count,
            "total_inventory_lines": inv_count,
            "active_alerts": active_alert_count,
            "user_facility_id": facility_id
        }

    return _handle_gemini_exceptions(
        lambda: gemini_service.chat_with_grounded_context(
            query=query_text,
            intent_classified=intent_classified,
            grounded_facts=grounded_facts,
            sources_used=sources,
            language=request.language or "English"
        )
    )


# ------------------------------------------------------------------
# BACKWARD COMPATIBILITY ENDPOINTS
# ------------------------------------------------------------------

@router.post("/query", response_model=AIResponse)
def query_ai(
    request: AIQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Legacy query endpoint."""
    user_role = normalize_role(current_user.role)
    if user_role == UserRoleEnum.CITIZEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizens do not have access to administrative AI query feature"
        )

    chat_resp = ai_chat(
        AIChatRequest(query=request.query, language="English"),
        db=db,
        current_user=current_user
    )
    return AIResponse(response=chat_resp.response, sources=chat_resp.sources_used)


@router.post("/explain", response_model=AIResponse)
def legacy_explain_prediction(
    request: AIExplainRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Legacy prediction explanation endpoint."""
    resp = explain_prediction(
        AIExplainPredictionRequest(prediction_id=request.prediction_id),
        db=db,
        current_user=current_user
    )
    return AIResponse(response=resp.explanation)


@router.post("/summarize", response_model=AIResponse)
def legacy_summarize(
    report_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Legacy report summary endpoint."""
    user_role = normalize_role(current_user.role)
    if user_role == UserRoleEnum.CITIZEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizens do not have access to report summary feature"
        )

    summary_resp = _handle_gemini_exceptions(
        lambda: gemini_service.generate_facility_summary({"name": "Report Summary", "total_inventory_items": 10, "low_stock_count": 2, "total_active_alerts": 1, "critical_alerts": 0, "total_equipment": 5, "operational_equipment": 5, "non_functional_equipment": 0})
    )
    return AIResponse(response=summary_resp["summary"])