"""
Test suite for Redistribution Recommendation Engine
"""

import pytest
from src.redistribution import RedistributionEngine, haversine_distance


def test_haversine_distance():
    # Bhopal (23.2599, 77.4126) to Indore (22.7196, 75.8577) approx 170-190 km
    dist = haversine_distance(23.2599, 77.4126, 22.7196, 75.8577)
    assert 160 < dist < 200


def test_redistribution_surplus_to_deficit():
    engine = RedistributionEngine(max_transfer_distance_km=200, donor_safety_days=14)
    
    facility_states = [
        # Donor: FAC002 has 10,000 units, burn rate 50/day. Safe buffer = 500 + 700 = 1200. Surplus = 8800.
        {
            "facility_id": "FAC002",
            "name": "North Hospital",
            "latitude": 23.50,
            "longitude": 77.60,
            "current_stock": 10000,
            "daily_burn_rate": 50,
            "min_stock": 500,
            "stock_cover_days": 200,
            "risk_level": "LOW"
        },
        # Recipient: FAC001 has 100 units, burn rate 100/day. Deficit = 500 + 700 - 100 = 1100.
        {
            "facility_id": "FAC001",
            "name": "Central Hospital",
            "latitude": 23.26,
            "longitude": 77.41,
            "current_stock": 100,
            "daily_burn_rate": 100,
            "min_stock": 500,
            "stock_cover_days": 1.0,
            "risk_level": "CRITICAL"
        }
    ]
    
    res = engine.recommend_transfers(facility_states, resource_id="RES001", resource_name="Paracetamol 500mg")
    assert res["total_recommendations"] == 1
    rec = res["recommendations"][0]
    assert rec["source_facility_id"] == "FAC002"
    assert rec["destination_facility_id"] == "FAC001"
    assert rec["recommended_quantity"] > 0
    assert rec["requires_human_approval"] is True


def test_no_recommendation_when_no_surplus():
    engine = RedistributionEngine()
    # Both facilities in critical deficit
    facility_states = [
        {"facility_id": "FAC001", "current_stock": 50, "daily_burn_rate": 100, "min_stock": 500, "risk_level": "CRITICAL"},
        {"facility_id": "FAC002", "current_stock": 80, "daily_burn_rate": 80, "min_stock": 400, "risk_level": "CRITICAL"}
    ]
    res = engine.recommend_transfers(facility_states, resource_id="RES001")
    assert res["total_recommendations"] == 0
    assert len(res["recommendations"]) == 0
