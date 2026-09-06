"""
MediGuard AI - Synthetic Data Generator
Generates realistic public healthcare supply chain and consumption data with:
- Facility hierarchies (District Hospital, CHC, PHC)
- Diverse medical resource categories (Antibiotics, Analgesics, Vaccines, etc.)
- Weekly and monthly seasonality, trends, outbreaks/spikes
- Realistic inventory batches with near-expiry, surplus, and shortage cases
- Fixed random seed for complete reproducibility
"""

import os
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Tuple


def get_facility_definitions() -> List[Dict]:
    """Returns definitions for 20 public healthcare facilities."""
    facilities = [
        # District Hospitals (High capacity, Central hubs)
        {"facility_id": "FAC001", "name": "Central District Hospital", "type": "District Hospital", "district_id": "DIST01", "state_id": "STATE01", "latitude": 23.2599, "longitude": 77.4126, "capacity": 300, "active_status": True},
        {"facility_id": "FAC002", "name": "North District Hospital", "type": "District Hospital", "district_id": "DIST02", "state_id": "STATE01", "latitude": 23.5000, "longitude": 77.6000, "capacity": 250, "active_status": True},
        {"facility_id": "FAC003", "name": "South District Hospital", "type": "District Hospital", "district_id": "DIST03", "state_id": "STATE01", "latitude": 22.9500, "longitude": 77.3000, "capacity": 200, "active_status": True},
        {"facility_id": "FAC004", "name": "East Regional Hospital", "type": "District Hospital", "district_id": "DIST04", "state_id": "STATE01", "latitude": 23.1000, "longitude": 78.1000, "capacity": 220, "active_status": True},
        
        # Community Health Centres (CHCs - Moderate capacity)
        {"facility_id": "FAC005", "name": "Berasia CHC", "type": "CHC", "district_id": "DIST01", "state_id": "STATE01", "latitude": 23.6333, "longitude": 77.4333, "capacity": 50, "active_status": True},
        {"facility_id": "FAC006", "name": "Sehore CHC", "type": "CHC", "district_id": "DIST01", "state_id": "STATE01", "latitude": 23.2000, "longitude": 77.0800, "capacity": 60, "active_status": True},
        {"facility_id": "FAC007", "name": "Raisen CHC", "type": "CHC", "district_id": "DIST02", "state_id": "STATE01", "latitude": 23.3300, "longitude": 77.7800, "capacity": 55, "active_status": True},
        {"facility_id": "FAC008", "name": "Vidisha CHC", "type": "CHC", "district_id": "DIST02", "state_id": "STATE01", "latitude": 23.5200, "longitude": 77.8100, "capacity": 50, "active_status": True},
        {"facility_id": "FAC009", "name": "Hoshangabad CHC", "type": "CHC", "district_id": "DIST03", "state_id": "STATE01", "latitude": 22.7500, "longitude": 77.7200, "capacity": 45, "active_status": True},
        {"facility_id": "FAC010", "name": "Itarsi CHC", "type": "CHC", "district_id": "DIST03", "state_id": "STATE01", "latitude": 22.6100, "longitude": 77.7600, "capacity": 50, "active_status": True},
        {"facility_id": "FAC011", "name": "Sagar CHC", "type": "CHC", "district_id": "DIST04", "state_id": "STATE01", "latitude": 23.8300, "longitude": 78.7100, "capacity": 50, "active_status": True},
        {"facility_id": "FAC012", "name": "Damoh CHC", "type": "CHC", "district_id": "DIST04", "state_id": "STATE01", "latitude": 23.8300, "longitude": 79.4400, "capacity": 40, "active_status": True},
        
        # Primary Health Centres (PHCs - Peripheral clinics)
        {"facility_id": "FAC013", "name": "Kolar PHC", "type": "PHC", "district_id": "DIST01", "state_id": "STATE01", "latitude": 23.1800, "longitude": 77.4200, "capacity": 10, "active_status": True},
        {"facility_id": "FAC014", "name": "Phanda PHC", "type": "PHC", "district_id": "DIST01", "state_id": "STATE01", "latitude": 23.2200, "longitude": 77.2500, "capacity": 12, "active_status": True},
        {"facility_id": "FAC015", "name": "Gairatganj PHC", "type": "PHC", "district_id": "DIST02", "state_id": "STATE01", "latitude": 23.4000, "longitude": 78.2000, "capacity": 10, "active_status": True},
        {"facility_id": "FAC016", "name": "Silwani PHC", "type": "PHC", "district_id": "DIST02", "state_id": "STATE01", "latitude": 23.3000, "longitude": 78.4300, "capacity": 8, "active_status": True},
        {"facility_id": "FAC017", "name": "Babai PHC", "type": "PHC", "district_id": "DIST03", "state_id": "STATE01", "latitude": 22.7000, "longitude": 77.9300, "capacity": 10, "active_status": True},
        {"facility_id": "FAC018", "name": "Sohagpur PHC", "type": "PHC", "district_id": "DIST03", "state_id": "STATE01", "latitude": 22.6900, "longitude": 78.2000, "capacity": 10, "active_status": True},
        {"facility_id": "FAC019", "name": "Rehli PHC", "type": "PHC", "district_id": "DIST04", "state_id": "STATE01", "latitude": 23.6300, "longitude": 79.0800, "capacity": 12, "active_status": True},
        {"facility_id": "FAC020", "name": "Banda PHC", "type": "PHC", "district_id": "DIST04", "state_id": "STATE01", "latitude": 24.0400, "longitude": 78.9600, "capacity": 10, "active_status": True},
    ]
    return facilities


