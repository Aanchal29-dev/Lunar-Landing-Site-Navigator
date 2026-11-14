"""Typed contracts for historical lunar-mission data and replay inputs."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

from app.data.historical_missions import DEFAULT_REPLAY_DURATION_HOURS


class HistoricalModel(BaseModel):
    """Base configuration shared by historical mission contracts."""

    model_config = ConfigDict(extra="forbid")


class SourceCitation(HistoricalModel):
    """A dataset source and the facts it supports."""

    key: str = Field(min_length=1)
    title: str = Field(min_length=1)
    url: HttpUrl
    supports: str = Field(min_length=1)


class MissionLocation(HistoricalModel):
    """A documented intended, actual landing, or impact location."""

    name: str = Field(min_length=1)
    latitude_deg: float = Field(ge=-90, le=90)
    longitude_deg: float = Field(ge=0, lt=360)
    location_type: str = Field(min_length=1)
    coordinate_quality: str = Field(min_length=1)
    precision_or_uncertainty: str = Field(min_length=1)
    coordinate_reference: str = Field(min_length=1)
    original_coordinate_text: str = Field(min_length=1)
    source_keys: list[str] = Field(min_length=1)


class MissionMarkerLocation(HistoricalModel):
    """Location fields required for a mission list map marker."""

    latitude_deg: float = Field(ge=-90, le=90)
    longitude_deg: float = Field(ge=0, lt=360)
    location_type: str = Field(min_length=1)
    coordinate_quality: str = Field(min_length=1)


class ReplayMetadata(HistoricalModel):
    """Whether a mission can be replayed and which historical site it uses."""

    status: Literal["eligible", "eligible_with_location_note", "ineligible"]
    location_field: Literal["actual_location", "intended_location"]
    label: str = Field(min_length=1)


class MissionSummary(HistoricalModel):
    """Compact mission data used by mission lists and map views."""

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    country: str = Field(min_length=1)
    operator: str = Field(min_length=1)
    event_time_utc: datetime
    time_precision: str = Field(min_length=1)
    landing_outcome: str = Field(min_length=1)
    marker_location: MissionMarkerLocation
    replay: ReplayMetadata

    @field_validator("event_time_utc")
    @classmethod
    def event_time_must_be_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() != timedelta(0):
            raise ValueError("event_time_utc must be a UTC timestamp")
        return value


class MissionDetail(HistoricalModel):
    """Full historical record and provenance for one mission."""

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    spacecraft_or_lander: str = Field(min_length=1)
    country: str = Field(min_length=1)
    operator: str = Field(min_length=1)
    event_time_utc: datetime
    time_precision: str = Field(min_length=1)
    event_description: str = Field(min_length=1)
    mission_objective: str = Field(min_length=1)
    landing_outcome: str = Field(min_length=1)
    overall_mission_outcome: str = Field(min_length=1)
    documented_failure_reason: str | None = None
    what_happened: str = Field(min_length=1)
    achievements: str = Field(min_length=1)
    intended_location: MissionLocation
    actual_location: MissionLocation
    replay: ReplayMetadata
    media: list[dict[str, Any]] = Field(default_factory=list)
    sources: list[SourceCitation] = Field(min_length=1)

    @field_validator("event_time_utc")
    @classmethod
    def event_time_must_be_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() != timedelta(0):
            raise ValueError("event_time_utc must be a UTC timestamp")
        return value


class ReplayRequest(HistoricalModel):
    """Optional replay settings supplied by a client."""

    duration_hours: int = Field(default=DEFAULT_REPLAY_DURATION_HOURS, ge=1)


class ReplayHistoricalContext(HistoricalModel):
    """Historical labels retained alongside shared-engine replay inputs."""

    mission_id: str = Field(min_length=1)
    location_label: str = Field(min_length=1)
    location_type: str = Field(min_length=1)
    coordinate_quality: str = Field(min_length=1)


class HistoricalReplayInput(HistoricalModel):
    """Dataset-backed inputs for Nishan's shared visibility engine."""

    latitude_deg: float = Field(ge=-90, le=90)
    longitude_deg: float = Field(ge=0, lt=360)
    start_utc: datetime
    duration_hours: int = Field(ge=1)
    historical_context: ReplayHistoricalContext

    @field_validator("start_utc")
    @classmethod
    def start_time_must_be_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() != timedelta(0):
            raise ValueError("start_utc must be a UTC timestamp")
        return value


class ErrorResponse(HistoricalModel):
    """Standard error payload available to the route layer."""

    code: str = Field(min_length=1)
    message: str = Field(min_length=1)
    details: dict[str, Any] | None = None
