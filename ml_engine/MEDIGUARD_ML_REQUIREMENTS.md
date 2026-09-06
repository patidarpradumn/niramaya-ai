# MediGuard AI — ML Engine Requirements & Specification

## 1. Purpose

MediGuard AI is a decision-support platform for public healthcare resource and supply-chain resilience.

The ML Engine is responsible for:
- synthetic healthcare data generation
- data validation
- feature engineering
- demand forecasting
- baseline and candidate model evaluation
- model versioning/loading
- stock-out risk
- expiry risk
- redistribution recommendations
- emergency scenario simulation
- ML inference API
- automated testing
- Dockerization
- documentation and backend integration contract

### Core principle

**ML predicts/supports. The platform recommends. Authorized humans make final operational decisions.**

The ML engine must never autonomously procure, transfer, or make clinical decisions.

---

## 2. Scope

### In scope
1. Synthetic data generation
2. Data validation
3. Feature engineering
4. Demand forecasting
5. Baseline forecasting
6. Candidate ML model
7. Evaluation and model selection
8. Model versioning/loading
9. Stock-out risk
10. Expiry risk
11. Redistribution recommendation
12. Emergency scenario simulation
13. FastAPI ML service
14. Automated testing
15. Dockerization
16. README/documentation
17. Backend integration contract

### Out of scope
- Frontend
- Main backend
- Authentication
- Database ownership
- Disease diagnosis or treatment
- Autonomous procurement/transfer
- Unsupported corruption/fraud claims
- Unauthorized patient/private data
- Direct browser-to-ML communication

---

## 3. Data Specification

### Facility master

Fields:
- facility_id
- name
- type
- district_id
- state_id
- latitude
- longitude
- capacity
- active_status

Facility types can include:
- District Hospital
- CHC
- PHC

### Resource master

Use approximately 20–30 medicines/resources.

Fields:
- resource_id
- name
- category
- unit
- min_stock
- reorder_level
- shelf_life_days

### Consumption

Approximately:
20 facilities × 20–30 resources × 365 days = 146,000+ rows.

Fields:
- date
- facility_id
- resource_id
- quantity_consumed

### Inventory batch

Fields:
- facility_id
- resource_id
- batch_id
- quantity
- received_date
- expiry_date

### Supply

Optional initially.

Fields:
- resource_id
- supplier_id
- quantity
- order_date
- delivery_date
- lead_time_days
- unit_price

---

## 4. Synthetic Data Requirements

Data must be realistic, not pure random noise.

Synthetic data should contain:
- facility type differences
- resource-level differences
- weekly seasonality
- monthly/seasonal effects
- gradual trends
- demand spikes
- controlled shortages
- controlled surplus
- near-expiry inventory
- low-demand and high-demand resources

Requirements:
- fixed random seeds
- reproducible generation
- clearly labelled as synthetic
- internally consistent references and dates

---

## 5. Forecasting Requirements

Forecast horizons:
- 7 days
- 14 days
- 30 days

### Baseline

Start with a strong, simple baseline such as:
- moving average
- 7-day moving average
- seasonal naive where appropriate

### Candidate model

Preferred first candidate:
- HistGradientBoostingRegressor

Alternative time-series models may be used only when technically justified.

Do not use LSTM/Transformer merely to make the system appear advanced.

### Candidate features

Leakage-safe features may include:
- lag 1
- lag 7
- lag 14
- lag 28
- rolling mean 7
- rolling mean 14
- rolling mean 28
- rolling median
- rolling standard deviation
- day of week
- week
- month
- trend
- facility type
- resource category
- optional inventory context

All rolling/lag features must use only information available before the prediction point.

---

## 6. Evaluation Requirements

This is a time-series problem.

### Required split

Use chronological:
- training period
- validation period
- test period

Do NOT use random train_test_split as the primary evaluation.

### Metrics

Use:
- MAE
- RMSE
- WAPE
- sMAPE
- MAPE only when its denominator is suitable

The candidate model should meaningfully improve over the baseline.

If it does not, retain the baseline and document the reason.

**Never fabricate metrics, accuracy, confidence, or model performance.**

---

## 7. Model Versioning

Each trained model must have metadata including:
- model_version
- model_type
- training_timestamp
- dataset/version
- feature version
- train period
- validation period
- test period
- metrics
- selected/fallback status

Example:
`demand_model_v1`

Do not silently overwrite models.

---

## 8. Stock-Out Risk

Risk must be deterministic and explainable.

Use:
- current stock
- forecast demand
- lead time
- safety/minimum stock
- reorder thresholds

Example:
`stock_cover_days = current_stock / expected_daily_demand`

Suggested labels:
- CRITICAL
- HIGH
- MEDIUM
- LOW

Example logic:
- projected stock before replenishment <= 0 → CRITICAL
- projected stock below safety stock → HIGH
- otherwise configurable MEDIUM/LOW

Thresholds must remain configurable.

---

## 9. Expiry Risk

Expiry analysis must operate at batch level.

Calculate:
- expected consumption before expiry
- potential excess

Example:
`potential_excess = max(current_batch_quantity - expected_consumption_before_expiry, 0)`

Identify:
- safe
- approaching expiry
- excess before expiry
- expired

Thresholds must be configurable.

---

## 10. Redistribution Recommendation

Redistribution is a recommendation only.

Match:
- surplus facility
- deficit facility
- same resource

Consider:
- current stock
- safety buffer
- predicted demand/deficit
- facility priority
- distance
- transfer quantity constraints
- optional transfer lead time

