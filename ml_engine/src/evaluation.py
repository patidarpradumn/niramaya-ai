"""
MediGuard AI - Evaluation Module
Computes standard time-series forecasting evaluation metrics:
- MAE (Mean Absolute Error)
- RMSE (Root Mean Squared Error)
- WAPE (Weighted Absolute Percentage Error)
- sMAPE (Symmetric Mean Absolute Percentage Error)
Also provides chronological cross-validation and test evaluation harness.
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, List, Union


def compute_metrics(
    y_true: Union[np.ndarray, pd.Series, List[float]],
    y_pred: Union[np.ndarray, pd.Series, List[float]]
) -> Dict[str, float]:
    """
    Calculates MAE, RMSE, WAPE, and sMAPE.
    Guarantees robust calculation without division by zero.
    """
    y_true = np.asarray(y_true, dtype=np.float64)
    y_pred = np.asarray(y_pred, dtype=np.float64)
    
    # Clip negative predictions to 0
    y_pred = np.clip(y_pred, a_min=0, a_max=None)
    
    # MAE
    mae = float(np.mean(np.abs(y_true - y_pred)))
    
    # RMSE
    rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
    
    # WAPE = sum(|y - y_hat|) / sum(y)
    sum_true = np.sum(y_true)
    if sum_true > 0:
        wape = float(np.sum(np.abs(y_true - y_pred)) / sum_true)
    else:
        wape = 0.0 if np.sum(np.abs(y_pred)) == 0 else 1.0
        
    # sMAPE = (100 / n) * sum( 2 * |y - y_hat| / (|y| + |y_hat| + eps) )
    eps = 1e-8
    denominator = np.abs(y_true) + np.abs(y_pred) + eps
    smape = float(np.mean(200.0 * np.abs(y_true - y_pred) / denominator))
    
    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "wape": round(wape, 4),
        "smape": round(smape, 4)
    }
