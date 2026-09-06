"""Comprehensive seed script for Niramaya AI PostgreSQL Database (Supabase)."""

from datetime import datetime, timezone, timedelta
from app.db.session import SessionLocal, init_db
from app.models import (
    State, District, Facility, Item, Inventory, Equipment, 
    Alert, Recommendation, User, UserRoleEnum, ApprovalStatusEnum,
    AlertSeverityEnum, AlertStatusEnum, FacilityTypeEnum, EquipmentStatusEnum,
    RecommendationStatusEnum, RiskCategoryEnum
)
from app.utils import get_password_hash

def seed_database():
    print("--- Initializing Supabase PostgreSQL Schema ---")
    init_db()
    
    db = SessionLocal()
    try:
        # 1. STATES
        print("1. Seeding States...")
        mh = db.query(State).filter(State.name == "Maharashtra").first()
        if not mh:
            mh = State(name="Maharashtra", code="MH")
            db.add(mh)
        
        dl = db.query(State).filter(State.name == "Delhi").first()
        if not dl:
            dl = State(name="Delhi", code="DL")
            db.add(dl)
            
        ka = db.query(State).filter(State.name == "Karnataka").first()
        if not ka:
            ka = State(name="Karnataka", code="KA")
            db.add(ka)
            
        db.commit()
        db.refresh(mh)
        db.refresh(dl)
        db.refresh(ka)

        # 2. DISTRICTS
        print("2. Seeding Districts...")
        districts_data = [
            ("Mumbai", mh.id),
            ("Pune", mh.id),
            ("Nagpur", mh.id),
            ("South Delhi", dl.id),
            ("Bangalore Urban", ka.id),
        ]
        
        district_map = {}
        for d_name, s_id in districts_data:
            d = db.query(District).filter(District.name == d_name, District.state_id == s_id).first()
            if not d:
                d = District(name=d_name, state_id=s_id)
                db.add(d)
                db.commit()
                db.refresh(d)
            district_map[d_name] = d

        # 3. FACILITIES
        print("3. Seeding Facilities...")
        facilities_data = [
            ("KEM Hospital Mumbai", "Parel, Mumbai", FacilityTypeEnum.HOSPITAL, district_map["Mumbai"].id, 18.9984, 72.8427),
            ("Sion Hospital Mumbai", "Sion, Mumbai", FacilityTypeEnum.HOSPITAL, district_map["Mumbai"].id, 19.0330, 72.8600),
            ("Pune District Hospital", "Aundh, Pune", FacilityTypeEnum.DISTRICT_HOSPITAL, district_map["Pune"].id, 18.5590, 73.8073),
            ("National Resource Center", "Shivajinagar, Pune", FacilityTypeEnum.WAREHOUSE, district_map["Pune"].id, 18.5314, 73.8446),
            ("Nagpur Civil Hospital", "Sitabuldi, Nagpur", FacilityTypeEnum.CIVIL_HOSPITAL, district_map["Nagpur"].id, 21.1458, 79.0882),
            ("AIIMS New Delhi", "Ansari Nagar, New Delhi", FacilityTypeEnum.HOSPITAL, district_map["South Delhi"].id, 28.5672, 77.2100),
        ]

        facility_map = {}
        for f_name, f_loc, f_type, d_id, lat, lon in facilities_data:
            f = db.query(Facility).filter(Facility.name == f_name).first()
            if not f:
                f = Facility(
                    name=f_name,
                    location=f_loc,
                    type=f_type,
                    district_id=d_id,
                    latitude=lat,
                    longitude=lon,
                    is_active=True
                )
                db.add(f)
                db.commit()
                db.refresh(f)
            facility_map[f_name] = f

        # 4. ITEMS / MEDICINES
        print("4. Seeding Medicines & Medical Items...")
        items_data = [
            ("Paracetamol 500mg", "MED-001", "Analgesics / Antipyretics", "Tablets", 100),
            ("Amoxicillin 500mg", "MED-002", "Antibiotics", "Capsules", 50),
            ("Insulin Glargine 100IU/ml", "MED-003", "Endocrinology", "Vials", 20),
            ("Azithromycin 500mg", "MED-004", "Antibiotics", "Tablets", 40),
            ("Medical Oxygen Cylinders", "MED-005", "Emergency Supply", "Cylinders", 10),
            ("Surgical Gloves (Size 7.5)", "MED-006", "Surgical Consumables", "Pairs", 500),
            ("Normal Saline 0.9% 500ml", "MED-007", "IV Fluids", "Bottles", 200),
            ("N95 Respirator Masks", "MED-008", "PPE", "Pieces", 300),
        ]

        item_map = {}
        for i_name, i_code, i_cat, i_unit, i_min in items_data:
            item = db.query(Item).filter(Item.name == i_name).first()
            if not item:
                item = Item(name=i_name, code=i_code, category=i_cat, unit=i_unit, description=f"Standard medical grade {i_name}")
                db.add(item)
                db.commit()
                db.refresh(item)
            item_map[i_name] = item

        # 5. INVENTORY
        print("5. Seeding Inventory Stock...")
        kem = facility_map["KEM Hospital Mumbai"]
        pune = facility_map["Pune District Hospital"]
        nrc = facility_map["National Resource Center"]

        inventory_configs = [
            (kem.id, item_map["Paracetamol 500mg"].id, 450, 200, 2000, 45),
            (kem.id, item_map["Medical Oxygen Cylinders"].id, 4, 15, 60, 180), # Critical stock
            (kem.id, item_map["Insulin Glargine 100IU/ml"].id, 18, 50, 300, 20), # Near expiry
            (pune.id, item_map["Paracetamol 500mg"].id, 120, 300, 1500, 90), # Low stock
            (pune.id, item_map["Amoxicillin 500mg"].id, 650, 100, 800, 120),
            (nrc.id, item_map["Medical Oxygen Cylinders"].id, 85, 20, 100, 365), # Surplus available
            (nrc.id, item_map["Paracetamol 500mg"].id, 5000, 500, 10000, 300), # Surplus
        ]

        now = datetime.now(timezone.utc)
        for fac_id, itm_id, cur_stock, min_t, max_t, exp_days in inventory_configs:
            inv = db.query(Inventory).filter(Inventory.facility_id == fac_id, Inventory.item_id == itm_id).first()
            exp_date = now + timedelta(days=exp_days)
            if not inv:
                inv = Inventory(
                    facility_id=fac_id,
                    item_id=itm_id,
                    current_stock=cur_stock,
                    min_threshold=min_t,
                    max_threshold=max_t,
                    expiry_date=exp_date,
                    batch_number=f"BATCH-{fac_id}-{itm_id}-2026",
                    unit="Units"
                )
                db.add(inv)
            else:
                inv.current_stock = cur_stock
                inv.min_threshold = min_t
                inv.max_threshold = max_t
                inv.expiry_date = exp_date

        db.commit()

        # 6. EQUIPMENT
        print("6. Seeding Hospital Equipment...")
        equip_data = [
            ("Ventilator Dräger Evita V500", "Critical Care / ICU", kem.id, EquipmentStatusEnum.OPERATIONAL),
            ("Siemens 1.5T MRI Scanner", "Radiology / Imaging", kem.id, EquipmentStatusEnum.OPERATIONAL),
            ("Philips Defibrillator HeartStart", "Emergency Ward", pune.id, EquipmentStatusEnum.UNDER_MAINTENANCE),
            ("High Pressure Autoclave 200L", "Sterilization / OT", pune.id, EquipmentStatusEnum.OPERATIONAL),
            ("Biphasic Dialysis Machine", "Nephrology", kem.id, EquipmentStatusEnum.NON_FUNCTIONAL),
        ]

        for eq_name, eq_cat, fac_id, eq_stat in equip_data:
            eq = db.query(Equipment).filter(Equipment.name == eq_name, Equipment.facility_id == fac_id).first()
            if not eq:
                eq = Equipment(
                    name=eq_name,
                    equipment_type=eq_cat,
                    facility_id=fac_id,
                    status=eq_stat,
                    serial_number=f"SN-{fac_id}-{eq_name[:4].upper()}-99",
                    downtime_hours=0.0
                )
                db.add(eq)
        db.commit()

        # 7. ALERTS
        print("7. Seeding Active System Alerts...")
        existing_alerts = db.query(Alert).count()
        if existing_alerts == 0:
            db.add_all([
                Alert(
                    facility_id=kem.id,
                    severity=AlertSeverityEnum.CRITICAL,
                    status=AlertStatusEnum.ACTIVE,
                    risk_category=RiskCategoryEnum.STOCK_OUT,
                    title="Critical Oxygen Shortage Detected",
                    description="Medical Oxygen Cylinder count is 4 (below threshold 15). Immediate stockout risk within 24h.",
                    acknowledged=False,
                    created_at=now - timedelta(hours=2)
                ),
                Alert(
                    facility_id=kem.id,
                    severity=AlertSeverityEnum.HIGH,
                    status=AlertStatusEnum.ACTIVE,
                    risk_category=RiskCategoryEnum.EXPIRY,
                    title="Batch Expiry Risk: Insulin Glargine",
                    description="18 vials of Insulin Glargine are expiring in 20 days. Recommended redistribution to Pune District Hospital.",
                    acknowledged=False,
                    created_at=now - timedelta(hours=5)
                ),
                Alert(
                    facility_id=pune.id,
                    severity=AlertSeverityEnum.MEDIUM,
                    status=AlertStatusEnum.ACTIVE,
                    risk_category=RiskCategoryEnum.STOCK_OUT,
                    title="Low Stock: Paracetamol 500mg",
                    description="Current stock at 120 units against minimum threshold 300 units.",
                    acknowledged=False,
                    created_at=now - timedelta(hours=8)
                )
            ])
            db.commit()

        # 8. RECOMMENDATIONS
        print("8. Seeding AI Redistribution Recommendations...")
        existing_recs = db.query(Recommendation).count()
        if existing_recs == 0:
            db.add_all([
                Recommendation(
                    facility_id=kem.id,
                    source_facility_id=nrc.id,
                    destination_facility_id=kem.id,
                    item_id=item_map["Medical Oxygen Cylinders"].id,
                    title="Emergency Stock Balancing: Medical Oxygen",
                    action_type="TRANSFER",
                    suggested_quantity=20,
                    status=RecommendationStatusEnum.PENDING,
                    reasoning="Urgent supply balancing: KEM Mumbai critically low on Oxygen while Pune NRC has surplus reserve.",
                    created_at=now - timedelta(hours=3)
                ),
                Recommendation(
                    facility_id=pune.id,
                    source_facility_id=nrc.id,
                    destination_facility_id=pune.id,
                    item_id=item_map["Paracetamol 500mg"].id,
                    title="Buffer Restock: Paracetamol 500mg",
                    action_type="TRANSFER",
                    suggested_quantity=300,
                    status=RecommendationStatusEnum.PENDING,
                    reasoning="Routine buffer restock to prevent Pune District Hospital stockout.",
                    created_at=now - timedelta(hours=6)
                )
            ])
            db.commit()

        # 9. USERS (ALL ROLES)
        print("9. Seeding Core Users & Role Accounts...")
        pwhash = get_password_hash("password123")
        users_to_seed = [
            {
                "email": "patidarkartik1422@gmail.com",
                "full_name": "Kartik Patidar",
                "role": UserRoleEnum.SUPER_ADMIN,
                "firebase_uid": "5gOxcYoHDxgChaazsEVbdvB6Kw72",
            },
            {
                "email": "admin@mediguard.gov",
                "full_name": "System Administrator",
                "role": UserRoleEnum.SUPER_ADMIN,
                "firebase_uid": None,
            },
            {
                "email": "state.mh@niramaya.gov.in",
                "full_name": "Maharashtra State Director",
                "role": UserRoleEnum.STATE_ADMIN,
                "state_id": mh.id,
                "firebase_uid": None,
            },
            {
                "email": "district.pune@niramaya.gov.in",
                "full_name": "Pune District Health Officer",
                "role": UserRoleEnum.DISTRICT_ADMIN,
                "state_id": mh.id,
                "district_id": district_map["Pune"].id,
                "firebase_uid": None,
            },
            {
                "email": "manager@hospital.gov",
                "full_name": "Hospital Admin",
                "role": UserRoleEnum.HOSPITAL_ADMIN,
                "facility_id": kem.id,
                "firebase_uid": None,
            },
            {
                "email": "staff@clinic.gov",
                "full_name": "Facility Staff User",
                "role": UserRoleEnum.FACILITY_STAFF,
                "facility_id": kem.id,
                "firebase_uid": None,
            },
            {
                "email": "viewer@clinic.gov",
                "full_name": "Citizen User",
                "role": UserRoleEnum.CITIZEN,
                "firebase_uid": None,
            },
        ]

        for u in users_to_seed:
            user_obj = db.query(User).filter(User.email == u["email"]).first()
            if user_obj:
                user_obj.full_name = u["full_name"]
                user_obj.role = u["role"]
                if u.get("firebase_uid"):
                    user_obj.firebase_uid = u["firebase_uid"]
                if u.get("state_id"):
                    user_obj.state_id = u["state_id"]
                if u.get("district_id"):
                    user_obj.district_id = u["district_id"]
                if u.get("facility_id"):
                    user_obj.facility_id = u["facility_id"]
                user_obj.approval_status = ApprovalStatusEnum.APPROVED
            else:
                user_obj = User(
                    email=u["email"],
                    full_name=u["full_name"],
                    role=u["role"],
                    firebase_uid=u.get("firebase_uid"),
                    state_id=u.get("state_id"),
                    district_id=u.get("district_id"),
                    facility_id=u.get("facility_id"),
                    password_hash=pwhash,
                    is_active=True,
                    approval_status=ApprovalStatusEnum.APPROVED
                )
                db.add(user_obj)

        db.commit()
        print("[SUCCESS] ALL SUPABASE DATA SEEDED SUCCESSFULLY!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