def get_resource_definitions() -> List[Dict]:
    """Returns definitions for 25 essential medical resources across categories."""
    resources = [
        # Analgesics / Antipyretics
        {"resource_id": "RES001", "name": "Paracetamol 500mg", "category": "Analgesics", "unit": "Tablets", "min_stock": 2000, "reorder_level": 5000, "shelf_life_days": 730, "base_demand": 120, "season_type": "monsoon_fever"},
        {"resource_id": "RES002", "name": "Ibuprofen 400mg", "category": "Analgesics", "unit": "Tablets", "min_stock": 1000, "reorder_level": 2500, "shelf_life_days": 730, "base_demand": 50, "season_type": "none"},
        {"resource_id": "RES003", "name": "Diclofenac 50mg", "category": "Analgesics", "unit": "Tablets", "min_stock": 800, "reorder_level": 2000, "shelf_life_days": 730, "base_demand": 40, "season_type": "winter_joint"},
        
        # Antibiotics
        {"resource_id": "RES004", "name": "Amoxicillin 500mg", "category": "Antibiotics", "unit": "Capsules", "min_stock": 1500, "reorder_level": 4000, "shelf_life_days": 730, "base_demand": 90, "season_type": "winter_respiratory"},
        {"resource_id": "RES005", "name": "Azithromycin 500mg", "category": "Antibiotics", "unit": "Tablets", "min_stock": 1000, "reorder_level": 2500, "shelf_life_days": 730, "base_demand": 60, "season_type": "winter_respiratory"},
        {"resource_id": "RES006", "name": "Ceftriaxone 1g Injection", "category": "Antibiotics", "unit": "Vials", "min_stock": 500, "reorder_level": 1200, "shelf_life_days": 730, "base_demand": 35, "season_type": "monsoon_fever"},
        {"resource_id": "RES007", "name": "Ciprofloxacin 500mg", "category": "Antibiotics", "unit": "Tablets", "min_stock": 800, "reorder_level": 2000, "shelf_life_days": 730, "base_demand": 45, "season_type": "monsoon_waterborne"},
        {"resource_id": "RES008", "name": "Doxycycline 100mg", "category": "Antibiotics", "unit": "Capsules", "min_stock": 600, "reorder_level": 1500, "shelf_life_days": 730, "base_demand": 30, "season_type": "monsoon_vector"},

        # Gastrointestinal / Dehydration
        {"resource_id": "RES009", "name": "ORS (Oral Rehydration Salts)", "category": "Gastrointestinal", "unit": "Sachets", "min_stock": 2500, "reorder_level": 6000, "shelf_life_days": 730, "base_demand": 140, "season_type": "summer_monsoon_diarrhea"},
        {"resource_id": "RES010", "name": "Zinc Sulphate 20mg", "category": "Gastrointestinal", "unit": "Tablets", "min_stock": 1000, "reorder_level": 2500, "shelf_life_days": 730, "base_demand": 50, "season_type": "summer_monsoon_diarrhea"},
        {"resource_id": "RES011", "name": "Pantoprazole 40mg", "category": "Gastrointestinal", "unit": "Tablets", "min_stock": 1200, "reorder_level": 3000, "shelf_life_days": 730, "base_demand": 70, "season_type": "none"},
        {"resource_id": "RES012", "name": "Metronidazole 400mg", "category": "Gastrointestinal", "unit": "Tablets", "min_stock": 800, "reorder_level": 2000, "shelf_life_days": 730, "base_demand": 40, "season_type": "monsoon_waterborne"},

        # Respiratory
        {"resource_id": "RES013", "name": "Salbutamol Inhaler 100mcg", "category": "Respiratory", "unit": "Inhalers", "min_stock": 300, "reorder_level": 800, "shelf_life_days": 730, "base_demand": 25, "season_type": "winter_respiratory"},
        {"resource_id": "RES014", "name": "Cetirizine 10mg", "category": "Respiratory", "unit": "Tablets", "min_stock": 1500, "reorder_level": 3500, "shelf_life_days": 730, "base_demand": 80, "season_type": "spring_autumn_allergy"},

        # Chronic / Cardiovascular / Diabetes
        {"resource_id": "RES015", "name": "Metformin 500mg", "category": "Chronic Disease", "unit": "Tablets", "min_stock": 2000, "reorder_level": 5000, "shelf_life_days": 730, "base_demand": 110, "season_type": "none"},
        {"resource_id": "RES016", "name": "Amlodipine 5mg", "category": "Chronic Disease", "unit": "Tablets", "min_stock": 1800, "reorder_level": 4500, "shelf_life_days": 730, "base_demand": 100, "season_type": "none"},
        {"resource_id": "RES017", "name": "Atenolol 50mg", "category": "Chronic Disease", "unit": "Tablets", "min_stock": 1000, "reorder_level": 2500, "shelf_life_days": 730, "base_demand": 55, "season_type": "none"},
        {"resource_id": "RES018", "name": "Insulin Human Regular 40IU/ml", "category": "Chronic Disease", "unit": "Vials", "min_stock": 200, "reorder_level": 500, "shelf_life_days": 540, "base_demand": 20, "season_type": "none"},

        # Maternal & Child Health
        {"resource_id": "RES019", "name": "Oxytocin 10IU Injection", "category": "Maternal Health", "unit": "Ampoules", "min_stock": 400, "reorder_level": 1000, "shelf_life_days": 540, "base_demand": 25, "season_type": "none"},
        {"resource_id": "RES020", "name": "Iron & Folic Acid Tablets", "category": "Maternal Health", "unit": "Tablets", "min_stock": 2500, "reorder_level": 6000, "shelf_life_days": 730, "base_demand": 130, "season_type": "none"},

        # Emergency & Critical Care
        {"resource_id": "RES021", "name": "Rabies Vaccine (PVRV)", "category": "Emergency & Vaccines", "unit": "Vials", "min_stock": 150, "reorder_level": 400, "shelf_life_days": 540, "base_demand": 15, "season_type": "summer_dogbite"},
        {"resource_id": "RES022", "name": "Anti-Snake Venom Serum", "category": "Emergency & Vaccines", "unit": "Vials", "min_stock": 100, "reorder_level": 250, "shelf_life_days": 730, "base_demand": 8, "season_type": "monsoon_snakebite"},
        {"resource_id": "RES023", "name": "Normal Saline 0.9% 500ml", "category": "IV Fluids", "unit": "Bottles", "min_stock": 1200, "reorder_level": 3000, "shelf_life_days": 730, "base_demand": 75, "season_type": "summer_heat"},
        {"resource_id": "RES024", "name": "Ringer Lactate 500ml", "category": "IV Fluids", "unit": "Bottles", "min_stock": 1000, "reorder_level": 2500, "shelf_life_days": 730, "base_demand": 65, "season_type": "summer_heat"},
        {"resource_id": "RES025", "name": "Artemether + Lumefantrine", "category": "Antimalarials", "unit": "Tablets", "min_stock": 500, "reorder_level": 1200, "shelf_life_days": 730, "base_demand": 25, "season_type": "monsoon_vector"},
    ]
    return resources


