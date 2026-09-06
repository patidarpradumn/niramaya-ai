"""Centralized exception handling for FastAPI."""

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging

logger = logging.getLogger("mediguard.exceptions")


class CustomAPIException(Exception):
    """Base custom API exception."""
    def __init__(self, status_code: int, detail: str, code: str = "API_ERROR"):
        self.status_code = status_code
        self.detail = detail
        self.code = code


def register_exception_handlers(app: FastAPI) -> None:
    """Register centralized exception handlers to the FastAPI app."""

    @app.exception_handler(CustomAPIException)
    async def custom_api_exception_handler(request: Request, exc: CustomAPIException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "code": exc.code,
                    "message": exc.detail,
                }
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        detail_msg = str(exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "detail": detail_msg,
                "error": {
                    "code": f"HTTP_{exc.status_code}",
                    "message": detail_msg,
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content=jsonable_encoder({
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed",
                    "details": exc.errors(),
                }
            }),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred. Please try again later.",
                }
            },
        )
