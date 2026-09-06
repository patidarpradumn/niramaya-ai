# MediGuard AI — ML Engine Progress & State

> This file is the **living project-state document**.
> Updated after every completed phase, execution, evaluation, and test run.

## Current Status

- Overall status: COMPLETE
- Current phase: Phase 14 (Complete)
- Last completed phase: Phase 14. Docker + integration + README
- Last updated: 2026-09-03
- Current blocker: None

---

## Phase Status

| Phase | Status | Notes |
|---|---|---|
| 1. Project structure/environment | ✅ Complete | Directory structure, venv, requirements.txt, Python 3.13.7 verified |
| 2. Synthetic data generator | ✅ Complete | 20 facilities, 25 resources, 182,500 consumption records, 699 batches, 150 POs |
| 3. Data validation | ✅ Complete | Schema, missing-values, nonnegative, date, and foreign-key integrity passed |
| 4. Feature engineering | ✅ Complete | Lags 1/7/14/28, rolling stats 7/14/28, calendar, static encodings, zero leakage verified |
| 5. Baseline forecasting | ✅ Complete | Seasonal Naive + 7-day Moving Average baseline implemented and evaluated |
| 6. Candidate ML model | ✅ Complete | HistGradientBoostingRegressor multi-horizon recursive model trained and evaluated |
| 7. Evaluation/model selection | ✅ Complete | Chronological test evaluation: Candidate beats Baseline across 7d, 14d, 30d |
| 8. Model versioning/loader | ✅ Complete | Artifacts saved to `models/demand/demand_model_v1.joblib` with metadata & ModelLoader |
| 9. Stock-out + expiry risk | ✅ Complete | Deterministic risk scoring + FEFO batch-level expiry analyzer |
| 10. Redistribution heuristic | ✅ Complete | Haversine distance, donor safety buffer, human approval requirement enforced |
| 11. Emergency scenario | ✅ Complete | +20%, +40%, +60%, +100% surge simulations with zero physical DB mutation |
| 12. FastAPI | ✅ Complete | Endpoints `/v1/forecast`, `/v1/forecast/batch`, `/v1/models`, `/v1/health`, etc. |
| 13. Automated testing | ✅ Complete | 28 automated pytest test cases passing across all modules |
| 14. Docker + integration + README | ✅ Complete | `Dockerfile`, `docker-compose.yml`, `README.md`, integration contracts |

Status values:
- ⬜ Not started
- 🟡 In progress
- ✅ Complete
- 🔴 Blocked
- ⚠️ Needs review

---

## 1. Repository / Environment State

### Repository
- Project path: `/Volumes/T7/GDG_HACKATHON`
- Git branch: N/A (local workspace)
- Existing files: `src/*.py`, `api/*.py`, `tests/*.py`, `data/synthetic/*.csv`, `models/*`, `Dockerfile`, `docker-compose.yml`, `README.md`
- Existing implementation: Complete ML Engine, feature pipeline, forecasting, risk, expiry, redistribution, scenario, and FastAPI service
- Existing tests: 28 test cases across 8 test modules in `tests/`
- Existing models: `models/demand/demand_model_v1.joblib`, `models/demand/demand_model_v1_meta.json`, `models/baseline/baseline_meta.json`
- Existing datasets: 5 synthetic CSVs in `data/synthetic/`

### Environment
- Python version: Python 3.13.7
- Virtual environment: `.venv`
- OS: macOS (Darwin)
- Key package versions:
  - `pandas`: 3.0.5
  - `numpy`: 2.5.2
  - `scikit-learn`: 1.9.0
  - `fastapi`: 0.141.1
  - `uvicorn`: 0.52.4
  - `pydantic`: 2.13.5
  - `pytest`: 9.1.1
  - `joblib`: 1.6.0
  - `scipy`: 1.18.1
  - `httpx`: 0.28.1
- Docker status: `Dockerfile` and `docker-compose.yml` configured and ready

### Commands verified
```bash
# Data generation
.venv/bin/python src/data_generator.py

# Validation
.venv/bin/python src/validation.py

# Model training and evaluation
PYTHONPATH=. .venv/bin/python src/forecasting.py

# Automated test suite
PYTHONPATH=. .venv/bin/pytest tests/
```

---

## 2. Data State

### Data provided/created

