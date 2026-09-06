from app.db.session import SessionLocal
from app.models import User, UserRoleEnum, Facility, State, District
from app.utils import get_password_hash

db = SessionLocal()
f1 = db.query(Facility).first()
state1 = db.query(State).first()
dist1 = db.query(District).first()

users_to_ensure = [
    {
        'email': 'patidarkartik1422@gmail.com',
        'full_name': 'Kartik Patidar',
        'role': UserRoleEnum.SUPER_ADMIN,
        'firebase_uid': '5gOxcYoHDxgChaazsEVbdvB6Kw72',
    },
    {
        'email': 'admin@mediguard.gov',
        'full_name': 'System Administrator',
        'role': UserRoleEnum.SUPER_ADMIN,
        'firebase_uid': None,
    },
    {
        'email': 'state.mh@niramaya.gov.in',
        'full_name': 'Maharashtra State Director',
        'role': UserRoleEnum.STATE_ADMIN,
        'state_id': state1.id if state1 else None,
        'firebase_uid': None,
    },
    {
        'email': 'district.pune@niramaya.gov.in',
        'full_name': 'Pune District Health Officer',
        'role': UserRoleEnum.DISTRICT_ADMIN,
        'state_id': state1.id if state1 else None,
        'district_id': dist1.id if dist1 else None,
        'firebase_uid': None,
    },
    {
        'email': 'manager@hospital.gov',
        'full_name': 'Hospital Admin',
        'role': UserRoleEnum.HOSPITAL_ADMIN,
        'facility_id': f1.id if f1 else None,
        'firebase_uid': None,
    },
    {
        'email': 'manager@centralhospital.gov',
        'full_name': 'Sarah Johnson',
        'role': UserRoleEnum.HOSPITAL_ADMIN,
        'facility_id': f1.id if f1 else None,
        'firebase_uid': None,
    },
    {
        'email': 'staff@clinic.gov',
        'full_name': 'Facility Staff User',
        'role': UserRoleEnum.FACILITY_STAFF,
        'facility_id': f1.id if f1 else None,
        'firebase_uid': None,
    },
    {
        'email': 'viewer@clinic.gov',
        'full_name': 'Emily Davis',
        'role': UserRoleEnum.CITIZEN,
        'facility_id': f1.id if f1 else None,
        'firebase_uid': None,
    },
]

for u in users_to_ensure:
    existing = db.query(User).filter(User.email == u['email']).first()
    if existing:
        existing.full_name = u['full_name']
        existing.role = u['role']
        if u.get('firebase_uid'):
            existing.firebase_uid = u['firebase_uid']
        if u.get('facility_id'):
            existing.facility_id = u['facility_id']
        if u.get('state_id'):
            existing.state_id = u['state_id']
        if u.get('district_id'):
            existing.district_id = u['district_id']
        print(f"Updated user: {u['email']}")
    else:
        new_u = User(
            email=u['email'],
            full_name=u['full_name'],
            role=u['role'],
            firebase_uid=u.get('firebase_uid'),
            facility_id=u.get('facility_id'),
            state_id=u.get('state_id'),
            district_id=u.get('district_id'),
            password_hash=get_password_hash('password123'),
            is_active=True
        )
        db.add(new_u)
        print(f"Created user: {u['email']}")

db.commit()
print("All users ensured successfully!")

print("\nCurrent users in database:")
for user in db.query(User).all():
    print(f"ID={user.id}, Email={user.email}, Role={user.role}, UID={user.firebase_uid}")

db.close()
