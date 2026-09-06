"""
MediGuard AI - API Routes Module
Defines endpoints for demand forecasting, batch forecasting, model metadata,
health diagnostics, emergency scenario simulation, and redistribution recommendations.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
import os
import pandas as pd
from fastapi import APIRouter, HTTPException, Query, status

from api.schemas import (
    ForecastRequest,
    ForecastResponse,
    BatchForecastRequest,
    BatchForecastResponse,
    ScenarioSimulationRequest,
    RedistributionRequest,
    StockRiskResponse,
    ExpiryRiskResponse,
)
from src.forecasting import ModelLoader, BaselineForecaster, CandidateForecaster
from src.risk import StockOutRiskAnalyzer
from src.expiry import ExpiryRiskAnalyzer
from src.redistribution import RedistributionEngine
from src.scenario import EmergencyScenarioSimulator
from src.preprocessing import load_and_preprocess_data

router = APIRouter(prefix="/v1", tags=["ML Engine"])

# Initialize singletons / services
model_loader = ModelLoader(models_dir="models/demand", model_version="demand_model_v1")
risk_analyzer = StockOutRiskAnalyzer()
expiry_analyzer = ExpiryRiskAnalyzer()
redistribution_engine = RedistributionEngine()
scenario_simulator = EmergencyScenarioSimulator()

# Lazy dataset cache for standalone API lookups
_dataset_cache: Optional[Dict[str, pd.DataFrame]] = None


def get_dataset_cache() -> Dict[str, pd.DataFrame]:
    global _dataset_cache
    if _dataset_cache is None:
        try:
            df_merged, df_fac, df_res, df_inv = load_and_preprocess_data()
            _dataset_cache = {
                "merged": df_merged,
                "facilities": df_fac,
                "resources": df_res,
                "inventory": df_inv
            }
        except Exception:
            _dataset_cache = {
                "merged": pd.DataFrame(),
                "facilities": pd.DataFrame(),
                "resources": pd.DataFrame(),
                "inventory": pd.DataFrame()
            }
    return _dataset_cache


@router.get("/health", summary="Service Health & Diagnostic Status")
def health_check() -> Dict[str, Any]:
    """Returns ML engine health status, active model information, and system diagnostics."""
    status_info = model_loader.get_status()
    return {
        "status": "healthy",
        "service": "MediGuard AI ML Engine",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "model_status": status_info
    }


@router.get("/models", summary="Active Model Information & Evaluation Metrics")
def get_model_metadata() -> Dict[str, Any]:
    """Returns metadata, version, and rigorous evaluation metrics of active & fallback models."""
    status_info = model_loader.get_status()
    meta = status_info.get("metadata")
    if meta is None:
        # Check baseline meta
        meta_path = "models/demand/demand_model_v1_meta.json"
        if os.path.exists(meta_path):
            import json
            with open(meta_path, "r") as f:
                meta = json.load(f)
                
    return {
        "active_model": status_info.get("active_model"),
        "candidate_available": status_info.get("candidate_available"),
        "is_stale": status_info.get("is_stale"),
        "metadata": meta,
        "supported_horizons_days": [7, 14, 30]
    }


def _process_single_forecast(req: ForecastRequest) -> ForecastResponse:
    """Internal helper to process single forecast request with fallback handling."""
    cache = get_dataset_cache()
    
    # 1. Obtain history
    if req.history and len(req.history) > 0:
        history_df = pd.DataFrame([h.model_dump() for h in req.history])
    else:
        merged = cache.get("merged", pd.DataFrame())
        if not merged.empty:
            history_df = merged[
                (merged["facility_id"] == req.facility_id) & (merged["resource_id"] == req.resource_id)
            ][["date", "quantity_consumed", "facility_id", "resource_id"]].copy()
        else:
            history_df = pd.DataFrame(columns=["date", "quantity_consumed"])

    if history_df.empty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No consumption history found for facility '{req.facility_id}' and resource '{req.resource_id}'."
        )

    forecaster = model_loader.get_forecaster()
    is_fallback = isinstance(forecaster, BaselineForecaster) or len(history_df) < 28

    if not is_fallback and isinstance(forecaster, CandidateForecaster):
        try:
            preds = forecaster.forecast_series(
                history_df,
                horizon_days=req.horizon_days,
                facility_type=req.facility_type or "CHC",
                resource_category=req.resource_category or "Analgesics",
                capacity=req.capacity or 50.0,
                min_stock=req.min_stock or 500.0,
                reorder_level=req.reorder_level or 1200.0
            )
            model_ver = forecaster.model_version
            model_typ = forecaster.model_type
        except Exception:
            # Fallback gracefully to baseline
            baseline = BaselineForecaster()
            preds = baseline.predict(history_df, horizon_days=req.horizon_days)
            model_ver = baseline.version
            model_typ = baseline.model_type
            is_fallback = True
    else:
        baseline = BaselineForecaster()
        preds = baseline.predict(history_df, horizon_days=req.horizon_days)
        model_ver = baseline.version
        model_typ = baseline.model_type
        is_fallback = True

    total_demand = round(float(sum(p["predicted_demand"] for p in preds)), 2)
    daily_burn = round(total_demand / float(req.horizon_days), 2)

    # 2. Stock-out Risk Assessment
    stock_risk_res = None
    curr_stock = req.current_stock
    
    # If current_stock was not provided in request, check inventory cache
    if curr_stock is None:
        inv_df = cache.get("inventory", pd.DataFrame())
        if not inv_df.empty:
            match_inv = inv_df[
                (inv_df["facility_id"] == req.facility_id) & (inv_df["resource_id"] == req.resource_id)
            ]
            if not match_inv.empty:
                curr_stock = float(match_inv["quantity"].sum())

    if curr_stock is not None:
        risk_out = risk_analyzer.assess_risk(
            current_stock=curr_stock,
            forecast_demand=total_demand,
            horizon_days=req.horizon_days,
            lead_time_days=req.lead_time_days,
            min_stock=req.min_stock or 500.0,
            reorder_level=req.reorder_level or 1200.0
        )
        stock_risk_res = StockRiskResponse(**risk_out)

    # 3. Expiry Risk Assessment
    expiry_risk_res = None
    batch_list = []
    if req.batches:
        batch_list = [b.model_dump() for b in req.batches]
    else:
        inv_df = cache.get("inventory", pd.DataFrame())
        if not inv_df.empty:
            match_inv = inv_df[
                (inv_df["facility_id"] == req.facility_id) & (inv_df["resource_id"] == req.resource_id)
            ]
            if not match_inv.empty:
                batch_list = match_inv.to_dict("records")

    if batch_list:
        exp_out = expiry_analyzer.assess_batches(
            batches=batch_list,
            daily_burn_rate=daily_burn
        )
        expiry_risk_res = ExpiryRiskResponse(**exp_out)

    return ForecastResponse(
        facility_id=req.facility_id,
        resource_id=req.resource_id,
        horizon_days=req.horizon_days,
        model_version=model_ver,
        model_type=model_typ,
        is_fallback=is_fallback,
        predictions=preds,
        total_predicted_demand=total_demand,
        daily_burn_rate=daily_burn,
        stock_out_risk=stock_risk_res,
        expiry_risk=expiry_risk_res,
        timestamp=datetime.now().isoformat()
    )


@router.post("/forecast", response_model=ForecastResponse, summary="Demand Forecast & Risk Assessment")
def generate_forecast(request: ForecastRequest) -> ForecastResponse:
    """Generates a 7/14/30-day forecast and automated stock-out & expiry risk evaluations."""
    return _process_single_forecast(request)


@router.post("/forecast/batch", response_model=BatchForecastResponse, summary="Batch Demand Forecast")
def generate_batch_forecast(batch_req: BatchForecastRequest) -> BatchForecastResponse:
    """Executes batch demand forecasting across multiple facilities and resources in one call."""
    results: List[ForecastResponse] = []
    errors: List[Dict[str, Any]] = []

    for req in batch_req.requests:
        try:
            res = _process_single_forecast(req)
            results.append(res)
        except Exception as e:
            errors.append({
                "facility_id": req.facility_id,
                "resource_id": req.resource_id,
                "error": str(e)
            })

    return BatchForecastResponse(
        total_requests=len(batch_req.requests),
        successful_count=len(results),
        failed_count=len(errors),
        results=results,
        errors=errors
    )


@router.post("/scenario", summary="Emergency Demand Surge Simulation")
def simulate_scenario(req: ScenarioSimulationRequest) -> Dict[str, Any]:
    """
    Simulates a disaster/outbreak demand spike (+20%, +40%, +60%, +100%) and returns stress analytics.
    Physical inventory and operational database records remain completely unmodified.
    """
    return scenario_simulator.simulate_scenario(
        normal_forecast_demand=req.normal_forecast_demand,
        current_stock=req.current_stock,
        multiplier=req.multiplier,
        horizon_days=req.horizon_days or 7,
        lead_time_days=req.lead_time_days or 7,
        min_stock=req.min_stock or 500.0,
        reorder_level=req.reorder_level or 1200.0,
        scenario_name=req.scenario_name
    )


@router.post("/redistribution", summary="Intelligent Redistribution Recommendations")
def get_redistribution_recommendations(req: RedistributionRequest) -> Dict[str, Any]:
    """
    Analyzes supply-demand balance and generates actionable stock transfer recommendations.
    All transfers are recommendations requiring authorized human approval.
    """
    facility_states = []
    if req.facilities:
        facility_states = [f.model_dump() for f in req.facilities]
    else:
        # Auto-compile states from synthetic datasets for this resource
        cache = get_dataset_cache()
        df_fac = cache.get("facilities", pd.DataFrame())
        df_inv = cache.get("inventory", pd.DataFrame())
        df_con = cache.get("merged", pd.DataFrame())
        
        if not df_fac.empty and not df_inv.empty and not df_con.empty:
            for _, f in df_fac.iterrows():
                f_id = f["facility_id"]
                f_stock = float(df_inv[(df_inv["facility_id"] == f_id) & (df_inv["resource_id"] == req.resource_id)]["quantity"].sum())
                # Estimate daily burn rate from past 30 days
                sub_con = df_con[(df_con["facility_id"] == f_id) & (df_con["resource_id"] == req.resource_id)]
                daily_burn = float(sub_con.tail(30)["quantity_consumed"].mean()) if not sub_con.empty else 10.0
                daily_burn = max(0.5, daily_burn)
                
                risk_res = risk_analyzer.assess_risk(
                    current_stock=f_stock,
                    forecast_demand=daily_burn * 7.0,
                    horizon_days=7,
                    lead_time_days=7,
                    min_stock=500.0
                )
                
                facility_states.append({
                    "facility_id": f_id,
                    "name": f["name"],
                    "type": f["type"],
                    "latitude": f["latitude"],
                    "longitude": f["longitude"],
                    "current_stock": f_stock,
                    "daily_burn_rate": daily_burn,
                    "min_stock": 500.0,
                    "stock_cover_days": risk_res["stock_cover_days"],
                    "risk_level": risk_res["risk_level"]
                })

    engine = RedistributionEngine(max_transfer_distance_km=req.max_transfer_distance_km or 300.0)
    return engine.recommend_transfers(
        facility_states=facility_states,
        resource_id=req.resource_id,
        resource_name=req.resource_name
    )