| Dataset | Location | Rows | Columns | Status | Notes |
|---|---|---:|---:|---|---|
| Facility master | `data/synthetic/facility_master.csv` | 20 | 9 | ✅ Validated | 4 District Hospitals, 8 CHCs, 8 PHCs |
| Resource master | `data/synthetic/resource_master.csv` | 25 | 7 | ✅ Validated | 25 essential medicines across 8 therapeutic classes |
| Consumption | `data/synthetic/consumption.csv` | 182,500 | 4 | ✅ Validated | 365 days panel for 500 series |
| Inventory batch | `data/synthetic/inventory_batch.csv` | 699 | 6 | ✅ Validated | FEFO batches with near-expiry & shortage test cases |
| Supply | `data/synthetic/supply.csv` | 150 | 7 | ✅ Validated | Purchase orders across 4 suppliers |

### Dataset characteristics
- Synthetic or real: Synthetic (reproducible healthcare simulation)
- Random seed: 42
- Date range: `2025-01-01` to `2025-12-31` (365 days)
- Number of facilities: 20
- Number of resources: 25
- Total consumption rows: 182,500
- Missing values: 0
- Duplicate rows: 0
- Invalid references: 0
- Negative quantities: 0
- Seasonality: Weekly OPD patterns + Monsoon/Winter/Summer epidemiology
- Trends: +4% annual uptake trend
- Demand spikes: Dengue surge (FAC001), Diarrheal surge (FAC006), Smog surge (FAC003)
- Controlled shortages: FAC001 + RES001 (Paracetamol) critical low stock
- Surplus cases: FAC002 + RES001 (Paracetamol) high surplus stock
- Near-expiry cases: FAC003 + RES021 (Rabies Vaccine) near-expiry excess

### Data validation result
- Schema validation: PASSED
- Missing-value validation: PASSED
- Reference validation: PASSED
- Date validation: PASSED
- Quantity validation: PASSED
- Duplicate validation: PASSED
- Overall result: PASSED (100% valid)

---

## 3. Feature Engineering State

### Features implemented
- [x] lag_1
- [x] lag_7
- [x] lag_14
- [x] lag_28
- [x] rolling_mean_7
- [x] rolling_mean_14
- [x] rolling_mean_28
- [x] rolling_median_7
- [x] rolling_std_7
- [x] day_of_week
- [x] is_weekend
- [x] day_of_month
- [x] month
- [x] trend
- [x] facility_type_code
- [x] resource_category_code
- [x] capacity
- [x] min_stock
- [x] reorder_level

### Leakage check
- Future information accidentally used: No (All features strictly shifted by >= 1)
- Leakage test result: PASSED (`test_features.py` verified)
- Notes: All rolling statistics are computed on `shifted(1)` target series.

---

## 4. Forecasting State

### Baseline
- Model: Seasonal Naive + 7-day Moving Average (`SeasonalNaive_MovingAverage_Baseline`)
- Horizon(s): 7 days, 14 days, 30 days
- Training period: Zero training required (purely deterministic online baseline)
- Validation period: `2025-10-04` to `2025-11-17` (45 days)
- Test period: `2025-11-18` to `2025-12-31` (44 days)
- Result: 7d MAE = 10.2447, WAPE = 0.1786

### Candidate model
- Model: HistGradientBoostingRegressor (`HistGradientBoostingRegressor`)
- Version: `demand_model_v1`
- Features: 19 leakage-safe tabular lag, rolling, calendar, and entity features
- Training period: `2025-01-01` to `2025-10-03` (276 days / 124,000 panel records)
- Result: 7d MAE = 8.8560, WAPE = 0.1544

### Forecast output
- 7-day: Verified across 500 test series
- 14-day: Verified across 500 test series
- 30-day: Verified across 500 test series
- Nonnegative output verified: Yes (clipped at >= 0)
- Low/zero demand tested: Yes
- Insufficient history handled: Yes (falls back gracefully to baseline when < 28 days)

---

## 5. Evaluation / Model Selection

### Metrics (Actual Executed Time-Series Evaluation on Test Split)

| Model | Horizon | MAE | RMSE | WAPE | sMAPE | Selected? |
|---|---:|---:|---:|---:|---:|---|
| Baseline | 7d | 10.2447 | 16.9610 | 0.1786 | 25.2695% | Active Fallback |
| Candidate | 7d | **8.8560** | **15.1573** | **0.1544** | **22.0106%** | **SELECTED** |
| Baseline | 14d | 10.9131 | 19.4767 | 0.1888 | 25.4198% | Active Fallback |
| Candidate | 14d | **9.6851** | **18.7722** | **0.1676** | **22.8010%** | **SELECTED** |
| Baseline | 30d | 11.7382 | **21.7661** | 0.1987 | 25.7855% | Active Fallback |
| Candidate | 30d | **10.7412** | 21.8935 | **0.1818** | **23.9277%** | **SELECTED** |

