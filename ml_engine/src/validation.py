"""
MediGuard AI - Data Validation Module
Performs comprehensive schema, integrity, referential, and sanity checks on datasets:
- Schema & column name validation
- Missing value / null checks
- Nonnegative quantity checks
- Date format & chronological consistency checks
- Duplicate record checks
- Referential integrity (Foreign Key) checks across master and transaction tables
"""

import os
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple


class DataValidator:
    """Validates public healthcare datasets for MediGuard AI."""
    
    REQUIRED_COLUMNS = {
        "facility_master": [
            "facility_id", "name", "type", "district_id", "state_id",
            "latitude", "longitude", "capacity", "active_status"
        ],
        "resource_master": [
            "resource_id", "name", "category", "unit", "min_stock",
            "reorder_level", "shelf_life_days"
        ],
        "consumption": [
            "date", "facility_id", "resource_id", "quantity_consumed"
        ],
        "inventory_batch": [
            "facility_id", "resource_id", "batch_id", "quantity",
            "received_date", "expiry_date"
        ],
        "supply": [
            "resource_id", "supplier_id", "quantity", "order_date",
            "delivery_date", "lead_time_days", "unit_price"
        ]
    }

    def __init__(self, data_dir: str = "data/synthetic"):
        self.data_dir = data_dir

    def load_data(self) -> Tuple[Optional[pd.DataFrame], Optional[pd.DataFrame], Optional[pd.DataFrame], Optional[pd.DataFrame], Optional[pd.DataFrame]]:
        """Loads CSV files from the specified directory."""
        files = {
            "facility_master": os.path.join(self.data_dir, "facility_master.csv"),
            "resource_master": os.path.join(self.data_dir, "resource_master.csv"),
            "consumption": os.path.join(self.data_dir, "consumption.csv"),
            "inventory_batch": os.path.join(self.data_dir, "inventory_batch.csv"),
            "supply": os.path.join(self.data_dir, "supply.csv"),
        }
        
        dfs = {}
        for name, path in files.items():
            if os.path.exists(path):
                dfs[name] = pd.read_csv(path)
            else:
                dfs[name] = None
        return (
            dfs.get("facility_master"),
            dfs.get("resource_master"),
            dfs.get("consumption"),
            dfs.get("inventory_batch"),
            dfs.get("supply")
        )

    def validate_all(
        self,
        df_facilities: Optional[pd.DataFrame] = None,
        df_resources: Optional[pd.DataFrame] = None,
        df_consumption: Optional[pd.DataFrame] = None,
        df_inventory: Optional[pd.DataFrame] = None,
        df_supply: Optional[pd.DataFrame] = None
    ) -> Dict[str, Any]:
        """Runs all validations and returns a structured validation report."""
        if df_facilities is None or df_resources is None or df_consumption is None:
            df_fac, df_res, df_con, df_inv, df_sup = self.load_data()
            df_facilities = df_facilities or df_fac
            df_resources = df_resources or df_res
            df_consumption = df_consumption or df_con
            df_inventory = df_inventory or df_inv
            df_supply = df_supply or df_sup

        results: Dict[str, Any] = {
            "overall_valid": True,
            "errors": [],
            "warnings": [],
            "dataset_checks": {},
            "referential_integrity": {}
        }

        # 1. Facility Master Validation
        if df_facilities is not None:
            fac_res = self._validate_single_df(df_facilities, "facility_master", ["facility_id"])
            # Lat/long bounds check
            if not df_facilities.empty and "latitude" in df_facilities.columns and "longitude" in df_facilities.columns:
                lat_valid = df_facilities["latitude"].between(-90, 90).all()
                lon_valid = df_facilities["longitude"].between(-180, 180).all()
                if not (lat_valid and lon_valid):
                    fac_res["valid"] = False
                    fac_res["errors"].append("Latitude or Longitude values out of valid geographic range.")
            results["dataset_checks"]["facility_master"] = fac_res
        else:
            results["overall_valid"] = False
            results["errors"].append("Missing facility_master dataset.")

        # 2. Resource Master Validation
        if df_resources is not None:
            res_res = self._validate_single_df(df_resources, "resource_master", ["resource_id"])
            if not df_resources.empty and "min_stock" in df_resources.columns:
                if (df_resources["min_stock"] < 0).any():
                    res_res["valid"] = False
                    res_res["errors"].append("Negative min_stock detected.")
            results["dataset_checks"]["resource_master"] = res_res
        else:
            results["overall_valid"] = False
            results["errors"].append("Missing resource_master dataset.")

        # 3. Consumption Validation
        if df_consumption is not None:
            con_res = self._validate_single_df(
                df_consumption, "consumption", ["date", "facility_id", "resource_id"]
            )
            if not df_consumption.empty:
                if "quantity_consumed" in df_consumption.columns:
                    if (df_consumption["quantity_consumed"] < 0).any():
                        con_res["valid"] = False
                        con_res["errors"].append("Negative quantity_consumed found.")
                # Date format check
                try:
                    pd.to_datetime(df_consumption["date"], format="%Y-%m-%d")
                except Exception as e:
                    con_res["valid"] = False
                    con_res["errors"].append(f"Invalid date format in consumption: {str(e)}")
            results["dataset_checks"]["consumption"] = con_res
        else:
            results["overall_valid"] = False
            results["errors"].append("Missing consumption dataset.")

        # 4. Inventory Batch Validation
        if df_inventory is not None:
            inv_res = self._validate_single_df(df_inventory, "inventory_batch", ["batch_id"])
            if not df_inventory.empty:
                if "quantity" in df_inventory.columns:
                    if (df_inventory["quantity"] < 0).any():
                        inv_res["valid"] = False
                        inv_res["errors"].append("Negative quantity in inventory batches.")
                # Received date vs expiry date
                try:
                    rec_dates = pd.to_datetime(df_inventory["received_date"], format="%Y-%m-%d")
                    exp_dates = pd.to_datetime(df_inventory["expiry_date"], format="%Y-%m-%d")
                    if (exp_dates < rec_dates).any():
                        inv_res["valid"] = False
                        inv_res["errors"].append("Expiry date is before received date in some batches.")
                except Exception as e:
                    inv_res["valid"] = False
                    inv_res["errors"].append(f"Invalid dates in inventory: {str(e)}")
            results["dataset_checks"]["inventory_batch"] = inv_res

        # 5. Supply Validation (Optional)
        if df_supply is not None and not df_supply.empty:
            sup_res = self._validate_single_df(df_supply, "supply")
            results["dataset_checks"]["supply"] = sup_res

        # 6. Referential Integrity (Foreign Keys)
        if df_facilities is not None and df_resources is not None:
            fac_ids = set(df_facilities["facility_id"])
            res_ids = set(df_resources["resource_id"])

            if df_consumption is not None and not df_consumption.empty:
                con_fac_diff = set(df_consumption["facility_id"]) - fac_ids
                con_res_diff = set(df_consumption["resource_id"]) - res_ids
                if con_fac_diff:
                    results["referential_integrity"]["consumption_invalid_facilities"] = list(con_fac_diff)
                    results["overall_valid"] = False
                if con_res_diff:
                    results["referential_integrity"]["consumption_invalid_resources"] = list(con_res_diff)
                    results["overall_valid"] = False

            if df_inventory is not None and not df_inventory.empty:
                inv_fac_diff = set(df_inventory["facility_id"]) - fac_ids
                inv_res_diff = set(df_inventory["resource_id"]) - res_ids
                if inv_fac_diff:
                    results["referential_integrity"]["inventory_invalid_facilities"] = list(inv_fac_diff)
                    results["overall_valid"] = False
                if inv_res_diff:
                    results["referential_integrity"]["inventory_invalid_resources"] = list(inv_res_diff)
                    results["overall_valid"] = False

        # Aggregate overall validity
        for check_name, check_data in results["dataset_checks"].items():
            if not check_data.get("valid", True):
                results["overall_valid"] = False
                results["errors"].extend([f"[{check_name}] {err}" for err in check_data.get("errors", [])])

        return results

    def _validate_single_df(
        self,
        df: pd.DataFrame,
        dataset_name: str,
        unique_subset: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Validates a single dataframe for schema, nulls, duplicates."""
        res: Dict[str, Any] = {
            "valid": True,
            "rows": len(df),
            "columns": list(df.columns),
            "errors": [],
            "null_counts": {}
        }
        
        # Check required columns
        req_cols = self.REQUIRED_COLUMNS.get(dataset_name, [])
        missing_cols = set(req_cols) - set(df.columns)
        if missing_cols:
            res["valid"] = False
            res["errors"].append(f"Missing required columns: {sorted(list(missing_cols))}")

        # Check null values
        null_counts = df.isnull().sum().to_dict()
        res["null_counts"] = {k: int(v) for k, v in null_counts.items() if v > 0}
        if res["null_counts"]:
            res["valid"] = False
            res["errors"].append(f"Contains null values: {res['null_counts']}")

        # Check duplicates
        if unique_subset and all(col in df.columns for col in unique_subset):
            dup_count = df.duplicated(subset=unique_subset).sum()
            if dup_count > 0:
                res["valid"] = False
                res["errors"].append(f"Contains {dup_count} duplicate rows on key {unique_subset}.")

        return res


if __name__ == "__main__":
    validator = DataValidator()
    report = validator.validate_all()
    print("=== DATA VALIDATION REPORT ===")
    print(f"Overall Valid: {report['overall_valid']}")
    if not report['overall_valid']:
        print("Errors:", report['errors'])
    else:
        print("All schema, missing-value, negative-quantity, duplicate, and foreign key validations PASSED.")
    for ds, status in report["dataset_checks"].items():
        print(f"  - {ds}: {status['rows']} rows, valid={status['valid']}")
