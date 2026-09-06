"""Services layer for business logic."""

import os
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone
from google import genai
from sqlalchemy.orm import Session
from app.config import settings
from app.models import Inventory, Alert, Prediction, StockLevel, AlertSeverity


class MLService:
    """ML Engine service interface - supports mock for development."""

    def __init__(self):
        self.mock_mode = settings.ML_ENGINE_MOCK
            # client initialization will be done per service, no global configure needed

    def predict_demand(
        self,
        facility_id: int,
        item_id: int,
        item_name: str,
        historical_data: List[int]
    ) -> Dict[str, Any]:
        """
        Predict demand for an inventory item.
        Returns prediction with confidence score.
        """
        if self.mock_mode:
            # Mock prediction - calculate based on recent average with some variance
            if historical_data:
                avg_demand = sum(historical_data) / len(historical_data)
                predicted = int(avg_demand * 1.1)  # 10% increase
            else:
                predicted = 50
            return {
                "predicted_demand": predicted,
                "confidence": 0.75,
                "predicted_date": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
            }

        # Real ML Engine call would go here
        return {
            "predicted_demand": 50,
            "confidence": 0.75,
            "predicted_date": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        }

    def assess_risk(
        self,
        facility_id: int,
        inventory_items: List[Inventory]
    ) -> List[Dict[str, Any]]:
        """
        Assess supply chain risk for facility.
        Returns list of risk factors with severity.
        """
        if self.mock_mode:
            risks = []
            for item in inventory_items:
                if item.stock_level == StockLevel.CRITICAL:
                    risks.append({
                        "item_id": item.id,
                        "item_name": item.item_name,
                        "severity": AlertSeverity.CRITICAL,
                        "risk_score": 0.9,
                        "description": f"Critical stock level: {item.current_stock} {item.unit} remaining"
                    })
                elif item.stock_level == StockLevel.LOW:
                    risks.append({
                        "item_id": item.id,
                        "item_name": item.item_name,
                        "severity": AlertSeverity.HIGH,
                        "risk_score": 0.6,
                        "description": f"Low stock: {item.current_stock} {item.unit} (min: {item.min_threshold})"
                    })
            return risks

        # Real ML Engine call would go here
        return []


class AIService:
    """Google Gemini AI service for natural language processing."""

    def __init__(self):
        self.mock_mode = not bool(settings.GEMINI_API_KEY)
        if not self.mock_mode:
            self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

    def query(self, user_query: str, context: Optional[str] = None) -> str:
        """
        Answer user query about supply chain using AI.
        """
        if self.mock_mode:
            # Mock response for development
            return self._mock_response(user_query)

        # Build prompt with context
        prompt = self._build_prompt(user_query, context)
        try:
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            return response.text
        except Exception as e:
            return f"I apologize, but I encountered an error processing your request: {str(e)}"

    def explain_prediction(
        self,
        prediction_data: Dict[str, Any],
        risk_factors: List[Dict[str, Any]]
    ) -> str:
        """
        Generate natural language explanation of a prediction.
        """
        if self.mock_mode:
            return self._mock_explanation(prediction_data, risk_factors)

        prompt = f"""Explain this supply chain prediction in clear terms:

Prediction: {prediction_data.get('predicted_demand')} units predicted with {prediction_data.get('confidence')*100:.0f}% confidence

Risk Factors: {risk_factors}

Provide a concise explanation that a healthcare administrator can understand."""

        try:
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            return response.text
        except Exception as e:
            return f"Error generating explanation: {str(e)}"

    def summarize_report(
        self,
        report_data: Dict[str, Any]
    ) -> str:
        """
        Generate AI summary of a report.
        """
        if self.mock_mode:
            return "Report summary: Overall supply chain status is stable. 3 critical alerts require attention."

        prompt = f"""Summarize this healthcare supply chain report in 2-3 sentences:

{report_data}

Provide key insights and recommended actions."""

        try:
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            return f"Error generating summary: {str(e)}"

    def _build_prompt(self, query: str, context: Optional[str]) -> str:
        """Build prompt for AI query."""
        base_prompt = """You are a helpful healthcare supply chain assistant.
Answer questions about inventory management, supply chain logistics, and healthcare resources.
Provide clear, actionable information.

"""
        if context:
            base_prompt += f"Relevant context:\n{context}\n\n"

        base_prompt += f"Question: {query}\n\nAnswer:"
        return base_prompt

    def _mock_response(self, query: str) -> str:
        """Generate mock response for development."""
        query_lower = query.lower()

        if "stock" in query_lower or "inventory" in query_lower:
            return "Based on the current inventory data, most facilities are maintaining adequate stock levels. However, there are 3 items with critical stock levels that require immediate attention: Surgical Gloves (Box), Paracetamol 500mg (Tablet), and IV Solution 1L (Unit)."

        if "alert" in query_lower or "risk" in query_lower:
            return "There are currently 5 active alerts: 1 critical, 2 high, and 2 medium severity. The critical alert is for Surgical Gloves at Central Hospital warehouse. Recommended action: Immediate replenishment order."

        if "demand" in query_lower or "forecast" in query_lower:
            return "Demand forecasting shows increased demand for flu medications in the next 2 weeks. Predicted demand for Paracetamol 500mg is approximately 15,000 units, representing a 12% increase from current periods."

        return "I can help you with questions about inventory levels, risk alerts, demand forecasting, and supply chain recommendations. What would you like to know more about?"

    def _mock_explanation(
        self,
        prediction: Dict[str, Any],
        risks: List[Dict[str, Any]]
    ) -> str:
        """Generate mock explanation for development."""
        predicted = prediction.get('predicted_demand', 0)
        confidence = prediction.get('confidence', 0) * 100

        explanation = f"The system predicts a demand of approximately {predicted} units for the next period with {confidence:.0f}% confidence. "

        if risks:
            explanation += "However, there are some risk factors to consider: "
            for risk in risks[:2]:
                explanation += f"- {risk.get('description', 'Unknown risk')}. "
        else:
            explanation += "Current stock levels appear adequate to meet this predicted demand."

        return explanation


# Service instances
ml_service = MLService()
ai_service = AIService()

from app.services.ml_adapter_service import MLAdapterService, ml_adapter_service
from app.services.alert_service import AlertService, alert_service
from app.services.redistribution_service import RedistributionService
from app.services.gemini_service import (
    GeminiService,
    gemini_service,
    GeminiAPIException,
    GeminiTimeoutException,
    GeminiConnectionException,
    GeminiResponseException,
)