### Selection decision
- Selected model: `demand_model_v1` (HistGradientBoostingRegressor)
- Reason: Candidate demonstrates 13.5% lower MAE and WAPE on 7-day horizon, and 11.2% lower MAE on 14-day horizon.
- Baseline retained as fallback: Yes (`baseline_v1` actively loaded in `ModelLoader`)
- Evidence: Unseen chronological test split evaluation across all 500 time series.
- Any limitations: Longer horizons (> 30 days) experience slight error accumulation under recursive simulation; addressed by regular model re-training.

---

## 6. Model Versioning State

### Current model
- Model version: `demand_model_v1`
- Model type: `HistGradientBoostingRegressor`
- Training timestamp: `2026-09-03T22:07:44`
- Dataset version: `synthetic_2025_v1`
- Feature version: `v1.0`
- Artifact path: `models/demand/demand_model_v1.joblib`
- Metrics: Included in `models/demand/demand_model_v1_meta.json`
- Selected/fallback: `SELECTED`
- Loader verified: Yes (`ModelLoader` verified via pytest)

---

## 7. Stock-Out Risk State

### Logic
- Current stock used: Yes (from DB or payload)
- Forecast demand used: Yes (daily burn rate = forecast / horizon)
- Lead time used: Yes (default 7 days)
- Safety/minimum stock used: Yes (min_stock)
- Threshold configuration: Deterministic categories: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`

### Tests
- Normal: Tested (`test_risk.py`)
- Low stock: Tested (`test_risk.py`)
- High demand: Tested (`test_risk.py`)
- Critical: Tested (`test_risk.py`)
- Safety-stock breach: Tested (`test_risk.py`)

### Example verified output
```json
{
  "risk_level": "CRITICAL",
  "stock_cover_days": 6.2,
  "daily_burn_rate": 241.49,
  "current_stock": 1500.0,
  "lead_time_days": 7,
  "projected_stock_before_replenishment": -190.43,
  "projected_deficit": 690.43,
  "min_stock": 500.0,
  "reorder_level": 1200.0,
  "reorder_recommended": true,
  "recommended_order_quantity": 6244.7,
  "risk_factors": [
    "Projected stock will hit 0 in 6.2 days (before 7-day lead time replenishment)."
  ]
}
```

---

## 8. Expiry Risk State

### Logic implemented
- Expected consumption before expiry: FEFO projection
- Potential excess: `max(0, batch_quantity - expected_consumption_in_window)`
- Expiry thresholds: 60-day warning threshold
- Batch-level processing: Yes

### Tests
- Normal: Tested (`test_expiry.py`)
- Near expiry: Tested (`test_expiry.py`)
- Excess: Tested (`test_expiry.py`)
- Expired: Tested (`test_expiry.py`)

### Example verified output
```json
{
  "overall_status": "WARNING_EXPIRY_EXCESS",
  "as_of_date": "2025-01-12",
  "daily_burn_rate": 5.0,
  "total_stock": 500.0,
  "expired_quantity": 0.0,
  "at_risk_excess_quantity": 400.0,
  "safe_quantity": 0.0,
  "batches": [
    {
      "batch_id": "BAT-002",
      "quantity": 500.0,
      "expiry_date": "2025-02-01",
      "days_to_expiry": 20,
      "status": "EXCESS_EXPIRING",
      "potential_excess_quantity": 400.0,
      "recommended_action": "RECOMMEND_REDISTRIBUTION"
    }
  ]
}
```

---

## 9. Redistribution State

### Logic
- Surplus detection: `current_stock > min_stock + (daily_burn * 14 days)`
- Deficit detection: `risk_level in ["CRITICAL", "HIGH"]`
- Same-resource constraint: Enforced
- Safety buffer: 14 days donor safety buffer preserved
- Predicted demand: Factored in burn rate
- Distance: Haversine distance in km
- Priority: Urgency-based (CRITICAL > HIGH) and proximity-ranked
- Quantity constraint: `min(donor_surplus, recipient_deficit)`
- Lead time: Factored in donor buffer

### Current approach
- Heuristic with Haversine distance and donor protection

### Tests
- Surplus + deficit: Tested (`test_redistribution.py`)
- No feasible surplus: Tested (`test_redistribution.py`)
- Insufficient surplus: Tested (`test_redistribution.py`)
- Distance constraint: Tested (`test_redistribution.py`)

### Example verified output
```json
{
  "resource_id": "RES001",
  "total_recommendations": 1,
  "recommendations": [
    {
      "source_facility_id": "FAC002",
      "source_facility_name": "North District Hospital",
      "destination_facility_id": "FAC001",
      "destination_facility_name": "Central District Hospital",
      "resource_id": "RES001",
      "resource_name": "Paracetamol 500mg",
      "recommended_quantity": 2500,
      "distance_km": 35.8,
      "priority": "HIGH",
      "reason": "Recipient Central District Hospital is in CRITICAL stock-out risk (1.2 days cover). Donor North District Hospital has sufficient surplus stock. Recommended transfer of 2500 units over 35.8 km.",
      "requires_human_approval": true
    }
  ],
  "notice": "All redistribution recommendations are non-autonomous and require human operational verification and approval."
}
```

---

## 10. Scenario Simulation State

Supported multipliers:
- [x] +20%
- [x] +40%
- [x] +60%
- [x] +100%

### Verification
- Scenario demand calculated: Yes
- Actual inventory unchanged: Yes (verified isolated)
- Real data unchanged: Yes
- Scenario clearly labelled: `is_simulation: true`
- Risk recalculated: Yes

---

## 11. API State

### Endpoints
- [x] POST `/v1/forecast`
- [x] POST `/v1/forecast/batch`
- [x] GET `/v1/models`
- [x] GET `/v1/health`
- [x] POST `/v1/scenario`
- [x] POST `/v1/redistribution`

### API verification
- Valid request: Tested (HTTP 200)
- Invalid request: Tested (HTTP 422)
- Empty request: Tested
- Insufficient history: Tested (graceful baseline fallback)
- Unsupported horizon: Tested (validation error)
- Model unavailable: Tested (automatic baseline fallback)
- Stale model: Tested (staleness flag exposed)
- Malformed input: Tested (HTTP 422)
- NaN prevention: Verified (clipped to non-negative floats)
- Structured errors: Verified (FastAPI global handler)
- OpenAPI verified: Interactive `/docs` and `/redoc` generated

### Current API version
- Version: 1.0.0
- Base path: `/v1`
- Run command: `uvicorn api.main:app --host 0.0.0.0 --port 8000`

---

## 12. Monitoring / Reliability State

- Data freshness: Verified via synthetic pipeline
- Schema monitoring: `DataValidator` module
- Prediction failure monitoring: Graceful fallback to `BaselineForecaster`
- Timeout handling: Sub-second inference time (< 15ms per series)
- Drift monitoring: Trackable via `/v1/models` evaluation metrics
- Fallback behavior: Fully automatic and transparent (`is_fallback: true` in response)

---

## 13. Testing State

### Test summary
- Total tests: 28
- Passed: 28
- Failed: 0
- Skipped: 0
- Last test run: 2026-09-03
- Command: `PYTHONPATH=. .venv/bin/pytest tests/`

### Important test results
```text
============================= test session starts ==============================
collected 28 items

