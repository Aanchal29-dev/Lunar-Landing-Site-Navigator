"""Pydantic contracts for local lunar water-ice navigation planning."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


Latitude = Annotated[float, Field(strict=True, ge=-90, le=90, allow_inf_nan=False)]
InputLongitude = Annotated[float, Field(strict=True, ge=-180, le=360, allow_inf_nan=False)]
Longitude = Annotated[float, Field(strict=True, ge=-180, le=180, allow_inf_nan=False)]
RadiusKm = Annotated[float, Field(strict=True, gt=0, le=1_000, allow_inf_nan=False)]
PathSegments = Annotated[int, Field(strict=True, ge=1, le=100)]


class WaterIceModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Coordinate(WaterIceModel):
    latitude: Latitude
    longitude: Longitude


class AnalyzeSiteRequest(WaterIceModel):
    """User-selected landing coordinates and a bounded nearby-site search."""

    lat: Latitude
    lon: InputLongitude
    search_radius_km: RadiusKm = 250.0
    path_segments: PathSegments = 16

    @field_validator("lon")
    @classmethod
    def normalize_east_longitude(cls, value: float) -> float:
        longitude = value % 360.0
        return longitude if longitude <= 180 else longitude - 360.0


class WaterIceSite(WaterIceModel):
    id: Annotated[str, Field(min_length=1)]
    name: Annotated[str, Field(min_length=1)]
    latitude: Latitude
    longitude: Longitude
    ice_probability: Annotated[str, Field(min_length=1)]
    evidence_source: Annotated[str, Field(min_length=1)]
    description: Annotated[str, Field(min_length=1)]


class NearbyWaterIceSite(WaterIceSite):
    distance_km: Annotated[float, Field(ge=0, allow_inf_nan=False)]


class NavigationPath(WaterIceModel):
    type: Literal["great_circle_planning_line"] = "great_circle_planning_line"
    coordinates: Annotated[list[Coordinate], Field(min_length=2)]
    disclaimer: str = (
        "This is a great-circle planning line for map rendering only; it is not a "
        "terrain-aware, hazard-safe, or operational rover route."
    )


class AnalyzeSiteResponse(WaterIceModel):
    landing_coordinates: Coordinate
    search_radius_km: RadiusKm
    nearby_water_ice_sites: list[NearbyWaterIceSite]
    nearest_water_ice_site: NearbyWaterIceSite | None
    navigation_path: NavigationPath | None
    warnings: list[str]
