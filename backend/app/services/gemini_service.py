"""
Gemini AI Integration Service for Niramaya AI.

Provides natural language decision-support intelligence including:
- Alert explanations
- Prediction explanations
- Redistribution recommendation explanations
- Facility and district summaries
- Intent-classified, database-grounded AI chat
- Multilingual assistance

Enforces strict safety, privacy, anti-hallucination, anti-diagnosis, and RBAC rules.
"""

import os
import logging
from typing import Dict, Any, List, Optional
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from app.config import settings

logger = logging.getLogger(__name__)

# Try importing google.generativeai safely
try:
    # pyrefly: ignore [missing-import]
    from google import genai
    GENAI_AVAILABLE = True
except ImportError:
    genai = None
    GENAI_AVAILABLE = False


DEFAULT_AI_DISCLAIMER = (
    "Decision-Support Notice: Niramaya AI outputs are for decision support only. "
    "Final operational, administrative, and resource allocation decisions must be confirmed by authorized personnel."
)

SYSTEM_SAFETY_INSTRUCTION = (
    "You are Niramaya AI, an AI decision-support intelligence assistant for public healthcare supply chain and resource management.\n\n"
    "MANDATORY SAFETY & GROUNDING DIRECTIVES:\n"
    "1. Grounding: Rely strictly on the provided factual context from the backend application database.\n"
    "2. Factuality: NEVER invent, hallucinate, or alter inventory numbers, stock quantities, facility names, or metrics.\n"
    "3. No Autonomous Actions: You do NOT make autonomous government, administrative, or procurement decisions. You provide decision-support explanations and insights only.\n"
    "4. No Medical Advice: You MUST NOT diagnose patient conditions, offer clinical treatment advice, or prescribe medications.\n"
    "5. Privacy & Confidentiality: Do NOT request or reveal sensitive personal data, user credentials, passwords, tokens, or security keys.\n"
    "6. Language: If a specific language is requested, respond fluently in that language while maintaining exact numbers, item codes, and facility names.\n"
)


class GeminiAPIException(Exception):
    """Base exception for Gemini AI service errors."""
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class GeminiTimeoutException(GeminiAPIException):
    """Raised when Gemini API request times out."""
    def __init__(self, message: str = "Gemini AI service request timed out"):
        super().__init__(message, status_code=504)


class GeminiConnectionException(GeminiAPIException):
    """Raised when connecting to Gemini AI service fails."""
    def __init__(self, message: str = "Unable to connect to Gemini AI service"):
        super().__init__(message, status_code=503)


class GeminiResponseException(GeminiAPIException):
    """Raised when Gemini API returns an invalid or empty response."""
    def __init__(self, message: str = "Gemini AI service returned invalid or malformed response"):
        super().__init__(message, status_code=502)


