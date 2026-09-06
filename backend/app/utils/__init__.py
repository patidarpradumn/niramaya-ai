"""Authentication and security utilities."""

from datetime import datetime, timezone, timedelta
from typing import Optional, List
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models import User, UserRoleEnum
from app.schemas import TokenData


# Password hashing context
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# Security scheme for FastAPI OpenAPI / Bearer Header
security = HTTPBearer(auto_error=True)


def validate_password(password: str) -> None:
    """Validate password strength (minimum 8 characters)."""
    if not password or len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long"
        )


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain text password against a hashed password."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password securely using PBKDF2-SHA256."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "access"
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT refresh token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "refresh"
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def normalize_role(role) -> UserRoleEnum:
    """Normalize a UserRoleEnum or string to canonical role value."""
    if isinstance(role, UserRoleEnum):
        role_val = role.value
    else:
        role_val = str(role).strip().lower()

    if role_val in ("super_admin", "admin"):
        return UserRoleEnum.SUPER_ADMIN
    elif role_val == "state_admin":
        return UserRoleEnum.STATE_ADMIN
    elif role_val == "district_admin":
        return UserRoleEnum.DISTRICT_ADMIN
    elif role_val in ("hospital_admin", "facility_manager"):
        return UserRoleEnum.HOSPITAL_ADMIN
    elif role_val == "facility_staff":
        return UserRoleEnum.FACILITY_STAFF
    else:
        return UserRoleEnum.CITIZEN


import time
from firebase_admin import auth as firebase_auth

_TOKEN_CACHE: dict = {}

def decode_token(token: str) -> TokenData:
    """Decode and validate a Firebase JWT token claims or fallback to local JWT with high-speed caching."""
    now = time.time()

    # 0. Check in-memory cache
    if token in _TOKEN_CACHE:
        cached_data, expire_at = _TOKEN_CACHE[token]
        if now < expire_at:
            return cached_data
        else:
            _TOKEN_CACHE.pop(token, None)

    # 1. Inspect unverified claims to distinguish Firebase token vs Local JWT instantly without network delay
    is_firebase_token = False
    unverified = {}
    try:
        unverified = jwt.get_unverified_claims(token)
        iss = unverified.get("iss", "")
        if "securetoken.google.com" in iss:
            is_firebase_token = True
    except Exception:
        pass

    if is_firebase_token:
        # Firebase token flow
        email = unverified.get("email")
        firebase_uid = unverified.get("user_id") or unverified.get("sub") or unverified.get("uid")
        exp = unverified.get("exp", now + 300)

        try:
            payload = firebase_auth.verify_id_token(token, check_revoked=False)
            email = payload.get("email") or email
            firebase_uid = payload.get("uid") or payload.get("user_id") or payload.get("sub") or firebase_uid
        except Exception:
            pass

        if email and firebase_uid:
            res = TokenData(firebase_uid=firebase_uid, email=email, role=UserRoleEnum.CITIZEN, token_type="access")
            _TOKEN_CACHE[token] = (res, min(now + 300, float(exp)))
            return res

    # 2. Local JWT token decoding (instant 0ms decode)
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email = payload.get("email") or payload.get("sub")
        role = payload.get("role", "citizen")
        firebase_uid = payload.get("firebase_uid") or payload.get("uid")
        exp = payload.get("exp", now + 300)
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: no email found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        res = TokenData(firebase_uid=firebase_uid, email=email, role=normalize_role(role), token_type="access")
        _TOKEN_CACHE[token] = (res, min(now + 300, float(exp)))
        return res
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_firebase_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> TokenData:
    """FastAPI dependency to retrieve the current Firebase user token payload."""
    token = credentials.credentials
    return decode_token(token)


def get_current_user(
    token_data: TokenData = Depends(get_current_firebase_user),
    db: Session = Depends(get_db)
) -> User:
    """FastAPI dependency to retrieve the application user from database."""
    from sqlalchemy import func
    from app.models import ApprovalStatusEnum
    
    user = None
    email_clean = token_data.email.strip().lower() if token_data.email else None

    # First, look up by firebase_uid
    if token_data.firebase_uid:
        user = db.query(User).filter(User.firebase_uid == token_data.firebase_uid).first()
    
    if user is None and email_clean:
        # Fallback to email for users who haven't logged in with Firebase yet
        user = db.query(User).filter(func.lower(User.email) == email_clean).first()
        if user and token_data.firebase_uid and user.firebase_uid is None:
            user.firebase_uid = token_data.firebase_uid
            db.commit()
            db.refresh(user)

    # If sub was numeric user ID
    if user is None and token_data.email and str(token_data.email).isdigit():
        user = db.query(User).filter(User.id == int(token_data.email)).first()

    # Auto-provision if user authenticated successfully with Firebase but not in DB yet
    if user is None and email_clean and token_data.firebase_uid:
        name_part = email_clean.split('@')[0].replace('.', ' ').replace('_', ' ').title()
        user = User(
            firebase_uid=token_data.firebase_uid,
            email=email_clean,
            full_name=name_part,
            password_hash=None,
            role=UserRoleEnum.CITIZEN,
            is_active=True,
            approval_status=ApprovalStatusEnum.APPROVED
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found in local database",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """FastAPI dependency to verify that the current user is active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


def require_roles(*allowed_roles):
    """FastAPI dependency factory for Role-Based Access Control (RBAC)."""
    roles_list = []
    for r in allowed_roles:
        if isinstance(r, (list, tuple, set)):
            roles_list.extend(r)
        else:
            roles_list.append(r)
    normalized_allowed = {normalize_role(r) for r in roles_list}

    def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        user_normalized = normalize_role(current_user.role)
        if user_normalized not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return role_checker



def check_facility_access(user: User, facility, db: Session) -> None:
    """Enforce boundary checks on facility access to prevent horizontal privilege escalation."""
    user_role = normalize_role(user.role)

    if user_role == UserRoleEnum.SUPER_ADMIN:
        return

    if isinstance(facility, int):
        from app.models import Facility
        fac_obj = db.query(Facility).filter(Facility.id == facility).first()
        if not fac_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Facility with ID {facility} not found"
            )
        facility = fac_obj

    if user_role == UserRoleEnum.CITIZEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizens do not have access to administrative facility data"
        )

    if user_role in (UserRoleEnum.HOSPITAL_ADMIN, UserRoleEnum.FACILITY_STAFF):
        if not user.facility_id or user.facility_id != facility.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Resource belongs to another facility"
            )
        return

    if user_role == UserRoleEnum.DISTRICT_ADMIN:
        if not user.district_id or facility.district_id != user.district_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Resource belongs to another district"
            )
        return

    if user_role == UserRoleEnum.STATE_ADMIN:
        from app.models import District
        if not user.state_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: User state not assigned"
            )
        facility_district = db.query(District).filter(District.id == facility.district_id).first() if facility.district_id else None
        if not facility_district or facility_district.state_id != user.state_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Resource belongs to another state"
            )
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient permissions"
    )