import math
import re
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.db.session import get_db
from app.models import Facility, FacilityTypeEnum, FacilityService
from app.schemas import (
    PublicFacilityResponse,
    PaginatedPublicFacilityResponse,
    CitizenAssistantRequest,
    CitizenAssistantResponse
)
from app.services.gemini_service import gemini_service

router = APIRouter()

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


@router.get("/facilities", response_model=PaginatedPublicFacilityResponse)
def list_public_facilities(
    type: Optional[FacilityTypeEnum] = None,
    service: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Get a paginated list of public facilities with available services.
    """
    query = db.query(Facility).options(joinedload(Facility.facility_services)).filter(Facility.is_active == True)

    if type:
        query = query.filter(Facility.type == type)
    
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            (Facility.name.ilike(search_term)) | 
            (Facility.location.ilike(search_term))
        )
        
    if service and service.strip() and service.strip().lower() != 'all services':
        query = query.join(Facility.facility_services).filter(
            FacilityService.service_name.ilike(f"%{service.strip()}%"),
            FacilityService.is_available == True
        )

    total = query.distinct().count()
    pages = max(1, (total + size - 1) // size)
    items = query.order_by(Facility.name).offset((page - 1) * size).limit(size).all()

    # Deduplicate in python if join produced duplicates
    unique_items = []
    seen_ids = set()
    for it in items:
        if it.id not in seen_ids:
            seen_ids.add(it.id)
            unique_items.append(it)

    return {
        "items": unique_items,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages
    }


@router.get("/facilities/nearby", response_model=PaginatedPublicFacilityResponse)
def get_nearby_facilities(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    radius: float = Query(10.0, description="Radius in kilometers"),
    type: Optional[FacilityTypeEnum] = None,
    service: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Find nearby facilities within a given radius using bounding box and haversine.
    """
    lat_diff = radius / 111.0
    cos_lat = math.cos(math.radians(lat))
    lon_diff = radius / (111.0 * cos_lat) if cos_lat > 0 else 180.0

    query = db.query(Facility).options(joinedload(Facility.facility_services)).filter(
        Facility.is_active == True,
        Facility.latitude.isnot(None),
        Facility.longitude.isnot(None),
        Facility.latitude.between(lat - lat_diff, lat + lat_diff),
        Facility.longitude.between(lon - lon_diff, lon + lon_diff)
    )

    if type:
        query = query.filter(Facility.type == type)
        
    if service and service.strip() and service.strip().lower() != 'all services':
        query = query.join(Facility.facility_services).filter(
            FacilityService.service_name.ilike(f"%{service.strip()}%"),
            FacilityService.is_available == True
        )

    candidates = query.all()
    
    nearby_facilities = []
    seen_ids = set()
    for f in candidates:
        if f.id in seen_ids:
            continue
        seen_ids.add(f.id)
        if f.latitude is not None and f.longitude is not None:
            dist = haversine(lat, lon, f.latitude, f.longitude)
            if dist <= radius:
                nearby_facilities.append((dist, f))
                
    nearby_facilities.sort(key=lambda x: x[0])
    
    total = len(nearby_facilities)
    pages = max(1, (total + size - 1) // size)
    start_idx = (page - 1) * size
    end_idx = start_idx + size
    
    paginated_items = [f for dist, f in nearby_facilities[start_idx:end_idx]]

    return {
        "items": paginated_items,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages
    }


@router.get("/facilities/{id}", response_model=PublicFacilityResponse)
def get_public_facility(id: int, db: Session = Depends(get_db)):
    """
    Get public details of a specific facility.
    """
    facility = db.query(Facility).options(joinedload(Facility.facility_services)).filter(
        Facility.id == id,
        Facility.is_active == True
    ).first()
    
    if not facility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Facility not found or not active"
        )
        
    return facility


@router.get("/services", response_model=List[str])
def list_public_services(db: Session = Depends(get_db)):
    """
    List all available public services across government facilities.
    """
    services = db.query(FacilityService.service_name).filter(
        FacilityService.is_available == True
    ).distinct().order_by(FacilityService.service_name).all()
    
    service_names = [s[0] for s in services if s[0]]
    if not service_names:
        service_names = [
            "Emergency", "Vaccination", "Maternity", "Pediatrics",
            "General Medicine", "Surgery", "ICU", "Pharmacy", "Laboratory", "Dental"
        ]
    return service_names


@router.get("/states")
def list_public_states(db: Session = Depends(get_db)):
    """List all states for registration and filtering."""
    from app.models import State
    states = db.query(State).order_by(State.name.asc()).all()
    return [{"id": s.id, "name": s.name, "code": s.code} for s in states]


@router.get("/districts")
def list_public_districts(state_id: Optional[int] = None, db: Session = Depends(get_db)):
    """List districts, optionally filtered by state_id."""
    from app.models import District
    query = db.query(District)
    if state_id:
        query = query.filter(District.state_id == state_id)
    districts = query.order_by(District.name.asc()).all()
    return [{"id": d.id, "name": d.name, "state_id": d.state_id} for d in districts]


@router.get("/facilities-list")
def list_facilities_compact(
    district_id: Optional[int] = None,
    state_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """List facilities in a compact format for registration selectors."""
    from app.models import Facility, District
    query = db.query(Facility).filter(Facility.is_active == True)
    if district_id:
        query = query.filter(Facility.district_id == district_id)
    elif state_id:
        query = query.join(District, Facility.district_id == District.id).filter(District.state_id == state_id)
    facilities = query.order_by(Facility.name.asc()).all()
    return [{
        "id": f.id,
        "name": f.name,
        "type": f.type.value if hasattr(f.type, "value") else str(f.type),
        "location": f.location,
        "district_id": f.district_id
    } for f in facilities]


@router.post("/assistant", response_model=CitizenAssistantResponse)
def citizen_ai_assistant(
    request: CitizenAssistantRequest,
    db: Session = Depends(get_db)
):
    """
    Grounded Citizen AI healthcare discovery assistant.
    Finds government facilities and services near the citizen with safety guardrails against medical diagnosis.
    Never exposes internal inventory quantities, stockout alerts, or administrative secrets.
    """
    raw_query = request.query.strip()
    query_lower = raw_query.lower()

    # 1. MEDICAL DIAGNOSIS SAFETY GUARDRAIL
    diagnosis_keywords = [
        "what medicine", "prescribe", "dose", "dosage", "diagnose", "my symptoms",
        "cure", "treatment for", "which tablet", "which antibiotic", "chest pain remedy",
        "stomach ache cure", "how to treat", "home remedy"
    ]
    is_diagnosis_query = any(kw in query_lower for kw in diagnosis_keywords)

    if is_diagnosis_query:
        # Fetch 3 major general/emergency facilities to recommend
        recommended = db.query(Facility).options(joinedload(Facility.facility_services)).filter(
            Facility.is_active == True
        ).limit(3).all()

        return CitizenAssistantResponse(
            answer=(
                "⚠️ **Important Healthcare Notice:**\n\n"
                "I am an informational assistant for government healthcare facility discovery. "
                "I **cannot** provide clinical medical diagnosis, treatment advice, or prescribe medications.\n\n"
                "If you or someone nearby is experiencing acute or serious symptoms, please consult a qualified healthcare professional "
                "at the nearest government hospital immediately, or dial **112** (National Emergency) or **108** (Ambulance Service)."
            ),
            recommended_facilities=recommended,
            disclaimer="Medical Safety Notice: Niramaya AI does not provide medical diagnoses or prescriptions. For emergencies call 112/108.",
            intent="MEDICAL_SAFETY_REDIRECT",
            sources_used=["PublicHealthcareCatalog", "EmergencyServices112"]
        )

    # 2. KEYWORD & SERVICE MATCHING
    facilities_query = db.query(Facility).options(joinedload(Facility.facility_services)).filter(
        Facility.is_active == True
    )

    # Service keyword mapping
    service_keywords = [
        "vaccination", "vaccine", "maternity", "delivery", "pregnancy",
        "emergency", "pediatric", "child", "children", "surgery", "operation",
        "icu", "general medicine", "pharmacy", "medicine", "lab", "laboratory",
        "dental", "first aid", "opd", "outpatient"
    ]
    matched_services = [s for s in service_keywords if s in query_lower]

    # Location / Facility name keywords
    location_keywords = ["pune", "mumbai", "solapur", "nashik", "delhi", "hospital", "clinic", "chc", "phc"]
    matched_locations = [l for l in location_keywords if l in query_lower]

    if matched_services:
        facilities_query = facilities_query.join(Facility.facility_services).filter(
            func.lower(FacilityService.service_name).contains(matched_services[0]),
            FacilityService.is_available == True
        )

    all_matching = facilities_query.all()
    
    # Python deduplication & distance calculation if coordinates provided
    candidate_facilities = []
    seen = set()
    for f in all_matching:
        if f.id in seen:
            continue
        seen.add(f.id)

        dist = None
        if request.lat is not None and request.lon is not None and f.latitude is not None and f.longitude is not None:
            dist = haversine(request.lat, request.lon, f.latitude, f.longitude)
        candidate_facilities.append((dist if dist is not None else 999999.0, f))

    candidate_facilities.sort(key=lambda x: x[0])
    recommended = [f for dist, f in candidate_facilities[:4]]

    # If no specific facilities matched, provide default active facilities
    if not recommended:
        recommended = db.query(Facility).options(joinedload(Facility.facility_services)).filter(
            Facility.is_active == True
        ).limit(4).all()

    # 3. CONSTRUCT GROUNDED PUBLIC FACTS (STRICTLY NO INVENTORY / ALERTS / INTERNAL DATA)
    public_facts = {
        "query": raw_query,
        "matched_services": matched_services,
        "facilities": [
            {
                "name": f.name,
                "type": f.type.value if hasattr(f.type, "value") else str(f.type),
                "location": f.location,
                "services": [s.service_name for s in f.facility_services if s.is_available] if f.facility_services else ["General OPD", "Emergency"]
            }
            for f in recommended
        ]
    }

    # 4. GENERATE GROUNDED ANSWER
    try:
        # Prompt Gemini with strict safety instructions
        prompt = (
            f"User Citizen Query: {raw_query}\n"
            f"Grounded Public Facilities in Government Network:\n"
            + "\n".join([
                f"- {f['name']} ({f['type']}) at {f['location']}. Services: {', '.join(f['services'])}"
                for f in public_facts["facilities"]
            ])
            + "\n\nProvide a friendly, helpful, and concise response to guide the citizen to appropriate public government healthcare facilities and services. "
            "Do NOT diagnose or give medical treatment advice. Mention available facilities and services clearly."
        )
        ai_generated_answer = gemini_service._call_gemini_raw(prompt) if not gemini_service.mock_mode else None
    except Exception:
        ai_generated_answer = None

    if not ai_generated_answer:
        # High quality grounded synthesis
        facilities_bullet = "\n".join([
            f"• **{f.name}** ({f.type.value if hasattr(f.type, 'value') else f.type})\n"
            f"  📍 *Location:* {f.location}\n"
            f"  🩺 *Available Services:* {', '.join([s.service_name for s in f.facility_services]) if f.facility_services else 'General Medicine, Emergency'}"
            for f in recommended
        ])

        service_str = f" offering **{matched_services[0].title()}**" if matched_services else ""
        ai_generated_answer = (
            f"Here are public government healthcare facilities{service_str} available in the network:\n\n"
            f"{facilities_bullet}\n\n"
            "You can click **Directions** on any facility card below to open real-time turn-by-turn navigation in Google Maps. "
            "For urgent medical emergencies, please call **112** or **108**."
        )

    return CitizenAssistantResponse(
        answer=ai_generated_answer,
        recommended_facilities=recommended,
        disclaimer="Public Healthcare Notice: This assistant provides public facility and service information only. Not a medical diagnosis tool. In emergency dial 112 or 108.",
        intent="FACILITY_SERVICE_DISCOVERY",
        sources_used=["PublicHealthcareCatalog", "GovernmentHealthDirectory"]
    )


