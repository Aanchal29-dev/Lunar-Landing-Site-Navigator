from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_ANALYSIS_RADIUS_M = 5_000.0

class TerrainRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    latitude_deg: float = Field(strict=True, ge=-90, le=90, allow_inf_nan=False)
    longitude_deg: float = Field(strict=True, allow_inf_nan=False)
    analysis_radius_m: float = Field(
        default=500, strict=True, gt=0, le=MAX_ANALYSIS_RADIUS_M, allow_inf_nan=False
    )

    @field_validator("longitude_deg")
    @classmethod
    def signed_east_longitude(cls, value: float) -> float:
        # Preserve legacy wrapped/0..360 inputs, but return a coordinate that the
        # visibility API can accept unchanged. Positive 180 is the boundary.
        longitude = value % 360.0
        return longitude if longitude <= 180 else longitude - 360.0

class Location(BaseModel):
    latitude_deg: float
    longitude_deg: float

class PixelMetrics(BaseModel):
    row: int | None
    column: int | None
    elevation_m: float | None
    slope_deg: float | None

class RegionMetrics(BaseModel):
    analysis_radius_m: float
    mean_elevation_m: float | None
    elevation_range_m: float | None
    mean_slope_deg: float | None
    maximum_slope_deg: float | None
    elevation_stddev_m_roughness_proxy: float | None
    valid_pixel_count: int
    total_pixel_count: int
    valid_pixel_percentage: float
    valid_data_percentage: float
    requested_area_coverage_percentage: float
    coverage_status: str

class RasterInfo(BaseModel):
    resolution_m: float
    crs: str
    dataset_provenance: str
    dataset_source_url: str
    dataset_limitations: list[str]

class TerrainResponse(BaseModel):
    terrain_available: bool
    location: Location
    pixel: PixelMetrics
    region: RegionMetrics
    raster: RasterInfo
    warnings: list[str]
