"""Pydantic contracts for location comparison, mission stress test, and mission windows."""

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import (
    AnalysisRequest,
    AnalysisResponse,
    Hours,
    Latitude,
    Longitude,
)


class CoordinateCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str | None = Field(default=None, max_length=80)
    latitude_deg: Latitude
    longitude_deg: Longitude


class ProvenanceSummary(BaseModel):
    source_measurements: list[str]
    calculated_estimates: list[str]
    assumed_values: list[str]
    unavailable_information: list[str]


# --- 1. Location Comparison ---
class CompareRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    locations: Annotated[list[CoordinateCandidate], Field(min_length=2, max_length=3)]
    start_utc: datetime
    duration_hours: Hours = 144
    include_terrain: bool = True

    @field_validator("start_utc", mode="before")
    @classmethod
    def validate_utc(cls, value: object) -> datetime:
        return AnalysisRequest.require_utc(value)


class ComparedLocationItem(BaseModel):
    label: str
    latitude_deg: Latitude
    longitude_deg: Longitude
    status: Literal["ok", "error"]
    error: str | None = None
    visibility: AnalysisResponse | None = None
    terrain: dict[str, Any] | None = None
    terrain_available: bool = False


class CompareResponse(BaseModel):
    start_utc: datetime
    duration_hours: Hours
    results: list[ComparedLocationItem]
    tradeoffs: list[str]
    provenance: ProvenanceSummary


# --- 2. Mission Stress Test ---
class ScenarioWindow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_utc: datetime
    duration_hours: Hours = 144

    @field_validator("start_utc", mode="before")
    @classmethod
    def validate_utc(cls, value: object) -> datetime:
        return AnalysisRequest.require_utc(value)


class StressTestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    latitude_deg: Latitude
    longitude_deg: Longitude
    baseline: ScenarioWindow
    variant: ScenarioWindow


class ScenarioDeltas(BaseModel):
    sunlight_percent_delta: float
    earth_visibility_percent_delta: float
    longest_darkness_hours_delta: int
    longest_earth_gap_hours_delta: int
    duration_hours_delta: int


class StressTestResponse(BaseModel):
    latitude_deg: Latitude
    longitude_deg: Longitude
    baseline: AnalysisResponse
    variant: AnalysisResponse
    deltas: ScenarioDeltas
    warnings: list[str]
    provenance: ProvenanceSummary


# --- 3. Optional Bounded Mission Windows ---
class MissionWindowsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    latitude_deg: Latitude
    longitude_deg: Longitude
    target_start_utc: datetime
    duration_hours: Hours = 144
    candidate_offsets_days: Annotated[list[int], Field(min_length=2, max_length=10)] = [-6, -3, 0, 3, 6]
    priority: Literal["balanced", "max_sunlight", "min_earth_gap"] = "balanced"

    @field_validator("target_start_utc", mode="before")
    @classmethod
    def validate_utc(cls, value: object) -> datetime:
        return AnalysisRequest.require_utc(value)


class EvaluatedWindowItem(BaseModel):
    offset_days: int
    start_utc: datetime
    status: Literal["ok", "error"]
    error: str | None = None
    visibility: AnalysisResponse | None = None
    score: float | None = None


class MissionWindowsResponse(BaseModel):
    latitude_deg: Latitude
    longitude_deg: Longitude
    duration_hours: Hours
    selection_criteria: str
    tested_offsets_days: list[int]
    evaluated_windows: list[EvaluatedWindowItem]
    preferred_window: EvaluatedWindowItem | None
    tradeoffs: list[str]
    is_globally_optimal: bool = False
    provenance: ProvenanceSummary
