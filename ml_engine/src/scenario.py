"""
MediGuard AI - Emergency Scenario Simulation Module
Simulates public health surge events (epidemics, natural disasters, mass casualty) by:
- Applying stress demand multipliers (+20%, +40%, +60%, +100%)
- Recalculating stock-out risk and stock cover days under stress
- Strictly isolating simulation outputs without modifying actual physical inventory
"""

from typing import Dict, Any, List, Optional
from src.risk import StockOutRiskAnalyzer


SUPPORTED_SCENARIO_MULTIPLIERS = {
    "mild_surge_20": 1.20,
    "moderate_outbreak_40": 1.40,
    "severe_epidemic_60": 1.60,
    "critical_emergency_100": 2.00
}


class EmergencyScenarioSimulator:
    """Simulates demand stress scenarios for disaster and surge preparedness."""

    def __init__(self):
        self.risk_analyzer = StockOutRiskAnalyzer()

    def simulate_scenario(
        self,
        normal_forecast_demand: float,
        current_stock: float,
        multiplier: float,
        horizon_days: int = 7,
        lead_time_days: int = 7,
        min_stock: float = 500,
        reorder_level: float = 1200,
        scenario_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Runs a simulation on demand forecast and evaluates stress impact on stock resilience.
        """
        multiplier = float(multiplier)
        if multiplier <= 0:
            raise ValueError("Scenario multiplier must be positive.")
            
        simulated_demand = round(normal_forecast_demand * multiplier, 2)
        
        # Assess normal risk
        normal_risk = self.risk_analyzer.assess_risk(
            current_stock=current_stock,
            forecast_demand=normal_forecast_demand,
            horizon_days=horizon_days,
            lead_time_days=lead_time_days,
            min_stock=min_stock,
            reorder_level=reorder_level
        )
        
        # Assess simulated surge risk
        simulated_risk = self.risk_analyzer.assess_risk(
            current_stock=current_stock,
            forecast_demand=simulated_demand,
            horizon_days=horizon_days,
            lead_time_days=lead_time_days,
            min_stock=min_stock,
            reorder_level=reorder_level
        )
        
        cover_delta = round(normal_risk["stock_cover_days"] - simulated_risk["stock_cover_days"], 1)
        additional_deficit = round(max(0.0, simulated_risk["projected_deficit"] - normal_risk["projected_deficit"]), 2)

        return {
            "is_simulation": True,
            "scenario_name": scenario_name or f"Demand Surge (+{int((multiplier - 1.0) * 100)}%)",
            "demand_multiplier": multiplier,
            "horizon_days": horizon_days,
            "current_stock_unmodified": current_stock,
            "normal_forecast_demand": normal_forecast_demand,
            "simulated_forecast_demand": simulated_demand,
            "normal_risk_level": normal_risk["risk_level"],
            "simulated_risk_level": simulated_risk["risk_level"],
            "normal_stock_cover_days": normal_risk["stock_cover_days"],
            "simulated_stock_cover_days": simulated_risk["stock_cover_days"],
            "stock_cover_reduction_days": cover_delta,
            "additional_deficit_created": additional_deficit,
            "simulated_risk_assessment": simulated_risk,
            "disclaimer": "SIMULATION ONLY: Physical inventory and baseline databases remain completely unaltered."
        }