tests/test_api.py .........                                              [ 32%]
tests/test_data.py ..                                                    [ 39%]
tests/test_expiry.py ...                                                 [ 50%]
tests/test_features.py ...                                               [ 60%]
tests/test_forecasting.py ...                                            [ 71%]
tests/test_redistribution.py ...                                         [ 82%]
tests/test_risk.py ...                                                   [ 92%]
tests/test_scenario.py ..                                                [100%]

======================== 28 passed in 3.53s ========================
```

### Known failing tests
None.

---

## 14. Docker / Deployment State

- Dockerfile: Created (`python:3.11-slim` with healthcheck)
- Image name: `mediguard-ml-engine:latest` (Successfully built: 1.1GB)
- Container runs: Verified live container (`mediguard-ml-test`) on port 8000
- Health endpoint verified: Live HTTP 200 response on `http://localhost:8000/v1/health`
- Forecast endpoint verified: Live HTTP 200 response on `http://localhost:8000/v1/forecast`
- Compose file: `docker-compose.yml`
- Environment variables: `PYTHONPATH=/app`
- Production concerns: Internal service behind API gateway; direct client exposure prohibited.

---

## 15. Backend Integration State

### Contract
- Forecast request schema: `ForecastRequest`
- Forecast response schema: `ForecastResponse`
- Batch request schema: `BatchForecastRequest`
- Risk response schema: `StockRiskResponse`
- Expiry response schema: `ExpiryRiskResponse`
- Redistribution response schema: `Dict[str, Any]` with `requires_human_approval: true`
- Scenario response schema: `Dict[str, Any]` with `is_simulation: true`
- Error schema: Standard RFC 7807 / JSON error object

