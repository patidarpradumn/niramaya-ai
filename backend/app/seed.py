"""Database seed script for development and testing."""

import random
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.db.session import SessionLocal, init_db
from app.models import (
    Role, State, District, Facility, FacilityService, User, Item, Inventory,
    StockMovement, ConsumptionRecord, Equipment, MaintenanceRecord,
    Prediction, Risk, Alert, Recommendation, Transfer, ApprovalAction, AuditLog,
    UserRoleEnum, FacilityTypeEnum, AlertSeverityEnum, StockMovementTypeEnum,
    EquipmentStatusEnum, RiskStatusEnum, RecommendationStatusEnum, TransferStatusEnum
)
from app.utils import get_password_hash


def seed_database():
    """Seed the database with initial development data for all models."""
    init_db()
    db: Session = SessionLocal()

    try:
        if db.query(User).first():
            print("Database already seeded, skipping...")
            return

        print("Seeding database across all 19 core models...")

        # 1. Roles
        admin_role = Role(name="admin", description="System Administrator with full access")
        manager_role = Role(name="facility_manager", description="Healthcare Facility Manager")
        viewer_role = Role(name="viewer", description="Read-only access for reporting")
        db.add_all([admin_role, manager_role, viewer_role])
        db.commit()

        # 2. States & Districts
        state_ca = State(name="California", code="CA")
        state_tx = State(name="Texas", code="TX")
        db.add_all([state_ca, state_tx])
        db.commit()

        dist_central = District(state_id=state_ca.id, name="Central District")
        dist_north = District(state_id=state_ca.id, name="North District")
        dist_east = District(state_id=state_tx.id, name="East District")
        db.add_all([dist_central, dist_north, dist_east])
        db.commit()

        # 3. Facilities
        f1 = Facility(
            district_id=dist_central.id,
            name="Central City Hospital",
            location="100 Main St, Downtown",
            type=FacilityTypeEnum.HOSPITAL,
            contact_email="admin@centralhospital.gov",
            contact_phone="+1-555-0100",
            is_active=True
        )
        f2 = Facility(
            district_id=dist_north.id,
            name="Northside Medical Center",
            location="500 North Ave, Suburbs",
            type=FacilityTypeEnum.HOSPITAL,
            contact_email="info@northsidemedical.gov",
            contact_phone="+1-555-0101",
            is_active=True
        )
        f3 = Facility(
            district_id=dist_east.id,
            name="Regional Warehouse Alpha",
            location="Industrial Park Way",
            type=FacilityTypeEnum.WAREHOUSE,
            contact_email="warehouse@regional.gov",
            contact_phone="+1-555-0102",
            is_active=True
        )
        f4 = Facility(
            district_id=dist_north.id,
            name="Community Clinic North",
            location="12 Community Rd",
            type=FacilityTypeEnum.CLINIC,
            contact_email="clinic@northcommunity.gov",
            contact_phone="+1-555-0103",
            is_active=True
        )
        db.add_all([f1, f2, f3, f4])
        db.commit()

        # 4. Facility Services
        fs1 = FacilityService(facility_id=f1.id, service_name="Emergency Care", is_available=True)
        fs2 = FacilityService(facility_id=f1.id, service_name="ICU", is_available=True)
        fs3 = FacilityService(facility_id=f2.id, service_name="Outpatient Pharmacy", is_available=True)
        db.add_all([fs1, fs2, fs3])
        db.commit()

        # 5. Users
        admin_user = User(
            email="admin@mediguard.gov",
            password_hash=get_password_hash("admin123"),
            full_name="System Administrator",
            role_id=admin_role.id,
            role=UserRoleEnum.ADMIN,
            facility_id=None
        )
        manager_user = User(
            email="manager@centralhospital.gov",
            password_hash=get_password_hash("manager123"),
            full_name="Sarah Johnson",
            role_id=manager_role.id,
            role=UserRoleEnum.FACILITY_MANAGER,
            facility_id=f1.id
        )
        viewer_user = User(
            email="viewer@clinic.gov",
            password_hash=get_password_hash("viewer123"),
            full_name="Emily Davis",
            role_id=viewer_role.id,
            role=UserRoleEnum.VIEWER,
            facility_id=f4.id
        )
        db.add_all([admin_user, manager_user, viewer_user])
        db.commit()

        # 6. Items
        item1 = Item(name="Paracetamol 500mg", code="MED-001", category="Medications", unit="tablets", description="Analgesic medication")
        item2 = Item(name="Amoxicillin 250mg", code="MED-002", category="Medications", unit="tablets", description="Antibiotic medication")
        item3 = Item(name="Surgical Gloves (Box)", code="CON-001", category="Consumables", unit="boxes", description="Sterile surgical gloves")
        item4 = Item(name="IV Solution 1L", code="CON-002", category="Consumables", unit="liters", description="Saline IV solution")
        item5 = Item(name="Digital Thermometer", code="EQP-001", category="Equipment", unit="units", description="Digital thermometer unit")
        db.add_all([item1, item2, item3, item4, item5])
        db.commit()

        # 7. Inventory
        inv1 = Inventory(facility_id=f1.id, item_id=item1.id, current_stock=150, min_threshold=30, max_threshold=300)
        inv2 = Inventory(facility_id=f1.id, item_id=item3.id, current_stock=5, min_threshold=20, max_threshold=100)
        inv3 = Inventory(facility_id=f2.id, item_id=item4.id, current_stock=8, min_threshold=15, max_threshold=80)
        inv4 = Inventory(facility_id=f3.id, item_id=item3.id, current_stock=500, min_threshold=50, max_threshold=1000)
        db.add_all([inv1, inv2, inv3, inv4])
        db.commit()

        # 8. Stock Movements & Consumption Records
        sm1 = StockMovement(facility_id=f1.id, item_id=item1.id, movement_type=StockMovementTypeEnum.INBOUND, quantity=100, reference="PO-2026-001", created_by_user_id=manager_user.id)
        cr1 = ConsumptionRecord(facility_id=f1.id, item_id=item1.id, quantity_consumed=25, record_date=datetime.now(timezone.utc) - timedelta(days=1))
        db.add_all([sm1, cr1])
        db.commit()

        # 9. Equipment & Maintenance Records
        eq1 = Equipment(facility_id=f1.id, name="Ventilator Model X", serial_number="SN-VEN-991", status=EquipmentStatusEnum.OPERATIONAL)
        db.add(eq1)
        db.commit()

        mr1 = MaintenanceRecord(equipment_id=eq1.id, performed_by="BioMed Tech Services", description="Routine quarterly inspection and calibration", cost=150.0, maintenance_date=datetime.now(timezone.utc) - timedelta(days=10))
        db.add(mr1)
        db.commit()

        # 10. Prediction, Risk, Alert, Recommendation
        pred1 = Prediction(facility_id=f1.id, item_id=item3.id, predicted_demand=45, confidence=0.88, predicted_date=datetime.now(timezone.utc) + timedelta(days=14))
        db.add(pred1)
        db.commit()

        risk1 = Risk(facility_id=f1.id, item_id=item3.id, prediction_id=pred1.id, risk_type="STOCKOUT_RISK", severity=AlertSeverityEnum.CRITICAL, description="High stockout risk expected within 14 days based on predicted consumption", status=RiskStatusEnum.ACTIVE)
        db.add(risk1)
        db.commit()

        alert1 = Alert(facility_id=f1.id, item_id=item3.id, prediction_id=pred1.id, severity=AlertSeverityEnum.CRITICAL, title="Critical Stock Alert - Surgical Gloves", description="Stock level is 5 boxes, well below min threshold of 20.", acknowledged=False)
        db.add(alert1)
        db.commit()

        rec1 = Recommendation(facility_id=f1.id, item_id=item3.id, prediction_id=pred1.id, risk_id=risk1.id, title="Stock Transfer Recommendation", action_type="TRANSFER", suggested_quantity=50, reasoning="Transfer 50 boxes from Regional Warehouse Alpha", status=RecommendationStatusEnum.PENDING)
        db.add(rec1)
        db.commit()

        # 11. Transfer & Approval Action
        tr1 = Transfer(source_facility_id=f3.id, destination_facility_id=f1.id, item_id=item3.id, quantity=50, status=TransferStatusEnum.PENDING)
        db.add(tr1)
        db.commit()

        app1 = ApprovalAction(transfer_id=tr1.id, user_id=manager_user.id, action="SUBMIT", notes="Submitted stock transfer request to cover shortage.")
        db.add(app1)
        db.commit()

        # 12. Audit Log
        al1 = AuditLog(user_id=admin_user.id, action="SEED_DATABASE", entity_type="System", entity_id=0, details="Development database seeded successfully.")
        db.add(al1)
        db.commit()

        print("Database seeded successfully across all 19 models!")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()