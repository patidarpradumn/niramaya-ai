"""MediGuard AI Backend - Main Application Entry Point."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.db.session import init_db
from app.api.v1.api import api_router
from app.core.firebase import initialize_firebase

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mediguard.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    logger.info("Starting up MediGuard AI Backend Foundation...")
    init_db()
    initialize_firebase()
    yield
    logger.info("Shutting down MediGuard AI Backend...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import uuid
from fastapi import Request


@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    correlation_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.correlation_id = correlation_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = correlation_id
    return response


# Register Exception Handlers
register_exception_handlers(app)


# Include API Routers
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(api_router, prefix="/api")


@app.get("/", include_in_schema=False)
def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": "1.0.0",
        "docs": "/docs",
        "health": f"{settings.API_V1_STR}/health",
    }