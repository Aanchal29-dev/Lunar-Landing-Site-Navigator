"""Explicit API contracts for the optional Lunar Exploration Assistant."""

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AssistantModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AssistantContext(AssistantModel):
    latitude_deg: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    longitude_deg: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)
    start_utc: datetime | None = None
    duration_hours: int | None = Field(default=None, ge=1, le=336)

    @field_validator("start_utc")
    @classmethod
    def explicit_utc(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.utcoffset() != UTC.utcoffset(value):
            raise ValueError("start_utc must have an explicit UTC timezone")
        return value.astimezone(UTC) if value is not None else None

    def has_visibility_window(self) -> bool:
        return all(value is not None for value in (
            self.latitude_deg, self.longitude_deg, self.start_utc, self.duration_hours,
        ))


class AssistantChatRequest(AssistantModel):
    message: str = Field(min_length=1, max_length=2_000)
    context: AssistantContext = Field(default_factory=AssistantContext)

    @field_validator("message")
    @classmethod
    def tidy_message(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("message must not be blank")
        return text


class AssistantCitation(AssistantModel):
    title: str = Field(min_length=1, max_length=300)
    url: str = Field(min_length=1, max_length=2_000)


class AssistantChatResponse(AssistantModel):
    status: Literal["ok", "needs_input", "unavailable"]
    answer: str = Field(min_length=1, max_length=8_000)
    citations: list[AssistantCitation] = Field(default_factory=list, max_length=5)
    used_visibility_engine: bool = False


class AssistantStatus(AssistantModel):
    configured: bool
    model: str | None = None
    detail: str
