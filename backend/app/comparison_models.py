"""Pydantic contracts for location comparison, mission stress test, and mission windows."""

from datetime import datetime, timedelta
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models import (
    AnalysisRequest,
    AnalysisResponse,
    Hours,
    Latitude,
    Longitude,
)
from app.terrain_models import TerrainResponse


OffsetDays = Annotated[int, Field(strict=True, ge=-365, le=365)]
HistoricalCompatibleLongitude = Annotated[
    float, Field(strict=True, ge=-180, le=360, allow_inf_nan=False)
]


def _validate_analysis_window(start_utc: datetime, duration_hours: int) -> None:
    """Apply the visibility engine's full mission-window limits at the API boundary."""
    AnalysisRequest(
        latitude_deg=0.0,
        longitude_deg=0.0,
        start_utc=start_utc,
        duration_hours=duration_hours,
    )


class CoordinateCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str | None = Field(default=None, max_length=80)
    latitude_deg: Latitude
    # Historical records use east-positive 0..360; the visibility engine uses -180..180.
    longitude_deg: HistoricalCompatibleLongitude

    @field_validator("longitude_deg")
    @classmethod
    def normalize_historical_longitude(cls, value: float) -> float:
        return value if value <= 180 else value - 360


class TerrainUnavailableSummary(BaseModel):
    """Safe terrain result when the local raster cannot be used by comparison."""

    model_config = ConfigDict(extra="forbid")

    terrain_available: Literal[False] = False
    warnings: list[str] = Field(min_length=1)


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

    @model_validator(mode="after")
    def validate_window(self) -> "CompareRequest":
        _validate_analysis_window(self.start_utc, self.duration_hours)
        return self


class ComparedLocationItem(BaseModel):
    label: str
    latitude_deg: Latitude
    longitude_deg: Longitude
    status: Literal["ok", "error"]
    error: str | None = None
    visibility: AnalysisResponse | None = None
    terrain: TerrainResponse | TerrainUnavailableSummary | None = None
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

    @model_validator(mode="after")
    def validate_window(self) -> "ScenarioWindow":
        _validate_analysis_window(self.start_utc, self.duration_hours)
        return self


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
    candidate_offsets_days: Annotated[list[OffsetDays], Field(min_length=2, max_length=10)] = Field(
        default_factory=lambda: [-6, -3, 0, 3, 6]
    )
    priority: Literal["balanced", "max_sunlight", "min_earth_gap"] = "balanced"

    @field_validator("target_start_utc", mode="before")
    @classmethod
    def validate_utc(cls, value: object) -> datetime:
        return AnalysisRequest.require_utc(value)

    @model_validator(mode="after")
    def validate_candidates(self) -> "MissionWindowsRequest":
        if len(set(self.candidate_offsets_days)) != len(self.candidate_offsets_days):
            raise ValueError("candidate_offsets_days must not contain duplicates")
        for offset in self.candidate_offsets_days:
            try:
                candidate_start = self.target_start_utc + timedelta(days=offset)
            except OverflowError as exc:
                raise ValueError("candidate offset produces an unsupported mission date") from exc
            _validate_analysis_window(candidate_start, self.duration_hours)
        return self


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
