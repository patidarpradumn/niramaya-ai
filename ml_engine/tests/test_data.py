"""
Test suite for Synthetic Data Generation and Validation
"""

import pytest
import os
import pandas as pd
from src.data_generator import generate_synthetic_data
from src.validation import DataValidator


def test_data_generation_and_validation(tmp_path):
    out_dir = str(tmp_path / "test_data")
    df_fac, df_res, df_con, df_inv, df_sup = generate_synthetic_data(
        start_date_str="2025-01-01",
        num_days=90,
        random_seed=123,
        output_dir=out_dir
    )
    
    assert len(df_fac) == 20
    assert len(df_res) == 25
    assert len(df_con) == 20 * 25 * 90
    assert len(df_inv) > 0
    assert len(df_sup) > 0
    
    validator = DataValidator(data_dir=out_dir)
    report = validator.validate_all()
    assert report["overall_valid"] is True, f"Validation errors: {report.get('errors')}"


def test_validation_catches_negative_values():
    validator = DataValidator()
    df_con = pd.DataFrame([{
        "date": "2025-01-01",
        "facility_id": "FAC001",
        "resource_id": "RES001",
        "quantity_consumed": -10
    }])
    df_fac = pd.DataFrame([{"facility_id": "FAC001", "name": "F1", "type": "CHC", "district_id": "D1", "state_id": "S1", "latitude": 20.0, "longitude": 75.0, "capacity": 10, "active_status": True}])
    df_res = pd.DataFrame([{"resource_id": "RES001", "name": "R1", "category": "Analgesics", "unit": "Tablets", "min_stock": 100, "reorder_level": 200, "shelf_life_days": 365}])
    
    report = validator.validate_all(
        df_facilities=df_fac,
        df_resources=df_res,
        df_consumption=df_con
    )
    assert report["overall_valid"] is False
    assert any("Negative" in e for e in report["errors"])