Heuristic implementation is acceptable initially.

Optional future approach:
- linear programming
- min-cost flow

Output should contain:
- source facility
- destination facility
- resource
- recommended quantity
- reason
- distance
- priority

Never execute the transfer automatically.

---

## 11. Emergency Scenario Simulation

Support demand multipliers:
- +20%
- +40%
- +60%
- +100%

Formula:
`scenario_demand = normal_forecast × multiplier`

Scenario simulations must:
- be clearly labelled as simulated
- not modify actual inventory
- not modify real operational data
- return comparable risk outputs

---

## 12. API Requirements

Required endpoints:

### POST
`/v1/forecast`

### POST
`/v1/forecast/batch`

### GET
`/v1/models`

### GET
`/v1/health`

Optional:
`POST /v1/scenario`

API must:
- validate requests
- return structured errors
- never return NaN
- include model version
- include timestamp
- include quality metrics where appropriate
- clearly indicate stale/unavailable models
- handle insufficient history
- use versioned paths

Frontend must not communicate directly with the ML service.

---

## 13. Backend Boundary

### ML Engine owns
- training
- evaluation
- inference
- model versioning
- forecasting
- stock-out risk
- expiry risk
- redistribution recommendation
- scenario simulation
- ML API

### Backend owns
- authentication
- database
- persistence
- application APIs
- audit
- frontend gateway
- final approval

Frontend communicates only with backend.

---

## 14. Gemini / LLM Boundary

Gemini is an explanation layer, not the forecasting model.

ML produces structured evidence.

Backend may send authorized structured context to Gemini for:
- explanation
- summarization
- natural-language interpretation

Gemini must not:
- invent values
- invent metrics
- invent recommendations
- replace deterministic ML logic
- make autonomous operational decisions

---

## 15. Monitoring

Monitor:
- data freshness
- schema validity
- missing data
- prediction failures
- inference timeout
- post-hoc forecast error
- data drift
- segment degradation
- model staleness

If the model is unavailable or stale:
- do not fake a prediction
- return a clear unavailable/stale state
- use an explicitly documented fallback when available

---

## 16. Testing

### Data tests
- schema
- missing values
- negative quantities
- invalid dates
- duplicates
- invalid foreign-key references

### Forecast tests
- baseline
- chronological split
- leakage
- missing history
- insufficient history
- low/zero demand
- spikes
- seasonality
- nonnegative predictions

### Risk tests
- normal stock
- low stock
- high demand
- critical stock
- safety-stock breach

### Expiry tests
- normal batch
- near-expiry batch
- excess before expiry
- expired batch

### Redistribution tests
- surplus + deficit
- no feasible surplus
- insufficient surplus
- distance constraints

### Scenario tests
- all supported multipliers
- actual inventory remains unchanged

### API tests
- valid request
- invalid request
- empty request
- insufficient history
- unsupported horizon
- unavailable model
- stale model
- malformed input

---

## 17. Demo Scenarios

The system should support these demonstrations:

1. FAC001 District Hospital:
   increasing demand + low stock → HIGH/CRITICAL risk

2. FAC002 CHC:
   moderate demand + normal stock → normal risk

3. FAC003 PHC:
   low demand + sufficient stock → LOW risk

4. Near-expiry batch:
   low consumption + excess inventory → expiry warning

5. Redistribution:
   Facility A surplus → Facility B predicted deficit

6. No feasible redistribution:
   system returns no recommendation rather than inventing one

7. Emergency:
   +40% demand scenario

8. Stable:
   low-risk stable facility/resource

9. ML unavailable:
   explicit unavailable/fallback state

10. Stale model:
   explicit stale status

---

## 18. Technology Stack

Preferred:
- Python
- Pandas
- NumPy
- scikit-learn
- statsmodels/time-series libraries when justified
- FastAPI
- joblib/pickle with controlled versioning
- Docker

Do not tightly couple model training code to the production database.

---

## 19. Project Structure

```text
mediguard-ml/
├── data/
│   ├── raw/
│   ├── processed/
│   └── synthetic/
├── models/
│   ├── baseline/
│   └── demand/
├── src/
│   ├── data_generator.py
│   ├── validation.py
│   ├── preprocessing.py
│   ├── features.py
│   ├── forecasting.py
│   ├── evaluation.py
│   ├── risk.py
│   ├── expiry.py
│   ├── redistribution.py
│   └── scenario.py
├── api/
│   ├── main.py
│   ├── schemas.py
│   └── routes.py
├── tests/
├── notebooks/
├── requirements.txt
├── Dockerfile
└── README.md
```

---

## 20. Implementation Phases

1. Project structure/environment
2. Synthetic data generator
3. Data validation
4. Feature engineering
5. Baseline forecasting
6. Candidate ML model
7. Evaluation/model selection
8. Model versioning/loader
9. Stock-out + expiry risk
10. Redistribution heuristic
11. Emergency scenario
12. FastAPI
13. Automated testing
14. Docker + integration + README

---

## 21. Non-Negotiable Engineering Rules

1. Never fabricate results.
2. Never claim accuracy without actually running evaluation.
3. Never use random train/test splitting as the primary time-series evaluation.
4. Never allow future information into features.
5. Never silently overwrite model versions.
6. Never modify real inventory during scenarios.
7. Never autonomously execute procurement or redistribution.
8. Never invent unavailable predictions.
9. Preserve working code unless a change is justified.
10. Prefer simple, explainable models before complex models.
11. Every important change must be tested.
12. Keep the ML service independently runnable.
