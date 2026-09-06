"""
Test suite for Stock-Out Risk Analyzer
"""

import pytest
from src.risk import StockOutRiskAnalyzer


def test_critical_risk_on_zero_or_immediate_stockout():
    analyzer = StockOutRiskAnalyzer(default_lead_time_days=7)
    
    # Stock is 50, forecast demand for 7 days is 700 (daily burn = 100).
    # Stock covers 0.5 days. Lead time is 7 days. -> CRITICAL
    res = analyzer.assess_risk(current_stock=50, forecast_demand=700, horizon_days=7, lead_time_days=7, min_stock=200)
    assert res["risk_level"] == "CRITICAL"
    assert res["stock_cover_days"] == 0.5
    assert res["reorder_recommended"] is True
    assert res["projected_stock_before_replenishment"] < 0


def test_high_risk_on_safety_breach():
    analyzer = StockOutRiskAnalyzer()
    # Stock is 800, 7-day demand is 700 (burn = 100/day).
    # Lead time = 7 days. Demand in lead time = 700. Stock before replenishment = 100.
    # Min stock is 500. So 100 < 500 -> HIGH risk.
    res = analyzer.assess_risk(current_stock=800, forecast_demand=700, horizon_days=7, lead_time_days=7, min_stock=500)
    assert res["risk_level"] == "HIGH"
    assert res["projected_deficit"] == 400.0


def test_low_risk_on_healthy_stock():
    analyzer = StockOutRiskAnalyzer()
    # Stock is 5000, 7-day demand is 700 (burn = 100/day).
    # Lead time = 7 days. Stock cover is 50 days. Reorder level is 2000.
    res = analyzer.assess_risk(current_stock=5000, forecast_demand=700, horizon_days=7, lead_time_days=7, min_stock=500, reorder_level=2000)
    assert res["risk_level"] == "LOW"
    assert res["reorder_recommended"] is False
    assert res["stock_cover_days"] == 50.0
