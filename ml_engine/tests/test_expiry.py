"""
Test suite for Expiry Risk Assessment
"""

import pytest
from src.expiry import ExpiryRiskAnalyzer


def test_expired_batch_detection():
    analyzer = ExpiryRiskAnalyzer()
    batches = [
        {"batch_id": "BAT-001", "quantity": 100, "expiry_date": "2025-01-01"}
    ]
    res = analyzer.assess_batches(batches, daily_burn_rate=5.0, as_of_date_str="2025-01-10")
    assert res["overall_status"] == "CRITICAL_EXPIRED_PRESENT"
    assert res["expired_quantity"] == 100
    assert res["batches"][0]["status"] == "EXPIRED"


def test_near_expiry_excess_detection():
    analyzer = ExpiryRiskAnalyzer(warning_window_days=60)
    # 500 units expiring in 20 days. Daily burn rate is 5 units/day.
    # Expected consumption in 20 days is 100 units.
    # Potential excess = 400 units!
    batches = [
        {"batch_id": "BAT-002", "quantity": 500, "expiry_date": "2025-02-01"}
    ]
    res = analyzer.assess_batches(batches, daily_burn_rate=5.0, as_of_date_str="2025-01-12")
    assert res["overall_status"] == "WARNING_EXPIRY_EXCESS"
    assert res["at_risk_excess_quantity"] == 400.0
    assert res["batches"][0]["status"] == "EXCESS_EXPIRING"
    assert res["batches"][0]["recommended_action"] == "RECOMMEND_REDISTRIBUTION"


def test_safe_batch_consumption():
    analyzer = ExpiryRiskAnalyzer()
    # 200 units expiring in 300 days with daily burn rate of 10 units/day -> completely safe
    batches = [
        {"batch_id": "BAT-003", "quantity": 200, "expiry_date": "2025-11-01"}
    ]
    res = analyzer.assess_batches(batches, daily_burn_rate=10.0, as_of_date_str="2025-01-01")
    assert res["overall_status"] == "SAFE"
    assert res["at_risk_excess_quantity"] == 0.0
    assert res["batches"][0]["status"] == "SAFE"
