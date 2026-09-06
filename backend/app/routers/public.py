import math
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.models import Facility, FacilityTypeEnum, FacilityService
from app.schemas import PublicFacilityResponse, PaginatedPublicFacilityResponse

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
    Get a paginated list of public facilities.
    """
    query = db.query(Facility).filter(Facility.is_active == True)

    if type:
        query = query.filter(Facility.type == type)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Facility.name.ilike(search_term)) | 
            (Facility.location.ilike(search_term))
        )
        
    if service:
        query = query.join(Facility.facility_services).filter(
            FacilityService.service_name.ilike(f"%{service}%"),
            FacilityService.is_available == True
        )

    total = query.count()
    pages = (total + size - 1) // size
    items = query.order_by(Facility.name).offset((page - 1) * size).limit(size).all()

    return {
        "items": items,
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
    # Bounding box filter for quick SQL filtering
    lat_diff = radius / 111.0
    # Safe division for lon_diff, max out if close to poles
    cos_lat = math.cos(math.radians(lat))
    if cos_lat > 0:
        lon_diff = radius / (111.0 * cos_lat)
    else:
        lon_diff = 180.0 # fallback

    query = db.query(Facility).filter(
        Facility.is_active == True,
        Facility.latitude.isnot(None),
        Facility.longitude.isnot(None),
        Facility.latitude.between(lat - lat_diff, lat + lat_diff),
        Facility.longitude.between(lon - lon_diff, lon + lon_diff)
    )

    if type:
        query = query.filter(Facility.type == type)
        
    if service:
        query = query.join(Facility.facility_services).filter(
            FacilityService.service_name.ilike(f"%{service}%"),
            FacilityService.is_available == True
        )

    candidates = query.all()
    
    # Python-side haversine filtering and sorting
    nearby_facilities = []
    for f in candidates:
        if f.latitude is not None and f.longitude is not None:
            dist = haversine(lat, lon, f.latitude, f.longitude)
            if dist <= radius:
                # Attach distance temporarily for sorting
                nearby_facilities.append((dist, f))
                
    nearby_facilities.sort(key=lambda x: x[0])
    
    # Pagination
    total = len(nearby_facilities)
    pages = (total + size - 1) // size
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
    facility = db.query(Facility).filter(
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
    List all available public services.
    """
    services = db.query(FacilityService.service_name).filter(
        FacilityService.is_available == True
    ).distinct().order_by(FacilityService.service_name).all()
    
    return [s[0] for s in services]
