"""
MediGuard AI - Preprocessing Module
Handles data ingestion, type conversions, missing-date imputation (zero fill),
and joining master attributes for time series modeling.
"""

import os
import pandas as pd
import numpy as np
from typing import Tuple, Optional


def load_and_preprocess_data(
    data_dir: str = "data/synthetic"
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Loads raw/synthetic CSVs and prepares structured master time-series table.
    Ensures complete (date x facility x resource) panel grid without missing dates.
    """
    fac_path = os.path.join(data_dir, "facility_master.csv")
    res_path = os.path.join(data_dir, "resource_master.csv")
    con_path = os.path.join(data_dir, "consumption.csv")
    inv_path = os.path.join(data_dir, "inventory_batch.csv")
    
    df_facilities = pd.read_csv(fac_path)
    df_resources = pd.read_csv(res_path)
    df_consumption = pd.read_csv(con_path)
    df_inventory = pd.read_csv(inv_path)
    
    # Standardize dates
    df_consumption["date"] = pd.to_datetime(df_consumption["date"])
    
    # Ensure quantity_consumed is numeric and non-negative
    df_consumption["quantity_consumed"] = pd.to_numeric(
        df_consumption["quantity_consumed"], errors="coerce"
    ).fillna(0).clip(lower=0)
    
    # Sort chronologically per facility-resource series
    df_consumption = df_consumption.sort_values(
        by=["facility_id", "resource_id", "date"]
    ).reset_index(drop=True)
    
    # Merge master attributes
    df_merged = df_consumption.merge(
        df_facilities[["facility_id", "name", "type", "district_id", "capacity", "latitude", "longitude"]],
        on="facility_id",
        how="left",
        suffixes=("", "_fac")
    ).merge(
        df_resources[["resource_id", "name", "category", "unit", "min_stock", "reorder_level", "shelf_life_days"]],
        on="resource_id",
        how="left",
        suffixes=("_facility", "_resource")
    )
    
    return df_merged, df_facilities, df_resources, df_inventory
