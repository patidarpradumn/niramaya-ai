"""
Test suite for Feature Engineering and Leakage Safety
"""

import pytest
import pandas as pd
import numpy as np
from src.preprocessing import load_and_preprocess_data
from src.features import build_features, verify_feature_leakage, FEATURE_COLUMNS


def test_build_features_shapes_and_columns():
    df_merged, _, _, _ = load_and_preprocess_data()
    df_feat = build_features(df_merged, is_training=True)
    
    assert not df_feat.empty
    for col in FEATURE_COLUMNS:
        assert col in df_feat.columns, f"Missing feature column: {col}"
    assert "quantity_consumed" in df_feat.columns
    # Check that there are no NaNs in feature columns for training set
    assert df_feat[FEATURE_COLUMNS].isnull().sum().sum() == 0


def test_feature_leakage_verification():
    df_merged, _, _, _ = load_and_preprocess_data()
    df_feat = build_features(df_merged, is_training=True)
    
    report = verify_feature_leakage(df_feat)
    assert report["leakage_safe"] is True, f"Leakage detected: {report['details']}"


def test_lag_values_strictly_previous():
    df_merged, _, _, _ = load_and_preprocess_data()
    # Filter single series
    single_series = df_merged[
        (df_merged["facility_id"] == "FAC001") & (df_merged["resource_id"] == "RES001")
    ].sort_values("date").reset_index(drop=True)
    
    single_feat = build_features(single_series, is_training=False)
    
    # Check day 30: lag_1 must match day 29 quantity_consumed
    assert single_feat.loc[30, "lag_1"] == single_series.loc[29, "quantity_consumed"]
    assert single_feat.loc[30, "lag_7"] == single_series.loc[23, "quantity_consumed"]
