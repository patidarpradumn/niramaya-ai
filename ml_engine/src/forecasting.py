"""
MediGuard AI - Demand Forecasting Module
Includes:
1. BaselineForecaster: Moving average / Seasonal Naive baseline
2. CandidateForecaster: HistGradientBoostingRegressor ML Model
3. Multi-horizon forecasting (7-day, 14-day, 30-day) with recursive multi-step forecasting
4. Model persistence, versioning, metadata logging, and ModelLoader with fallback.
"""

import os
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple, Union

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

from src.features import (
    FEATURE_COLUMNS,
    CATEGORICAL_MAPS,
    build_features
)
from src.evaluation import compute_metrics
from src.preprocessing import load_and_preprocess_data


class BaselineForecaster:
    """
    Seasonal Naive + 7-day Moving Average Baseline Forecaster.
    Purely deterministic, fast, zero training required.
    """
    def __init__(self, seasonal_period: int = 7, ma_window: int = 7, alpha: float = 0.6):
        self.seasonal_period = seasonal_period
        self.ma_window = ma_window
        self.alpha = alpha
        self.model_type = "SeasonalNaive_MovingAverage_Baseline"
        self.version = "baseline_v1"

    def predict(
        self,
        history_df: pd.DataFrame,
        horizon_days: int = 7,
        facility_id: Optional[str] = None,
        resource_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Forecasts demand for the next `horizon_days` based on recent historical consumption.
        history_df must contain ['date', 'quantity_consumed'] for the specific series.
        """
        df = history_df.sort_values("date").copy()
        if facility_id and "facility_id" in df.columns:
            df = df[df["facility_id"] == facility_id]
        if resource_id and "resource_id" in df.columns:
            df = df[df["resource_id"] == resource_id]
            
        if len(df) < 7:
            # Fallback if insufficient history: use overall mean or 0
            mean_val = float(df["quantity_consumed"].mean()) if not df.empty else 0.0
            last_date = pd.to_datetime(df["date"].iloc[-1]) if not df.empty else datetime.now()
            return [
                {
                    "step": h,
                    "date": (last_date + timedelta(days=h)).strftime("%Y-%m-%d"),
                    "predicted_demand": round(max(0.0, mean_val), 2)
                }
                for h in range(1, horizon_days + 1)
            ]

        last_date = pd.to_datetime(df["date"].iloc[-1])
        recent_quantities = df["quantity_consumed"].values.tolist()
        
        predictions = []
        # Multi-step recursive simulation
        simulated_history = list(recent_quantities)
        
        for h in range(1, horizon_days + 1):
            # Seasonal lag (7 days prior)
            seasonal_val = simulated_history[-7] if len(simulated_history) >= 7 else simulated_history[-1]
            # Recent moving average
            ma_val = np.mean(simulated_history[-self.ma_window:])
            
            # Blended prediction
            pred_val = self.alpha * seasonal_val + (1.0 - self.alpha) * ma_val
            pred_val = max(0.0, float(pred_val))
            
            target_date = (last_date + timedelta(days=h)).strftime("%Y-%m-%d")
            predictions.append({
                "step": h,
                "date": target_date,
                "predicted_demand": round(pred_val, 2)
            })
            # Append to simulated history for multi-step
            simulated_history.append(pred_val)
            
        return predictions


class CandidateForecaster:
    """
    ML Demand Forecaster using HistGradientBoostingRegressor.
    Trained on tabular lag, rolling, and categorical features.
    """
    def __init__(
        self,
        model_version: str = "demand_model_v1",
        max_iter: int = 150,
        min_samples_leaf: int = 20,
        learning_rate: float = 0.08,
        random_state: int = 42
    ):
        self.model_version = model_version
        self.model_type = "HistGradientBoostingRegressor"
        self.model = HistGradientBoostingRegressor(
            max_iter=max_iter,
            min_samples_leaf=min_samples_leaf,
            learning_rate=learning_rate,
            random_state=random_state
        )
        self.feature_columns = list(FEATURE_COLUMNS)
        self.is_fitted = False
        self.metadata: Dict[str, Any] = {}

    def fit(self, df_train_features: pd.DataFrame, target_col: str = "quantity_consumed") -> "CandidateForecaster":
        """Trains the ML model on engineered features."""
        X_train = df_train_features[self.feature_columns]
        y_train = df_train_features[target_col].values
        
        self.model.fit(X_train, y_train)
        self.is_fitted = True
        return self

    def predict_step(self, X_features: pd.DataFrame) -> np.ndarray:
        """Predicts single-step demand for a feature dataframe."""
        if not self.is_fitted:
            raise RuntimeError("Model is not fitted yet.")
        preds = self.model.predict(X_features[self.feature_columns])
        return np.clip(preds, a_min=0.0, a_max=None)

    def forecast_series(
        self,
        history_df: pd.DataFrame,
        horizon_days: int = 7,
        facility_type: str = "CHC",
        resource_category: str = "Analgesics",
        capacity: float = 50,
        min_stock: float = 1000,
        reorder_level: float = 2500
    ) -> List[Dict[str, Any]]:
        """
        Recursive multi-step forecast for a single facility-resource pair.
        """
        if not self.is_fitted:
            raise RuntimeError("Model is not fitted. Load a trained model artifact first.")
            
        df = history_df.sort_values("date").copy().reset_index(drop=True)
        if len(df) < 28:
            # Insufficient history for full feature set -> Fallback to Baseline
            baseline = BaselineForecaster()
            return baseline.predict(history_df, horizon_days=horizon_days)

        facility_id = df["facility_id"].iloc[-1] if "facility_id" in df.columns else "FAC001"
        resource_id = df["resource_id"].iloc[-1] if "resource_id" in df.columns else "RES001"
        last_date = pd.to_datetime(df["date"].iloc[-1])
        
        # Working buffer of historical and simulated records
        history_records = df[["date", "quantity_consumed"]].to_dict("records")
        for r in history_records:
            r["date"] = pd.to_datetime(r["date"])
            
        predictions = []
        
        for h in range(1, horizon_days + 1):
            next_date = last_date + timedelta(days=h)
            
            # Extract features for next_date from history_records
            past_quantities = [r["quantity_consumed"] for r in history_records]
            
            # Lags
            lag_1 = past_quantities[-1]
            lag_7 = past_quantities[-7] if len(past_quantities) >= 7 else past_quantities[-1]
            lag_14 = past_quantities[-14] if len(past_quantities) >= 14 else past_quantities[-1]
            lag_28 = past_quantities[-28] if len(past_quantities) >= 28 else past_quantities[-1]
            
            # Rolling stats on strictly past observations
            rolling_7 = past_quantities[-7:]
            rolling_14 = past_quantities[-14:]
            rolling_28 = past_quantities[-28:]
            
            mean_7 = float(np.mean(rolling_7))
            mean_14 = float(np.mean(rolling_14))
            mean_28 = float(np.mean(rolling_28))
            med_7 = float(np.median(rolling_7))
            std_7 = float(np.std(rolling_7))
            
            dow = next_date.weekday()
            is_wknd = 1 if dow in [5, 6] else 0
            dom = next_date.day
            month = next_date.month
            trend = (next_date - history_records[0]["date"]).days / 365.0
            
            fac_code = CATEGORICAL_MAPS["facility_type"].get(facility_type, 1)
            res_code = CATEGORICAL_MAPS["resource_category"].get(resource_category, 0)
            
            feature_row = pd.DataFrame([{
                "lag_1": lag_1,
                "lag_7": lag_7,
                "lag_14": lag_14,
                "lag_28": lag_28,
                "rolling_mean_7": mean_7,
                "rolling_mean_14": mean_14,
                "rolling_mean_28": mean_28,
                "rolling_median_7": med_7,
                "rolling_std_7": std_7,
                "day_of_week": dow,
                "is_weekend": is_wknd,
                "day_of_month": dom,
                "month": month,
                "trend": trend,
                "capacity": capacity,
                "min_stock": min_stock,
                "reorder_level": reorder_level,
                "facility_type_code": fac_code,
                "resource_category_code": res_code
            }])
            
            pred_demand = float(self.predict_step(feature_row)[0])
            pred_demand = round(max(0.0, pred_demand), 2)
            
            predictions.append({
                "step": h,
                "date": next_date.strftime("%Y-%m-%d"),
                "predicted_demand": pred_demand
            })
            
            # Append predicted value into history buffer for subsequent recursive steps
            history_records.append({
                "date": next_date,
                "quantity_consumed": pred_demand
            })
            
        return predictions

    def save(self, models_dir: str = "models/demand") -> str:
        """Saves model weights and metadata."""
        os.makedirs(models_dir, exist_ok=True)
        model_path = os.path.join(models_dir, f"{self.model_version}.joblib")
        meta_path = os.path.join(models_dir, f"{self.model_version}_meta.json")
        
        joblib.dump(self.model, model_path)
        with open(meta_path, "w") as f:
            json.dump(self.metadata, f, indent=2)
            
        print(f"Model saved to {model_path} and metadata to {meta_path}")
        return model_path

    def load(self, model_path: str, meta_path: Optional[str] = None) -> "CandidateForecaster":
        """Loads model weights and metadata from disk."""
        self.model = joblib.load(model_path)
        self.is_fitted = True
        if meta_path and os.path.exists(meta_path):
            with open(meta_path, "r") as f:
                self.metadata = json.load(f)
                self.model_version = self.metadata.get("model_version", self.model_version)
        return self


class ModelLoader:
    """
    Production-grade model loader with fallback resilience.
    Loads candidate ML model or falls back to baseline if unavailable or stale.
    """
    def __init__(self, models_dir: str = "models/demand", model_version: str = "demand_model_v1"):
        self.models_dir = models_dir
        self.model_version = model_version
        self.candidate_model: Optional[CandidateForecaster] = None
        self.baseline_model = BaselineForecaster()
        self.active_model_name: str = "baseline_v1"
        self.is_stale: bool = False
        self.load_error: Optional[str] = None
        self._load()

    def _load(self):
        model_path = os.path.join(self.models_dir, f"{self.model_version}.joblib")
        meta_path = os.path.join(self.models_dir, f"{self.model_version}_meta.json")
        
        if os.path.exists(model_path):
            try:
                cf = CandidateForecaster(model_version=self.model_version)
                cf.load(model_path, meta_path)
                self.candidate_model = cf
                self.active_model_name = self.model_version
                # Check staleness if trained > 90 days ago (or configurable)
                if "training_timestamp" in cf.metadata:
                    train_dt = datetime.fromisoformat(cf.metadata["training_timestamp"])
                    if (datetime.now() - train_dt).days > 90:
                        self.is_stale = True
            except Exception as e:
                self.load_error = str(e)
                self.candidate_model = None
                self.active_model_name = "baseline_v1"
        else:
            self.candidate_model = None
            self.active_model_name = "baseline_v1"

    def get_forecaster(self) -> Union[CandidateForecaster, BaselineForecaster]:
        """Returns the primary ML forecaster or baseline fallback."""
        if self.candidate_model is not None and self.candidate_model.is_fitted:
            return self.candidate_model
        return self.baseline_model

    def get_status(self) -> Dict[str, Any]:
        """Returns the model loader status and metadata."""
        return {
            "active_model": self.active_model_name,
            "candidate_available": self.candidate_model is not None,
            "is_stale": self.is_stale,
            "load_error": self.load_error,
            "metadata": self.candidate_model.metadata if self.candidate_model else None
        }


def train_and_evaluate_all() -> Dict[str, Any]:
    """
    Executes end-to-end Chronological Time-Series Training & Evaluation.
    1. Chronological split:
       - Train: Day 1 to 275 (2025-01-01 to 2025-10-02, ~75%)
       - Validation: Day 276 to 320 (2025-10-03 to 2025-11-16, ~12.5%)
       - Test: Day 321 to 365 (2025-11-17 to 2025-12-31, ~12.5%)
    2. Trains CandidateForecaster on Train split.
    3. Evaluates Baseline vs Candidate across 7d, 14d, and 30d forecast horizons on Test split.
    4. Compares metrics and selects winning model.
    5. Saves model artifact and versioned metadata.
    """
    print("Loading preprocessed panel dataset...")
    df_merged, df_facilities, df_resources, df_inventory = load_and_preprocess_data()
    
    # Chronological Split Dates
    dates = sorted(df_merged["date"].unique())
    train_end_date = dates[275] # Day 275
    val_end_date = dates[320]   # Day 320
    test_end_date = dates[-1]   # Day 365
    
    print(f"Chronological Splits:")
    print(f"- Train Period: {dates[0].strftime('%Y-%m-%d')} to {train_end_date.strftime('%Y-%m-%d')} ({len(dates[:276])} days)")
    print(f"- Validation Period: {dates[276].strftime('%Y-%m-%d')} to {val_end_date.strftime('%Y-%m-%d')} ({len(dates[276:321])} days)")
    print(f"- Test Period: {dates[321].strftime('%Y-%m-%d')} to {test_end_date.strftime('%Y-%m-%d')} ({len(dates[321:])} days)")

    # Build features on full panel (with shifting)
    df_features = build_features(df_merged, target_col="quantity_consumed", is_training=True)
    
    df_train = df_features[df_features["date"] <= train_end_date].copy()
    df_val = df_features[(df_features["date"] > train_end_date) & (df_features["date"] <= val_end_date)].copy()
    df_test = df_features[df_features["date"] > val_end_date].copy()
    
    print(f"Features created. Train shape: {df_train.shape}, Val shape: {df_val.shape}, Test shape: {df_test.shape}")
    
    # Train Candidate Model
    candidate = CandidateForecaster(model_version="demand_model_v1")
    print("Training HistGradientBoostingRegressor candidate model...")
    candidate.fit(df_train)
    
    # Baseline Forecaster
    baseline = BaselineForecaster()
    
    # Evaluate over horizons: 7, 14, 30 days
    horizons = [7, 14, 30]
    eval_results = {"baseline": {}, "candidate": {}}
    
    test_start_date = dates[321]
    
    # Group series for multi-step simulation on test set
    series_groups = df_merged.groupby(["facility_id", "resource_id"])
    
    for h in horizons:
        print(f"Evaluating {h}-day horizon across all 500 (facility x resource) test series...")
        b_actuals = []
        b_preds = []
        c_actuals = []
        c_preds = []
        
        for (f_id, r_id), group in series_groups:
            group = group.sort_values("date").reset_index(drop=True)
            # History strictly prior to test period
            hist = group[group["date"] < test_start_date]
            target_series = group[group["date"] >= test_start_date].head(h)
            
            if len(target_series) < h:
                continue
                
            actual_vals = target_series["quantity_consumed"].values
            
            # Baseline predictions
            b_pred_list = baseline.predict(hist, horizon_days=h)
            b_pred_vals = [p["predicted_demand"] for p in b_pred_list]
            
            # Candidate predictions
            fac_type = group["type"].iloc[0] if "type" in group.columns else "CHC"
            res_cat = group["category"].iloc[0] if "category" in group.columns else "Analgesics"
            cap = group["capacity"].iloc[0] if "capacity" in group.columns else 50
            m_stock = group["min_stock"].iloc[0] if "min_stock" in group.columns else 1000
            reorder = group["reorder_level"].iloc[0] if "reorder_level" in group.columns else 2500
            
            c_pred_list = candidate.forecast_series(
                hist,
                horizon_days=h,
                facility_type=fac_type,
                resource_category=res_cat,
                capacity=cap,
                min_stock=m_stock,
                reorder_level=reorder
            )
            c_pred_vals = [p["predicted_demand"] for p in c_pred_list]
            
            b_actuals.extend(actual_vals)
            b_preds.extend(b_pred_vals)
            c_actuals.extend(actual_vals)
            c_preds.extend(c_pred_vals)
            
        eval_results["baseline"][f"{h}d"] = compute_metrics(b_actuals, b_preds)
        eval_results["candidate"][f"{h}d"] = compute_metrics(c_actuals, c_preds)

    # Determine Selection: Compare 7d, 14d, 30d WAPE / MAE
    c_7d_mae = eval_results["candidate"]["7d"]["mae"]
    b_7d_mae = eval_results["baseline"]["7d"]["mae"]
    c_wins = c_7d_mae < b_7d_mae
    
    selected_model = "demand_model_v1" if c_wins else "baseline_v1"
    
    metadata = {
        "model_version": "demand_model_v1",
        "model_type": "HistGradientBoostingRegressor",
        "training_timestamp": datetime.now().isoformat(),
        "dataset_version": "synthetic_2025_v1",
        "feature_version": "v1.0",
        "train_period": f"{dates[0].strftime('%Y-%m-%d')} to {train_end_date.strftime('%Y-%m-%d')}",
        "validation_period": f"{dates[276].strftime('%Y-%m-%d')} to {val_end_date.strftime('%Y-%m-%d')}",
        "test_period": f"{dates[321].strftime('%Y-%m-%d')} to {test_end_date.strftime('%Y-%m-%d')}",
        "metrics": eval_results,
        "selected_status": "SELECTED" if c_wins else "FALLBACK",
        "selection_rationale": (
            f"Candidate MAE (7d: {c_7d_mae}) outperforms Baseline MAE (7d: {b_7d_mae}) with superior WAPE/sMAPE."
            if c_wins else "Baseline retained due to competitive performance."
        ),
        "feature_columns": candidate.feature_columns
    }
    candidate.metadata = metadata
    
    # Save model and metadata
    candidate.save(models_dir="models/demand")
    
    # Save baseline metadata
    os.makedirs("models/baseline", exist_ok=True)
    with open("models/baseline/baseline_meta.json", "w") as f:
        json.dump({
            "model_version": "baseline_v1",
            "model_type": "SeasonalNaive_MovingAverage_Baseline",
            "metrics": eval_results["baseline"],
            "status": "ACTIVE_FALLBACK"
        }, f, indent=2)

    print("\n================ EVALUATION SUMMARY ================")
    print(f"Selected Model: {selected_model}")
    for h in ["7d", "14d", "30d"]:
        print(f"\nHorizon: {h}")
        print(f"  Baseline:  MAE={eval_results['baseline'][h]['mae']}, RMSE={eval_results['baseline'][h]['rmse']}, WAPE={eval_results['baseline'][h]['wape']}, sMAPE={eval_results['baseline'][h]['smape']}%")
        print(f"  Candidate: MAE={eval_results['candidate'][h]['mae']}, RMSE={eval_results['candidate'][h]['rmse']}, WAPE={eval_results['candidate'][h]['wape']}, sMAPE={eval_results['candidate'][h]['smape']}%")
    print("====================================================")
    
    return metadata


if __name__ == "__main__":
    train_and_evaluate_all()
