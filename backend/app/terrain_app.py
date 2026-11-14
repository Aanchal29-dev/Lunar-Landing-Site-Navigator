"""Standalone FastAPI application for lunar terrain analysis."""
from fastapi import FastAPI

from .terrain_router import router

app = FastAPI(title="Lunar Terrain Analysis API")
app.include_router(router)
