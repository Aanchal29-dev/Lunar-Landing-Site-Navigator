import type { AnalysisResponse, TimelineEntry } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isTimelineEntry(value: unknown): value is TimelineEntry {
  if (!isRecord(value)) return false;
  const row = value;
  return ["interval_start_utc", "interval_end_utc", "sample_utc"].every((key) => typeof row[key] === "string")
    && ["sun_azimuth_deg", "sun_elevation_deg", "earth_azimuth_deg", "earth_elevation_deg"].every((key) => isFiniteNumber(row[key]))
    && typeof row.sun_visible === "boolean" && typeof row.earth_visible === "boolean";
}

export function assertAnalysisResponse(value: unknown): AnalysisResponse {
  if (!isRecord(value)) throw new Error("The analysis response was not JSON data.");
  const response = value as Partial<AnalysisResponse>;
  if (!isRecord(response.location) || !isRecord(response.metrics) || !isRecord(response.model) || !Array.isArray(response.timeline)) {
    throw new Error("The analysis response is missing required scientific data.");
  }
  if (
    typeof response.start_utc !== "string" || typeof response.end_utc !== "string"
    || !isFiniteNumber(response.location.latitude_deg) || !isFiniteNumber(response.location.longitude_deg)
    || !["sunlight_percent", "earth_visibility_percent", "longest_darkness_hours", "longest_earth_gap_hours"].every((key) => isFiniteNumber(response.metrics?.[key as keyof typeof response.metrics]))
    || response.sampling_minutes !== 60
    || response.model.source !== "NASA JPL Horizons"
    || response.model.horizon_degrees !== 0
    || response.model.terrain_obstruction_included !== false
    || !Array.isArray(response.model.limitations) || !response.model.limitations.every((item) => typeof item === "string")
    || !Number.isInteger(response.duration_hours) || response.timeline.length !== response.duration_hours || !response.timeline.every(isTimelineEntry)
  ) {
    throw new Error("The analysis response has an invalid hourly timeline.");
  }
  return response as AnalysisResponse;
}
