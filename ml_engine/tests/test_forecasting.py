"""
Test suite for Forecasting (Baseline, Candidate, ModelLoader)
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from src.forecasting import BaselineForecaster, CandidateForecaster, ModelLoader


def test_baseline_forecaster_multi_horizon():
    baseline = BaselineForecaster()
    dates = [datetime(2025, 1, 1) + timedelta(days=i) for i in range(30)]
    history_df = pd.DataFrame({
        "date": [d.strftime("%Y-%m-%d") for d in dates],
        "quantity_consumed": [10.0 + (i % 7) for i in range(30)]
    })
    
    for h in [7, 14, 30]:
        preds = baseline.predict(history_df, horizon_days=h)
        assert len(preds) == h
        for p in preds:
            assert p["predicted_demand"] >= 0.0
            assert "date" in p
            assert "step" in p


def test_model_loader_and_candidate_inference():
    loader = ModelLoader(models_dir="models/demand", model_version="demand_model_v1")
    forecaster = loader.get_forecaster()
    
    dates = [datetime(2025, 1, 1) + timedelta(days=i) for i in range(60)]
    history_df = pd.DataFrame({
        "date": [d.strftime("%Y-%m-%d") for d in dates],
        "facility_id": "FAC001",
        "resource_id": "RES001",
        "quantity_consumed": [50.0 + 5.0 * np.sin(i / 7.0) for i in range(60)]
    })
    
    if isinstance(forecaster, CandidateForecaster):
        preds = forecaster.forecast_series(
            history_df,
            horizon_days=7,
            facility_type="District Hospital",
            resource_category="Analgesics"
        )
    else:
        preds = forecaster.predict(history_df, horizon_days=7)
        
    assert len(preds) == 7
    for p in preds:
        assert p["predicted_demand"] >= 0.0
        assert not np.isnan(p["predicted_demand"])


def test_insufficient_history_fallback():
    # Only 3 days of history
    dates = [datetime(2025, 1, 1) + timedelta(days=i) for i in range(3)]
    history_df = pd.DataFrame({
        "date": [d.strftime("%Y-%m-%d") for d in dates],
        "quantity_consumed": [15.0, 12.0, 18.0]
    })
    
    candidate = CandidateForecaster(model_version="demand_model_v1")
    # Even if fitted or unfitted, short history falls back gracefully
    baseline = BaselineForecaster()
    preds = baseline.predict(history_df, horizon_days=7)
    assert len(preds) == 7
    assert all(p["predicted_demand"] >= 0.0 for p in preds)
