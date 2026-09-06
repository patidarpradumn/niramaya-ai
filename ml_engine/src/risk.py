"""
MediGuard AI - Stock-Out Risk Assessment Module
Provides deterministic, explainable stock-out risk scoring based on:
- Current inventory levels
- ML forecast demand & daily burn rate
- Supplier lead time
- Minimum safety stock and reorder thresholds
"""

import math
from typing import Dict, Any, List, Optional


class StockOutRiskAnalyzer:
    """Evaluates stock-out risk for healthcare facilities and resources."""

    def __init__(
        self,
        default_lead_time_days: int = 7,
        critical_cover_threshold_days: Optional[float] = None
    ):
        self.default_lead_time_days = default_lead_time_days
        self.critical_cover_threshold_days = critical_cover_threshold_days

    def assess_risk(
        self,
        current_stock: float,
        forecast_demand: float,
        horizon_days: int = 7,
        lead_time_days: Optional[int] = None,
        min_stock: float = 500,
        reorder_level: float = 1200
    ) -> Dict[str, Any]:
        """
        Computes explainable stock-out risk metrics and risk category.
        """
        lead_time = lead_time_days if lead_time_days is not None else self.default_lead_time_days
        current_stock = max(0.0, float(current_stock))
        forecast_demand = max(0.0, float(forecast_demand))
        horizon_days = max(1, int(horizon_days))
        
        # Calculate daily burn rate
        daily_burn_rate = round(forecast_demand / horizon_days, 2)
        
        # Stock cover in days
        if daily_burn_rate > 0:
            stock_cover_days = round(current_stock / daily_burn_rate, 1)
        else:
            stock_cover_days = 999.0 if current_stock > 0 else 0.0

        # Projected stock level at the time a new replenishment order would arrive
        demand_during_lead_time = daily_burn_rate * lead_time
        projected_stock_replenishment = round(current_stock - demand_during_lead_time, 2)
        
        # Projected deficit below minimum safety stock
        if projected_stock_replenishment < min_stock:
            projected_deficit = round(max(0.0, min_stock - projected_stock_replenishment), 2)
        else:
            projected_deficit = 0.0

        risk_factors: List[str] = []
        
        # Deterministic Risk Categorization
        if current_stock == 0:
            risk_level = "CRITICAL"
            risk_factors.append("Zero stock currently available at facility.")
        elif projected_stock_replenishment <= 0:
            risk_level = "CRITICAL"
            risk_factors.append(
                f"Projected stock will hit 0 in {stock_cover_days} days (before {lead_time}-day lead time replenishment)."
            )
        elif projected_stock_replenishment < min_stock:
            risk_level = "HIGH"
            risk_factors.append(
                f"Projected stock ({projected_stock_replenishment} units) breaches safety minimum ({min_stock} units)."
            )
        elif current_stock <= reorder_level or stock_cover_days < (2.5 * lead_time):
            risk_level = "MEDIUM"
            risk_factors.append(
                f"Stock is below reorder threshold ({reorder_level} units) with {stock_cover_days} days of cover."
            )
        else:
            risk_level = "LOW"
            risk_factors.append(
                f"Inventory is adequate ({stock_cover_days} days of cover vs {lead_time} days lead time)."
            )

        # Recommended order quantity (Order-up-to level: target 30 days cover + safety stock)
        target_inventory = (daily_burn_rate * 30.0) + min_stock
        recommended_order = max(0.0, target_inventory - current_stock) if risk_level in ["CRITICAL", "HIGH", "MEDIUM"] else 0.0

        return {
            "risk_level": risk_level,
            "stock_cover_days": stock_cover_days,
            "daily_burn_rate": daily_burn_rate,
            "current_stock": current_stock,
            "lead_time_days": lead_time,
            "projected_stock_before_replenishment": projected_stock_replenishment,
            "projected_deficit": projected_deficit,
            "min_stock": min_stock,
            "reorder_level": reorder_level,
            "reorder_recommended": risk_level in ["CRITICAL", "HIGH", "MEDIUM"],
            "recommended_order_quantity": round(recommended_order, 2),
            "risk_factors": risk_factors
        }