def calculate_seasonal_multiplier(season_type: str, day_of_year: int, month: int) -> float:
    """Calculates realistic seasonal demand modifier based on climate/disease epidemiology."""
    if season_type == "none":
        return 1.0
    
    # Monsoon: June (6) to September (9) (days ~152 to ~273)
    if season_type == "monsoon_fever":
        if 6 <= month <= 9:
            return 1.45 + 0.15 * np.sin((day_of_year - 150) / 120 * np.pi)
        return 0.90
    
    # Winter respiratory: November (11) to February (2)
    if season_type == "winter_respiratory":
        if month in [11, 12, 1, 2]:
            return 1.55 + 0.10 * np.cos((day_of_year - 15) / 90 * np.pi)
        return 0.85
    
    # Summer dehydration / heat: April (4) to June (6)
    if season_type in ["summer_monsoon_diarrhea", "summer_heat"]:
        if 4 <= month <= 8:
            return 1.50 + 0.20 * np.sin((day_of_year - 90) / 150 * np.pi)
        return 0.80
    
    # Waterborne / Vector (Monsoon spike)
    if season_type in ["monsoon_waterborne", "monsoon_vector", "monsoon_snakebite"]:
        if 7 <= month <= 10:
            return 1.60 + 0.25 * np.sin((day_of_year - 180) / 100 * np.pi)
        return 0.75
    
    if season_type == "winter_joint":
        if month in [12, 1, 2]:
            return 1.30
        return 0.95
    
    if season_type == "spring_autumn_allergy":
        if month in [3, 4, 9, 10]:
            return 1.35
        return 0.90
        
    if season_type == "summer_dogbite":
        if 4 <= month <= 7:
            return 1.30
        return 0.95
        
    return 1.0