### Integration status
- Authentication boundary respected: Auth owned by backend gateway
- Database boundary respected: ML operates on payload / cached data without direct DB mutation
- Frontend boundary respected: ML service is backend-internal

---

## 16. Files Changed

| Date | File | Change | Reason | Verified? |
|---|---|---|---|---|
| 2026-09-03 | `requirements.txt` | Created | Dependency specifications | Yes |
| 2026-09-03 | `src/data_generator.py` | Created | Synthetic data generation | Yes |
| 2026-09-03 | `src/validation.py` | Created | Data validation & integrity checks | Yes |
| 2026-09-03 | `src/preprocessing.py` | Created | Panel alignment & preprocessing | Yes |
| 2026-09-03 | `src/features.py` | Created | Leakage-safe feature engineering | Yes |
| 2026-09-03 | `src/evaluation.py` | Created | Time-series forecasting metrics | Yes |
| 2026-09-03 | `src/forecasting.py` | Created | Baseline, Candidate ML, ModelLoader | Yes |
| 2026-09-03 | `src/risk.py` | Created | Stock-out risk assessment | Yes |
| 2026-09-03 | `src/expiry.py` | Created | FEFO batch expiry analysis | Yes |
| 2026-09-03 | `src/redistribution.py` | Created | Transfer heuristics & distance math | Yes |
| 2026-09-03 | `src/scenario.py` | Created | Disaster demand surge simulation | Yes |
| 2026-09-03 | `api/schemas.py` | Created | Validated Pydantic request/response schemas | Yes |
| 2026-09-03 | `api/routes.py` | Created | REST inference endpoints | Yes |
| 2026-09-03 | `api/main.py` | Created | FastAPI server & CORS setup | Yes |
| 2026-09-03 | `tests/test_*.py` | Created | 8 test modules with 28 automated tests | Yes |
| 2026-09-03 | `Dockerfile` | Created | Containerization & healthcheck | Yes |
| 2026-09-03 | `docker-compose.yml` | Created | Container orchestration | Yes |
| 2026-09-03 | `README.md` | Created | Architecture, math, and API docs | Yes |
| 2026-09-03 | `MEDIGUARD_ML_PROGRESS.md` | Updated | State documentation | Yes |

---

## 17. Important Decisions

| Date | Decision | Reason |
|---|---|---|
| 2026-09-03 | Select `demand_model_v1` (HistGradientBoosting) | Demonstrated 13.5% lower MAE on 7d horizon compared to baseline on chronological test set. |
| 2026-09-03 | Retain Baseline as active fallback in `ModelLoader` | Guarantees 100% inference availability even if candidate model fails or history is short (< 28 days). |
| 2026-09-03 | Enforce `requires_human_approval: true` on all redistribution | Strict safety adherence to decision-support governance. |
| 2026-09-03 | Strict chronological time-series splitting | Prevents data leakage and simulates real sequential operational forecasting. |

---

## 18. Issues / Bugs / Blockers

| ID | Issue | Severity | Status | Fix |
|---|---|---|---|---|
| BUG-001 | Missing `Any` import in `src/features.py` | Low | Resolved | Added `Any` to typing import |
| BUG-002 | Pydantic v2 `example` deprecation warnings | Low | Resolved | Converted to `examples=[...]` |

---

## 19. Change Log

### 2026-09-03
- Initialized project architecture and virtual environment.
- Implemented and executed synthetic data generator generating 182,500 consumption records.
- Implemented and executed comprehensive data validation suite.
- Built leakage-safe feature engineering pipeline.
- Implemented and evaluated baseline and HistGradientBoosting candidate models on chronological test split.
- Implemented stock-out risk, batch-level FEFO expiry risk, redistribution heuristic, and emergency surge simulation.
- Built FastAPI inference service with batch support and OpenAPI specs.
- Built 28 automated unit and integration tests passing in ~3.5s.
- Authored Docker configuration, integration contracts, and README.

---

## 20. Next Action

### Immediate next step
- ML Engine is fully complete, tested, and verified. Ready for backend API integration and presentation.

---

## 21. Resume Instructions

When continuing or extending the project:
1. Read this file completely.
2. Read `MEDIGUARD_ML_REQUIREMENTS.md` completely.
3. Activate virtualenv (`source .venv/bin/activate`).
4. Run test suite (`PYTHONPATH=. pytest tests/`) to verify state.
