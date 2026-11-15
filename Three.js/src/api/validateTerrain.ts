import type { TerrainResponse } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function finiteOrNull(value: unknown): boolean {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

export function assertTerrainResponse(value: unknown): TerrainResponse {
  if (!isRecord(value) || !isRecord(value.location) || !isRecord(value.pixel) || !isRecord(value.region) || !isRecord(value.raster)) {
    throw new Error("The terrain response is missing required data.");
  }
  const { location, pixel, region, raster } = value;
  const valid = typeof value.terrain_available === "boolean"
    && typeof location.latitude_deg === "number" && Number.isFinite(location.latitude_deg)
    && typeof location.longitude_deg === "number" && Number.isFinite(location.longitude_deg)
    && [pixel.elevation_m, pixel.slope_deg, region.mean_elevation_m, region.elevation_range_m, region.mean_slope_deg, region.maximum_slope_deg, region.elevation_stddev_m_roughness_proxy].every(finiteOrNull)
    && [region.analysis_radius_m, region.valid_pixel_count, region.total_pixel_count, region.valid_pixel_percentage, region.valid_data_percentage, region.requested_area_coverage_percentage, raster.resolution_m].every((item) => typeof item === "number" && Number.isFinite(item))
    && typeof region.coverage_status === "string"
    && typeof raster.dataset_provenance === "string" && typeof raster.dataset_source_url === "string"
    && Array.isArray(raster.dataset_limitations) && raster.dataset_limitations.every((item) => typeof item === "string")
    && Array.isArray(value.warnings) && value.warnings.every((item) => typeof item === "string");
  if (!valid) throw new Error("The terrain response has invalid measurement data.");
  return value as TerrainResponse;
}
