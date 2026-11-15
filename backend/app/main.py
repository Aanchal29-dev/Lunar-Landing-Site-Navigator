"""FastAPI entry point for the shared Lunar Compass backend."""

import os
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.comparison_router import router as comparison_router
from app.historical_router import router as historical_router
from app.models import AnalysisRequest, AnalysisResponse
from app.services.historical_missions import validate_historical_dataset
from app.services.horizons import HorizonsError, TIMEOUT, _user_agent
from app.services.visibility import analyze_visibility
from app.terrain_service import terrain_dataset_is_ready
from app.terrain_router import router as terrain_router
from app.water_ice_router import router as water_ice_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_historical_dataset()
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        app.state.http_client = client
        yield


def _safe_error_text(value: object) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="backslashreplace")
    if isinstance(value, str):
        return value.encode("utf-8", errors="backslashreplace").decode("utf-8")
    return "Invalid request"


def _nasa_contact_is_configured() -> bool:
    try:
        _user_agent()
    except HorizonsError:
        return False
    return True


def _terrain_dataset_is_ready() -> bool:
    return terrain_dataset_is_ready()


def create_app() -> FastAPI:
    app = FastAPI(title="Lunar Compass Backend", version=__version__, lifespan=lifespan)
    default_origins = (
        "http://localhost:3000,http://localhost:5173,http://localhost:5174,"
        "http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:5174,"
        "http://localhost:5500,http://127.0.0.1:5500,http://localhost:8000,http://127.0.0.1:8000"
    )
    origins = [origin.strip() for origin in os.getenv(
        "ALLOWED_ORIGINS", default_origins
    ).split(",") if origin.strip()]
    if any("*" in origin for origin in origins):
        raise ValueError("ALLOWED_ORIGINS must contain explicit origins, not wildcards")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    @app.exception_handler(HorizonsError)
    async def horizons_error(request: Request, exc: HorizonsError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Raw input and exception context can contain unsafe or private values.
        errors = [{
            "type": _safe_error_text(error["type"]),
            "loc": [part if type(part) is int else _safe_error_text(part) for part in error["loc"]],
            "msg": _safe_error_text(error["msg"]),
        } for error in exc.errors()]
        return JSONResponse(status_code=422, content={"detail": errors})

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/ready")
    async def readiness() -> JSONResponse:
        """Report local deployment prerequisites without contacting NASA."""
        nasa_contact = _nasa_contact_is_configured()
        terrain_dataset = _terrain_dataset_is_ready()
        ready = nasa_contact and terrain_dataset
        return JSONResponse(
            status_code=200 if ready else 503,
            content={
                "status": "ready" if ready else "not_ready",
                "nasa_contact_configured": nasa_contact,
                "terrain_dataset_ready": terrain_dataset,
                "nasa_live_check_performed": False,
            },
        )

    @app.post("/api/analyze", response_model=AnalysisResponse)
    async def analyze(
        body: AnalysisRequest, client: httpx.AsyncClient = Depends(get_http_client)
    ) -> AnalysisResponse:
        return await analyze_visibility(body, client)
    app.include_router(terrain_router)
    app.include_router(historical_router)
    app.include_router(comparison_router)
    app.include_router(water_ice_router)

    return app

def get_http_client(request: Request) -> httpx.AsyncClient:
    return request.app.state.http_client


app = create_app()