def generate_synthetic_data(
    start_date_str: str = "2025-01-01",
    num_days: int = 365,
    random_seed: int = 42,
    output_dir: str = "data/synthetic"
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Generates all 5 synthetic datasets:
    1. Facility master
    2. Resource master
    3. Consumption (365 days)
    4. Inventory batch
    5. Supply
    """
    np.random.seed(random_seed)
    random.seed(random_seed)
    
    # 1. Facility Master
    facilities_raw = get_facility_definitions()
    df_facilities = pd.DataFrame(facilities_raw)
    
    # 2. Resource Master
    resources_raw = get_resource_definitions()
    df_resources = pd.DataFrame(resources_raw)
    
    # Drop helper fields from clean master dataframe
    df_resources_clean = df_resources.drop(columns=["base_demand", "season_type"])
    
    # 3. Consumption Generation
    start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
    date_list = [start_date + timedelta(days=i) for i in range(num_days)]
    
    # Facility capacity scaling factor
    facility_scale_map = {
        "District Hospital": 2.2,
        "CHC": 1.0,
        "PHC": 0.35
    }
    
    # Individual facility variance
    facility_rand_bias = {f["facility_id"]: np.random.uniform(0.85, 1.15) for f in facilities_raw}
    
    # Specific known outbreak scenario for realistic evaluation
    # FAC001 (District Hospital) experienced a Dengue/Fever surge in August (Days 215-245)
    # FAC006 (CHC) experienced a diarrheal surge in June (Days 160-180)
    
    consumption_records = []
    
    for d_idx, dt in enumerate(date_list):
        day_of_week = dt.weekday() # 0 = Mon, 6 = Sun
        month = dt.month
        day_of_year = dt.timetuple().tm_yday
        date_str = dt.strftime("%Y-%m-%d")
        
        # Day of week factor (OPD busy Mon-Fri, lighter Sat, minimal Sun except emergency)
        dow_factor = 1.15 if day_of_week == 0 else (1.08 if day_of_week in [1, 2, 3] else (0.95 if day_of_week == 4 else (0.80 if day_of_week == 5 else 0.55)))
        
        # Gradual trend (2% annual growth)
        trend_factor = 1.0 + (0.04 * (d_idx / num_days))
        
        for f in facilities_raw:
            f_id = f["facility_id"]
            f_type = f["type"]
            f_scale = facility_scale_map[f_type] * facility_rand_bias[f_id]
            
            for r in resources_raw:
                r_id = r["resource_id"]
                base_dem = r["base_demand"]
                s_type = r["season_type"]
                
                # Seasonality multiplier
                s_mult = calculate_seasonal_multiplier(s_type, day_of_year, month)
                
                # Emergency resource day-of-week damping (emergencies happen 24/7)
                effective_dow = 0.9 + 0.1 * dow_factor if r["category"] in ["Emergency & Vaccines", "IV Fluids"] else dow_factor
                
                mean_demand = base_dem * f_scale * s_mult * effective_dow * trend_factor
                
                # Outbreak spikes
                if f_id == "FAC001" and r_id in ["RES001", "RES006", "RES023"] and (215 <= day_of_year <= 245):
                    mean_demand *= 1.85 # Dengue outbreak spike
                elif f_id == "FAC006" and r_id in ["RES009", "RES010", "RES012"] and (160 <= day_of_year <= 180):
                    mean_demand *= 2.10 # Gastroenteritis outbreak spike
                elif f_id == "FAC003" and r_id in ["RES004", "RES013"] and (330 <= day_of_year <= 360):
                    mean_demand *= 1.75 # Winter smog respiratory surge
                    
                # Sample with negative binomial / Poisson variance
                # Add random noise
                noise = np.random.normal(1.0, 0.12)
                qty = int(max(0, np.round(np.random.poisson(max(0.1, mean_demand * noise)))))
                
                consumption_records.append({
                    "date": date_str,
                    "facility_id": f_id,
                    "resource_id": r_id,
                    "quantity_consumed": qty
                })
                
    df_consumption = pd.DataFrame(consumption_records)
    
    # 4. Inventory Batch Generation (Realistic Current Stock & Expiries)
    # Based on latest date (end of 365-day year, e.g. 2025-12-31)
    as_of_date = date_list[-1]
    inventory_records = []
    
    batch_counter = 1001
    
    for f in facilities_raw:
        f_id = f["facility_id"]
        f_scale = facility_scale_map[f["type"]]
        
        for r in resources_raw:
            r_id = r["resource_id"]
            daily_avg = r["base_demand"] * f_scale
            
            # Setup specific realistic edge cases for demo scenarios:
            # Scenario 1: FAC001 + RES001 (Paracetamol) -> High demand, Critical low stock (shortage)
            # Scenario 2: FAC002 + RES001 (Paracetamol) -> High surplus stock
            # Scenario 4: FAC003 + RES021 (Rabies) -> Low demand, Near-expiry surplus batch
            
            if f_id == "FAC001" and r_id == "RES001":
                # Critical shortage: Only 300 units left (~1.2 days cover)
                inventory_records.append({
                    "facility_id": f_id,
                    "resource_id": r_id,
                    "batch_id": f"BAT-{batch_counter}",
                    "quantity": 300,
                    "received_date": (as_of_date - timedelta(days=60)).strftime("%Y-%m-%d"),
                    "expiry_date": (as_of_date + timedelta(days=240)).strftime("%Y-%m-%d")
                })
                batch_counter += 1
                
            elif f_id == "FAC002" and r_id == "RES001":
                # Large surplus: 18,000 units (~60+ days cover)
                inventory_records.append({
                    "facility_id": f_id,
                    "resource_id": r_id,
                    "batch_id": f"BAT-{batch_counter}",
                    "quantity": 10000,
                    "received_date": (as_of_date - timedelta(days=30)).strftime("%Y-%m-%d"),
                    "expiry_date": (as_of_date + timedelta(days=365)).strftime("%Y-%m-%d")
                })
                batch_counter += 1
                inventory_records.append({
                    "facility_id": f_id,
                    "resource_id": r_id,
                    "batch_id": f"BAT-{batch_counter}",
                    "quantity": 8000,
                    "received_date": (as_of_date - timedelta(days=15)).strftime("%Y-%m-%d"),
                    "expiry_date": (as_of_date + timedelta(days=400)).strftime("%Y-%m-%d")
                })
                batch_counter += 1
                
            elif f_id == "FAC003" and r_id == "RES021":
                # Near-expiry excess: 350 vials of Rabies vaccine expiring in 25 days, daily avg is only ~3 vials
                inventory_records.append({
                    "facility_id": f_id,
                    "resource_id": r_id,
                    "batch_id": f"BAT-{batch_counter}",
                    "quantity": 350,
                    "received_date": (as_of_date - timedelta(days=500)).strftime("%Y-%m-%d"),
                    "expiry_date": (as_of_date + timedelta(days=25)).strftime("%Y-%m-%d")
                })
                batch_counter += 1
                
            elif f_id == "FAC007" and r_id == "RES006":
                # Expired batch test case: 50 vials expired 5 days ago
                inventory_records.append({
                    "facility_id": f_id,
                    "resource_id": r_id,
                    "batch_id": f"BAT-{batch_counter}",
                    "quantity": 50,
                    "received_date": (as_of_date - timedelta(days=700)).strftime("%Y-%m-%d"),
                    "expiry_date": (as_of_date - timedelta(days=5)).strftime("%Y-%m-%d")
                })
                batch_counter += 1
                # And a fresh active batch
                inventory_records.append({
                    "facility_id": f_id,
                    "resource_id": r_id,
                    "batch_id": f"BAT-{batch_counter}",
                    "quantity": int(daily_avg * 20),
                    "received_date": (as_of_date - timedelta(days=20)).strftime("%Y-%m-%d"),
                    "expiry_date": (as_of_date + timedelta(days=300)).strftime("%Y-%m-%d")
                })
                batch_counter += 1
                
            else:
                # Standard realistic stock: 1 to 2 batches, total ~15-35 days of stock
                num_batches = np.random.choice([1, 2], p=[0.6, 0.4])
                target_stock = int(daily_avg * np.random.uniform(14, 32))
                target_stock = max(10, target_stock)
                
                if num_batches == 1:
                    exp_days = np.random.randint(120, 550)
                    rec_days = np.random.randint(10, 90)
                    inventory_records.append({
                        "facility_id": f_id,
                        "resource_id": r_id,
                        "batch_id": f"BAT-{batch_counter}",
                        "quantity": target_stock,
                        "received_date": (as_of_date - timedelta(days=rec_days)).strftime("%Y-%m-%d"),
                        "expiry_date": (as_of_date + timedelta(days=exp_days)).strftime("%Y-%m-%d")
                    })
                    batch_counter += 1
                else:
                    q1 = int(target_stock * 0.4)
                    q2 = target_stock - q1
                    inventory_records.append({
                        "facility_id": f_id,
                        "resource_id": r_id,
                        "batch_id": f"BAT-{batch_counter}",
                        "quantity": q1,
                        "received_date": (as_of_date - timedelta(days=120)).strftime("%Y-%m-%d"),
                        "expiry_date": (as_of_date + timedelta(days=np.random.randint(45, 150))).strftime("%Y-%m-%d")
                    })
                    batch_counter += 1
                    inventory_records.append({
                        "facility_id": f_id,
                        "resource_id": r_id,
                        "batch_id": f"BAT-{batch_counter}",
                        "quantity": q2,
                        "received_date": (as_of_date - timedelta(days=20)).strftime("%Y-%m-%d"),
                        "expiry_date": (as_of_date + timedelta(days=np.random.randint(200, 600))).strftime("%Y-%m-%d")
                    })
                    batch_counter += 1
                    
    df_inventory = pd.DataFrame(inventory_records)
    
    # 5. Supply Master / Procurement Records
    suppliers = [
        {"supplier_id": "SUP001", "name": "Apex Pharma Ltd", "reliability": 0.95},
        {"supplier_id": "SUP002", "name": "Bharat Bio-Health", "reliability": 0.90},
        {"supplier_id": "SUP003", "name": "National Med Supplies", "reliability": 0.92},
        {"supplier_id": "SUP004", "name": "Lifeline IV & Criticals", "reliability": 0.88},
    ]
    
    unit_price_map = {
        "RES001": 0.40, "RES002": 0.60, "RES003": 0.50, "RES004": 2.50, "RES005": 6.00,
        "RES006": 12.00, "RES007": 3.00, "RES008": 1.50, "RES009": 0.30, "RES010": 0.40,
        "RES011": 1.80, "RES012": 0.80, "RES013": 8.50, "RES014": 0.35, "RES015": 0.70,
        "RES016": 0.65, "RES017": 0.55, "RES018": 15.00, "RES019": 4.50, "RES020": 0.20,
        "RES021": 25.00, "RES022": 45.00, "RES023": 1.20, "RES024": 1.40, "RES025": 4.00,
    }
    
    supply_records = []
    # Generate 150 historical supply purchase orders over the year
    for po_id in range(1, 151):
        sup = np.random.choice(suppliers)
        res = np.random.choice(resources_raw)
        r_id = res["resource_id"]
        order_day = np.random.randint(10, num_days - 30)
        o_date = date_list[order_day]
        lead_time = int(np.random.choice([3, 5, 7, 10, 14], p=[0.2, 0.35, 0.25, 0.15, 0.05]))
        d_date = o_date + timedelta(days=lead_time)
        qty = int(res["base_demand"] * np.random.uniform(50, 200))
        
        supply_records.append({
            "resource_id": r_id,
            "supplier_id": sup["supplier_id"],
            "quantity": qty,
            "order_date": o_date.strftime("%Y-%m-%d"),
            "delivery_date": d_date.strftime("%Y-%m-%d"),
            "lead_time_days": lead_time,
            "unit_price": unit_price_map.get(r_id, 2.00)
        })
        
    df_supply = pd.DataFrame(supply_records)
    
    # Save to output_dir
    os.makedirs(output_dir, exist_ok=True)
    df_facilities.to_csv(os.path.join(output_dir, "facility_master.csv"), index=False)
    df_resources_clean.to_csv(os.path.join(output_dir, "resource_master.csv"), index=False)
    df_consumption.to_csv(os.path.join(output_dir, "consumption.csv"), index=False)
    df_inventory.to_csv(os.path.join(output_dir, "inventory_batch.csv"), index=False)
    df_supply.to_csv(os.path.join(output_dir, "supply.csv"), index=False)
    
    print(f"Synthetic data generation complete in '{output_dir}'.")
    print(f"- Facilities: {len(df_facilities)} rows")
    print(f"- Resources: {len(df_resources_clean)} rows")
    print(f"- Consumption: {len(df_consumption)} rows (20 facilities x 25 resources x {num_days} days)")
    print(f"- Inventory Batches: {len(df_inventory)} rows")
    print(f"- Supply Orders: {len(df_supply)} rows")
    
    return df_facilities, df_resources_clean, df_consumption, df_inventory, df_supply


if __name__ == "__main__":
    generate_synthetic_data()
