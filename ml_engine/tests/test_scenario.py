"""
Test suite for Emergency Scenario Simulation
"""

import pytest
from src.scenario import EmergencyScenarioSimulator


def test_scenario_multipliers():
    simulator = EmergencyScenarioSimulator()
    base_demand = 1000.0
    current_stock = 1200.0
    
    # 40% surge
    res_40 = simulator.simulate_scenario(
        normal_forecast_demand=base_demand,
        current_stock=current_stock,
        multiplier=1.40,
        horizon_days=7,
        min_stock=500
    )
    
    assert res_40["is_simulation"] is True
    assert res_40["simulated_forecast_demand"] == 1400.0
    assert res_40["current_stock_unmodified"] == 1200.0
    assert res_40["simulated_stock_cover_days"] < res_40["normal_stock_cover_days"]
    assert res_40["stock_cover_reduction_days"] > 0


def test_scenario_invalid_multiplier():
    simulator = EmergencyScenarioSimulator()
    with pytest.raises(ValueError):
        simulator.simulate_scenario(
            normal_forecast_demand=100,
            current_stock=100,
            multiplier=-0.5
        )
