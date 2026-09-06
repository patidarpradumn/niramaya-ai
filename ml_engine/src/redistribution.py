"""
MediGuard AI - Redistribution Recommendation Module
Generates intelligent, constrained resource transfer recommendations between surplus and deficit facilities:
- Preserves minimum safety buffers at donor facilities
- Computes real geodesic / Haversine distances
- Prioritizes critical deficit facilities and near-expiry donor batches
- Strictly provides recommendations requiring authorized human approval
"""

import math
from typing import Dict, Any, List, Optional
import pandas as pd


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two points in kilometers."""
    R = 6371.0 # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 1)


class RedistributionEngine:
    """Computes explainable resource transfer recommendations."""

    def __init__(self, max_transfer_distance_km: float = 300.0, donor_safety_days: float = 14.0):
        self.max_transfer_distance_km = max_transfer_distance_km
        self.donor_safety_days = donor_safety_days

    def recommend_transfers(
        self,
        facility_states: List[Dict[str, Any]],
        resource_id: str,
        resource_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyzes a list of facility inventory/demand states for a given resource.
        Each item in facility_states should contain:
        - facility_id
        - name
        - type
        - latitude
        - longitude
        - current_stock
        - daily_burn_rate
        - min_stock
        - stock_cover_days
        - risk_level (CRITICAL, HIGH, MEDIUM, LOW)
        - near_expiry_excess (optional)
        """
        donors = []
        recipients = []

        for fac in facility_states:
            current_stock = float(fac.get("current_stock", 0))
            burn_rate = float(fac.get("daily_burn_rate", 1.0))
            min_stock = float(fac.get("min_stock", 500))
            risk_level = fac.get("risk_level", "LOW")
            near_expiry_excess = float(fac.get("near_expiry_excess", 0))

            # Donor safety threshold: current_stock must exceed min_stock + (burn_rate * safety_days)
            donor_buffer = min_stock + (burn_rate * self.donor_safety_days)
            available_surplus = max(0.0, current_stock - donor_buffer)

            # If near-expiry excess is explicitly flagged, it is available for immediate transfer
            if near_expiry_excess > 0:
                available_surplus = max(available_surplus, near_expiry_excess)

            if available_surplus >= 50 and risk_level in ["LOW", "MEDIUM"]:
                donors.append({
                    **fac,
                    "available_surplus": available_surplus
                })

            if risk_level in ["CRITICAL", "HIGH"]:
                deficit = max(
                    100.0,
                    min_stock + (burn_rate * 7.0) - current_stock # Target 7 days buffer
                )
                recipients.append({
                    **fac,
                    "deficit": deficit
                })

        # Sort recipients by urgency (CRITICAL first, then highest deficit)
        recipients.sort(
            key=lambda r: (0 if r.get("risk_level") == "CRITICAL" else 1, -r["deficit"])
        )

        recommendations: List[Dict[str, Any]] = []

        for rec in recipients:
            if rec["deficit"] <= 0:
                continue

            # Candidate donors ordered by distance to this recipient
            candidate_donors = []
            for d in donors:
                if d["available_surplus"] <= 0 or d["facility_id"] == rec["facility_id"]:
                    continue
                dist = haversine_distance(
                    d.get("latitude", 0.0), d.get("longitude", 0.0),
                    rec.get("latitude", 0.0), rec.get("longitude", 0.0)
                )
                if dist <= self.max_transfer_distance_km:
                    candidate_donors.append((dist, d))

            candidate_donors.sort(key=lambda x: x[0]) # Shortest distance first

            for dist, donor in candidate_donors:
                if donor["available_surplus"] <= 0 or rec["deficit"] <= 0:
                    continue

                transfer_qty = min(donor["available_surplus"], rec["deficit"])
                transfer_qty = round(transfer_qty, 0)
                if transfer_qty < 10:
                    continue

                donor["available_surplus"] -= transfer_qty
                rec["deficit"] -= transfer_qty

                urgency = "HIGH" if rec.get("risk_level") == "CRITICAL" else "MEDIUM"
                res_title = resource_name or resource_id
                
                reason = (
                    f"Recipient {rec.get('name', rec['facility_id'])} is in {rec.get('risk_level')} stock-out risk "
                    f"({rec.get('stock_cover_days', 0)} days cover). Donor {donor.get('name', donor['facility_id'])} "
                    f"has sufficient surplus stock. Recommended transfer of {int(transfer_qty)} units over {dist} km."
                )

                recommendations.append({
                    "source_facility_id": donor["facility_id"],
                    "source_facility_name": donor.get("name", donor["facility_id"]),
                    "destination_facility_id": rec["facility_id"],
                    "destination_facility_name": rec.get("name", rec["facility_id"]),
                    "resource_id": resource_id,
                    "resource_name": res_title,
                    "recommended_quantity": int(transfer_qty),
                    "distance_km": dist,
                    "priority": urgency,
                    "reason": reason,
                    "requires_human_approval": True
                })

        return {
            "resource_id": resource_id,
            "total_recommendations": len(recommendations),
            "recommendations": recommendations,
            "notice": "All redistribution recommendations are non-autonomous and require human operational verification and approval."
        }
