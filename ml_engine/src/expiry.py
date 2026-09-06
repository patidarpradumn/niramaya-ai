"""
MediGuard AI - Expiry Risk Module
Analyzes inventory batches against predicted consumption rates to detect:
- Already expired batches
- Batches approaching expiry with excess quantity (cannot be consumed before expiry)
- Safe inventory batches
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
import pandas as pd


class ExpiryRiskAnalyzer:
    """Evaluates expiry risks at individual batch and aggregate facility levels."""

    def __init__(self, warning_window_days: int = 60):
        self.warning_window_days = warning_window_days

    def assess_batches(
        self,
        batches: List[Dict[str, Any]],
        daily_burn_rate: float,
        as_of_date_str: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Assesses a list of batch records for a specific resource at a facility.
        Each batch record must contain: batch_id, quantity, expiry_date, and optionally received_date.
        """
        if as_of_date_str:
            as_of_date = datetime.strptime(as_of_date_str, "%Y-%m-%d")
        else:
            as_of_date = datetime.now()

        daily_burn_rate = max(0.0, float(daily_burn_rate))
        
        batch_results = []
        total_stock = 0.0
        expired_quantity = 0.0
        at_risk_excess_quantity = 0.0
        safe_quantity = 0.0

        # Sort batches using FIFO / FEFO (First Expired First Out)
        sorted_batches = sorted(
            batches,
            key=lambda b: datetime.strptime(str(b["expiry_date"]), "%Y-%m-%d")
        )

        remaining_daily_rate = daily_burn_rate
        # Track cumulative expected consumption over time
        cumulative_consumed = 0.0
        prev_days = 0

        for b in sorted_batches:
            b_id = b.get("batch_id", "UNKNOWN")
            qty = max(0.0, float(b.get("quantity", 0)))
            exp_date_str = str(b.get("expiry_date", ""))
            exp_dt = datetime.strptime(exp_date_str, "%Y-%m-%d")
            
            days_to_expiry = (exp_dt - as_of_date).days
            total_stock += qty

            if days_to_expiry <= 0:
                status = "EXPIRED"
                excess_qty = qty
                expired_quantity += qty
                action = "QUARANTINE_AND_DISPOSE"
            else:
                # FEFO consumption projection
                incremental_days = max(0, days_to_expiry - prev_days)
                potential_consumption_in_window = daily_burn_rate * days_to_expiry
                
                # How much can be consumed before this batch expires
                max_usable = max(0.0, potential_consumption_in_window - cumulative_consumed)
                usable_from_this_batch = min(qty, max_usable)
                excess_qty = max(0.0, qty - usable_from_this_batch)
                
                cumulative_consumed += usable_from_this_batch
                prev_days = days_to_expiry

                if days_to_expiry <= self.warning_window_days:
                    if excess_qty > 0:
                        status = "EXCESS_EXPIRING"
                        at_risk_excess_quantity += excess_qty
                        action = "RECOMMEND_REDISTRIBUTION"
                    else:
                        status = "APPROACHING_EXPIRY"
                        safe_quantity += qty
                        action = "PRIORITIZE_DISPENSING"
                else:
                    if excess_qty > 0:
                        status = "POTENTIAL_FUTURE_EXCESS"
                        at_risk_excess_quantity += excess_qty
                        action = "MONITOR_CONSUMPTION"
                    else:
                        status = "SAFE"
                        safe_quantity += qty
                        action = "NORMAL_STORAGE"

            batch_results.append({
                "batch_id": b_id,
                "quantity": qty,
                "expiry_date": exp_date_str,
                "days_to_expiry": days_to_expiry,
                "status": status,
                "potential_excess_quantity": round(excess_qty, 2),
                "recommended_action": action
            })

        overall_status = "SAFE"
        if expired_quantity > 0:
            overall_status = "CRITICAL_EXPIRED_PRESENT"
        elif at_risk_excess_quantity > 0:
            overall_status = "WARNING_EXPIRY_EXCESS"
        elif any(b["status"] == "APPROACHING_EXPIRY" for b in batch_results):
            overall_status = "APPROACHING_EXPIRY"

        return {
            "overall_status": overall_status,
            "as_of_date": as_of_date.strftime("%Y-%m-%d"),
            "daily_burn_rate": daily_burn_rate,
            "total_stock": round(total_stock, 2),
            "expired_quantity": round(expired_quantity, 2),
            "at_risk_excess_quantity": round(at_risk_excess_quantity, 2),
            "safe_quantity": round(safe_quantity, 2),
            "batches": batch_results
        }
