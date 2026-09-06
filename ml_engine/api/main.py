"""
MediGuard AI - ML Engine FastAPI Application
Provides production-ready REST inference APIs for public health supply chain resilience.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from api.routes import router

app = FastAPI(
    title="MediGuard AI - ML Forecasting & Decision Support Engine",
    description=(
        "Production ML Engine providing deterministic, evidence-based healthcare demand forecasting, "
        "stock-out risk assessment, batch expiry monitoring, redistribution heuristics, and emergency surge simulation. "
        "Strictly operates under decision-support guidelines where operational transfers require human approval."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration for authorized backend gateway
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # ML service is internal to backend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/", summary="Root Status")
def root_status():
    return {
        "service": "MediGuard AI ML Engine",
        "status": "online",
        "documentation": "/docs",
        "health_check": "/v1/health",
        "models_info": "/v1/models"
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": "InternalMLEngineError",
            "message": str(exc),
            "detail": "An unexpected error occurred during inference."
        }
    )


if __name__ == "__main__":
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