class GeminiService:
    """
    Dedicated service for interacting with Google Gemini API
    with safety guardrails, grounding, and mock support.
    """

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = getattr(settings, "GEMINI_MODEL", "gemini-1.5-flash")
        self.timeout = getattr(settings, "GEMINI_TIMEOUT", 10.0)
        self.mock_mode = settings.GEMINI_MOCK or not bool(self.api_key) or not GENAI_AVAILABLE

        if not self.mock_mode and GENAI_AVAILABLE and self.api_key:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"Failed to initialize Real Gemini Model: {e}. Falling back to mock mode.")
                self.mock_mode = True

    def _call_gemini_raw(self, prompt: str) -> str:
        """Execute raw call to Gemini API with timeout & exception handling."""
        if self.mock_mode:
            raise GeminiAPIException("Call requested in mock mode", status_code=500)

        def _generate():
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=SYSTEM_SAFETY_INSTRUCTION + "\n\n" + prompt
            )
            if not response or not hasattr(response, "text") or not response.text:
                raise GeminiResponseException("Gemini returned empty text response")
            return response.text.strip()

        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_generate)
            try:
                result = future.result(timeout=self.timeout)
                return result
            except FuturesTimeoutError:
                raise GeminiTimeoutException(f"Gemini API request timed out after {self.timeout} seconds")
            except GeminiAPIException:
                raise
            except Exception as e:
                err_str = str(e).lower()
                if "connection" in err_str or "unreachable" in err_str or "dns" in err_str:
                    raise GeminiConnectionException(f"Failed to connect to Gemini API: {str(e)}")
                elif "invalid" in err_str or "bad" in err_str or "parse" in err_str:
                    raise GeminiResponseException(f"Invalid response from Gemini API: {str(e)}")
                else:
                    raise GeminiAPIException(f"Gemini API error: {str(e)}", status_code=500)

    def explain_alert(self, alert_data: Dict[str, Any], language: str = "English") -> Dict[str, Any]:
        """Generate a grounded natural language explanation for an alert."""
        if self.mock_mode:
            return self._mock_alert_explanation(alert_data, language)

        prompt = (
            f"Please explain the following healthcare supply chain alert in {language}:\n\n"
            f"Alert Title: {alert_data.get('title')}\n"
            f"Severity: {alert_data.get('severity')}\n"
            f"Facility: {alert_data.get('facility_name', 'Facility #' + str(alert_data.get('facility_id')))}\n"
            f"Item: {alert_data.get('item_name', 'N/A')}\n"
            f"Description: {alert_data.get('description')}\n"
            f"Creation Time: {alert_data.get('created_at')}\n"
            f"Metadata Details: {alert_data.get('metadata')}\n\n"
            f"Instructions:\n"
            f"1. Explain why this alert was generated and its severity implications.\n"
            f"2. Suggest high-level operational review considerations without replacing official protocol.\n"
            f"3. Respond in {language}.\n"
        )
        try:
            explanation = self._call_gemini_raw(prompt)
            return {"explanation": explanation, "disclaimer": DEFAULT_AI_DISCLAIMER}
        except GeminiAPIException:
            # Fallback to deterministic mock if configured or fail gracefully
            return self._mock_alert_explanation(alert_data, language)

    def explain_prediction(self, prediction_data: Dict[str, Any], language: str = "English") -> Dict[str, Any]:
        """Generate a grounded natural language explanation for an ML prediction."""
        if self.mock_mode:
            return self._mock_prediction_explanation(prediction_data, language)

        prompt = (
            f"Please explain the following supply chain ML prediction in {language}:\n\n"
            f"Prediction ID: {prediction_data.get('id')}\n"
            f"Facility: {prediction_data.get('facility_name', 'Facility #' + str(prediction_data.get('facility_id')))}\n"
            f"Item: {prediction_data.get('item_name', 'Item #' + str(prediction_data.get('item_id')))}\n"
            f"Predicted Demand: {prediction_data.get('predicted_demand')} units\n"
            f"Confidence Level: {float(prediction_data.get('confidence', 0.0)) * 100:.1f}%\n"
            f"Prediction Date: {prediction_data.get('predicted_date')}\n\n"
            f"Instructions:\n"
            f"1. Explain what this demand forecast indicates for resource planning.\n"
            f"2. Discuss the significance of the confidence rating.\n"
            f"3. Respond in {language}.\n"
        )
        try:
            explanation = self._call_gemini_raw(prompt)
            return {"explanation": explanation, "disclaimer": DEFAULT_AI_DISCLAIMER}
        except GeminiAPIException:
            return self._mock_prediction_explanation(prediction_data, language)

    def explain_recommendation(self, recommendation_data: Dict[str, Any], language: str = "English") -> Dict[str, Any]:
        """Generate a grounded natural language explanation for a redistribution recommendation."""
        if self.mock_mode:
            return self._mock_recommendation_explanation(recommendation_data, language)

        prompt = (
            f"Please explain the following inter-facility stock redistribution recommendation in {language}:\n\n"
            f"Recommendation ID: {recommendation_data.get('id')}\n"
            f"Source Facility (Surplus): {recommendation_data.get('source_facility_name', 'Facility #' + str(recommendation_data.get('source_facility_id')))}\n"
            f"Destination Facility (Deficit): {recommendation_data.get('destination_facility_name', 'Facility #' + str(recommendation_data.get('destination_facility_id')))}\n"
            f"Item: {recommendation_data.get('item_name', 'Item #' + str(recommendation_data.get('item_id')))}\n"
            f"Recommended Quantity: {recommendation_data.get('recommended_quantity')} units\n"
            f"Distance: {recommendation_data.get('distance_km', 'N/A')} km\n"
            f"Priority Score: {recommendation_data.get('priority')}\n"
            f"Rationale: {recommendation_data.get('rationale')}\n\n"
            f"Instructions:\n"
            f"1. Explain why this transfer is proposed between these facilities.\n"
            f"2. Emphasize that this is decision support requiring authorized human approval before execution.\n"
            f"3. Respond in {language}.\n"
        )
        try:
            explanation = self._call_gemini_raw(prompt)
            return {"explanation": explanation, "disclaimer": DEFAULT_AI_DISCLAIMER}
        except GeminiAPIException:
            return self._mock_recommendation_explanation(recommendation_data, language)

    def generate_facility_summary(self, facility_data: Dict[str, Any], language: str = "English") -> Dict[str, Any]:
        """Generate a comprehensive natural language operational summary for a facility."""
        if self.mock_mode:
            return self._mock_facility_summary(facility_data, language)

        prompt = (
            f"Please generate an operational supply chain summary for facility '{facility_data.get('name')}' in {language}:\n\n"
            f"Facility Details: Type: {facility_data.get('facility_type')}, Location: {facility_data.get('district')}, {facility_data.get('state')}\n"
            f"Inventory Stats: Total Items Tracked: {facility_data.get('total_inventory_items')}, Low Stock Items: {facility_data.get('low_stock_count')}\n"
            f"Active Alerts: Critical: {facility_data.get('critical_alerts')}, High: {facility_data.get('high_alerts')}, Total Active: {facility_data.get('total_active_alerts')}\n"
            f"Equipment Status: Total Equipment: {facility_data.get('total_equipment')}, Operational: {facility_data.get('operational_equipment')}, Non-Functional: {facility_data.get('non_functional_equipment')}\n\n"
            f"Instructions:\n"
            f"1. Summarize current inventory health, critical risks, and equipment readiness.\n"
            f"2. Highlight key priority areas for facility managers.\n"
            f"3. Respond in {language}.\n"
        )
        try:
            summary = self._call_gemini_raw(prompt)
            insights = [
                f"Facility tracks {facility_data.get('total_inventory_items')} inventory lines with {facility_data.get('low_stock_count')} low stock alerts.",
                f"Active alert count stands at {facility_data.get('total_active_alerts')} ({facility_data.get('critical_alerts')} critical).",
                f"Equipment readiness is at {facility_data.get('operational_equipment')}/{facility_data.get('total_equipment')} operational units."
            ]
            return {"summary": summary, "key_insights": insights, "disclaimer": DEFAULT_AI_DISCLAIMER}
        except GeminiAPIException:
            return self._mock_facility_summary(facility_data, language)

    def generate_district_summary(self, district_data: Dict[str, Any], language: str = "English") -> Dict[str, Any]:
        """Generate a comprehensive natural language operational summary for a district."""
        if self.mock_mode:
            return self._mock_district_summary(district_data, language)

        prompt = (
            f"Please generate a district-level healthcare supply chain summary for District '{district_data.get('district_name')}' in {language}:\n\n"
            f"District Details: State: {district_data.get('state_name')}, Total Facilities: {district_data.get('total_facilities')}\n"
            f"District Stock Health: Total Inventory Lines: {district_data.get('total_inventory_items')}, Low Stock Lines: {district_data.get('total_low_stock')}\n"
            f"District Alerts: Total Active Alerts: {district_data.get('total_alerts')}, Critical Alerts: {district_data.get('critical_alerts')}\n"
            f"High Risk Facilities: {district_data.get('high_risk_facilities')}\n\n"
            f"Instructions:\n"
            f"1. Provide a high-level overview of district supply chain stability.\n"
            f"2. Identify facilities needing immediate support.\n"
            f"3. Respond in {language}.\n"
        )
        try:
            summary = self._call_gemini_raw(prompt)
            insights = [
                f"District oversees {district_data.get('total_facilities')} healthcare facilities.",
                f"Total critical alerts across district: {district_data.get('critical_alerts')}.",
                f"Facilities needing immediate support: {', '.join(district_data.get('high_risk_facilities', [])) or 'None'}"
            ]
            return {"summary": summary, "key_insights": insights, "disclaimer": DEFAULT_AI_DISCLAIMER}
        except GeminiAPIException:
            return self._mock_district_summary(district_data, language)

    def chat_with_grounded_context(
        self,
        query: str,
        intent_classified: str,
        grounded_facts: Dict[str, Any],
        sources_used: List[str],
        language: str = "English"
    ) -> Dict[str, Any]:
        """
        Synthesize natural-language answer to user query strictly grounded in database facts.
        """
        if self.mock_mode:
            return self._mock_chat_response(query, intent_classified, grounded_facts, sources_used, language)

        prompt = (
            f"User Question: {query}\n"
            f"Classified Intent: {intent_classified}\n"
            f"Requested Language: {language}\n\n"
            f"TRUSTED DATABASE FACTS (Rely ONLY on these facts):\n"
            f"{grounded_facts}\n\n"
            f"Instructions:\n"
            f"1. Answer the user's question clearly in {language}.\n"
            f"2. Use ONLY the provided database facts. Do NOT hallucinate numbers, names, or items.\n"
            f"3. Do NOT provide medical diagnosis or treatment advice.\n"
            f"4. Reiterate that this information is for administrative decision-support.\n"
        )
        try:
            text = self._call_gemini_raw(prompt)
            return {
                "response": text,
                "intent_classified": intent_classified,
                "sources_used": sources_used,
                "disclaimer": DEFAULT_AI_DISCLAIMER
            }
        except GeminiAPIException:
            return self._mock_chat_response(query, intent_classified, grounded_facts, sources_used, language)

    # ------------------------------------------------------------------
    # MOCK RESPONSE GENERATORS (Deterministic, Grounded, Fallback)
    # ------------------------------------------------------------------

    def _mock_alert_explanation(self, alert_data: Dict[str, Any], language: str) -> Dict[str, Any]:
        severity = alert_data.get("severity", "MEDIUM")
        title = alert_data.get("title", "Supply Chain Alert")
        facility = alert_data.get("facility_name") or f"Facility #{alert_data.get('facility_id', 'N/A')}"
        item = alert_data.get("item_name") or "Medical Resource"
        desc = alert_data.get("description", "")

        explanation = (
            f"[{language}] Alert Summary for '{title}' at {facility}:\n"
            f"This {severity} severity alert was triggered because {desc or 'resource levels crossed configured threshold'}. "
            f"Specifically for item '{item}', immediate administrative review is recommended to evaluate stock replenishment "
            f"or redistribution options before clinical operations are impacted."
        )
        return {"explanation": explanation, "disclaimer": DEFAULT_AI_DISCLAIMER}

    def _mock_prediction_explanation(self, prediction_data: Dict[str, Any], language: str) -> Dict[str, Any]:
        demand = prediction_data.get("predicted_demand", 0)
        confidence = float(prediction_data.get("confidence", 0.0)) * 100
        facility = prediction_data.get("facility_name") or f"Facility #{prediction_data.get('facility_id', 'N/A')}"
        item = prediction_data.get("item_name") or "Item"

        explanation = (
            f"[{language}] Forecast Analysis for '{item}' at {facility}:\n"
            f"The predictive model projects a demand of {demand} units over the upcoming prediction window with a "
            f"confidence score of {confidence:.1f}%. This estimate is based on historical consumption trends and seasonal variance. "
            f"Facility managers should verify existing buffer stock against this projected demand."
        )
        return {"explanation": explanation, "disclaimer": DEFAULT_AI_DISCLAIMER}

    def _mock_recommendation_explanation(self, recommendation_data: Dict[str, Any], language: str) -> Dict[str, Any]:
        src = recommendation_data.get("source_facility_name") or f"Facility #{recommendation_data.get('source_facility_id')}"
        dst = recommendation_data.get("destination_facility_name") or f"Facility #{recommendation_data.get('destination_facility_id')}"
        qty = recommendation_data.get("recommended_quantity", 0)
        item = recommendation_data.get("item_name") or "Resource"
        dist = recommendation_data.get("distance_km", "N/A")

        explanation = (
            f"[{language}] Redistribution Proposal Explanation:\n"
            f"Recommends transferring {qty} units of '{item}' from {src} (surplus facility) to {dst} (deficit facility) "
            f"over a travel distance of approx {dist} km. This recommendation optimizes regional stock balance and prevents stockout risks. "
            f"Note: This is a decision-support proposal and requires human authorization to generate an actual transfer order."
        )
        return {"explanation": explanation, "disclaimer": DEFAULT_AI_DISCLAIMER}

    def _mock_facility_summary(self, facility_data: Dict[str, Any], language: str) -> Dict[str, Any]:
        name = facility_data.get("name", "Facility")
        tot_inv = facility_data.get("total_inventory_items", 0)
        low_stock = facility_data.get("low_stock_count", 0)
        act_alerts = facility_data.get("total_active_alerts", 0)
        crit_alerts = facility_data.get("critical_alerts", 0)

        summary = (
            f"[{language}] Executive Summary for {name}:\n"
            f"The facility currently tracks {tot_inv} inventory items, with {low_stock} items operating below minimum safety thresholds. "
            f"There are {act_alerts} active alerts ({crit_alerts} critical). Equipment availability and operational readiness are being monitored."
        )
        insights = [
            f"Facility tracks {tot_inv} inventory lines with {low_stock} low stock alerts.",
            f"Active alert count: {act_alerts} ({crit_alerts} critical).",
            f"Operational status: Active operational monitoring."
        ]
        return {"summary": summary, "key_insights": insights, "disclaimer": DEFAULT_AI_DISCLAIMER}

    def _mock_district_summary(self, district_data: Dict[str, Any], language: str) -> Dict[str, Any]:
        dname = district_data.get("district_name", "District")
        tot_fac = district_data.get("total_facilities", 0)
        tot_alerts = district_data.get("total_alerts", 0)
        crit_alerts = district_data.get("critical_alerts", 0)

        summary = (
            f"[{language}] District Supply Chain Summary for {dname}:\n"
            f"District {dname} manages {tot_fac} healthcare facilities. Across all facilities, there are {tot_alerts} active alerts "
            f"({crit_alerts} classified as critical). Regional stock redistribution and proactive monitoring are advised for high-risk locations."
        )
        insights = [
            f"District oversees {tot_fac} facilities.",
            f"Total critical alerts across district: {crit_alerts}.",
            f"High-risk facilities identified for priority support."
        ]
        return {"summary": summary, "key_insights": insights, "disclaimer": DEFAULT_AI_DISCLAIMER}

    def _mock_chat_response(
        self,
        query: str,
        intent_classified: str,
        grounded_facts: Dict[str, Any],
        sources_used: List[str],
        language: str
    ) -> Dict[str, Any]:
        query_lower = query.lower()

        # Medical advice / prescription protection check
        if any(term in query_lower for term in ["prescribe", "diagnosis", "cure", "dosage for patient", "treat illness"]):
            response_text = (
                f"[{language}] Safety Notice: Niramaya AI is strictly restricted from providing medical diagnosis, "
                f"treatment protocols, or medication prescriptions. Please consult a licensed medical professional for clinical guidance."
            )
            return {
                "response": response_text,
                "intent_classified": "CLINICAL_MEDICAL_QUERY_BLOCKED",
                "sources_used": ["SafetyPolicy"],
                "disclaimer": DEFAULT_AI_DISCLAIMER
            }

        # Autonomous decision refusal check
        if any(term in query_lower for term in ["approve transfer automatically", "change database", "delete record"]):
            response_text = (
                f"[{language}] Policy Notice: Niramaya AI cannot perform autonomous administrative changes or government decisions. "
                f"Actions must be approved by authorized personnel using system workflows."
            )
            return {
                "response": response_text,
                "intent_classified": "AUTONOMOUS_ACTION_BLOCKED",
                "sources_used": ["PolicyGuard"],
                "disclaimer": DEFAULT_AI_DISCLAIMER
            }

        # Grounded response based on facts retrieved
        if intent_classified == "INVENTORY_QUERY":
            items = grounded_facts.get("inventory_items", [])
            response_text = f"[{language}] Grounded Inventory Status:\n"
            if items:
                response_text += f"Retrieved {len(items)} item(s) from database: " + ", ".join(
                    [f"{it.get('item_name')}: {it.get('current_stock')} {it.get('unit', 'units')}" for it in items[:5]]
                ) + "."
            else:
                response_text += "No matching inventory records found for your requested parameters."

        elif intent_classified == "ALERT_QUERY":
            alerts = grounded_facts.get("alerts", [])
            response_text = f"[{language}] Active Alerts Summary:\n"
            if alerts:
                response_text += f"Retrieved {len(alerts)} active alert(s) from database: " + ", ".join(
                    [f"[{al.get('severity')}] {al.get('title')}" for al in alerts[:5]]
                ) + "."
            else:
                response_text += "No active alerts currently recorded for your facility/district."

        elif intent_classified == "RECOMMENDATION_QUERY":
            recs = grounded_facts.get("recommendations", [])
            response_text = f"[{language}] Redistribution Proposals:\n"
            if recs:
                response_text += f"Found {len(recs)} active recommendation(s) in database."
            else:
                response_text += "No active stock redistribution recommendations found."

        else:
            stats = grounded_facts.get("system_stats", {})
            response_text = (
                f"[{language}] System Operational Overview:\n"
                f"The database currently records {stats.get('total_facilities', 0)} facilities, "
                f"{stats.get('total_inventory_lines', 0)} inventory lines, and {stats.get('active_alerts', 0)} active alerts. "
                f"How else can I assist with decision support?"
            )

        return {
            "response": response_text,
            "intent_classified": intent_classified,
            "sources_used": sources_used,
            "disclaimer": DEFAULT_AI_DISCLAIMER
        }


# Singleton instance of GeminiService
gemini_service = GeminiService()
