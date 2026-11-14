import type { AnalysisResponse, TimelineEntry } from "./types";

function isTimelineEntry(value: unknown): value is TimelineEntry {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return ["interval_start_utc", "interval_end_utc", "sample_utc"].every((key) => typeof row[key] === "string")
    && ["sun_azimuth_deg", "sun_elevation_deg", "earth_azimuth_deg", "earth_elevation_deg"].every((key) => typeof row[key] === "number")
    && typeof row.sun_visible === "boolean" && typeof row.earth_visible === "boolean";
}

export function assertAnalysisResponse(value: unknown): AnalysisResponse {
  if (!value || typeof value !== "object") throw new Error("The analysis response was not JSON data.");
  const response = value as Partial<AnalysisResponse>;
  if (!response.location || !response.metrics || !response.model || !Array.isArray(response.timeline)) {
    throw new Error("The analysis response is missing required scientific data.");
  }
  if (!Number.isInteger(response.duration_hours) || response.timeline.length !== response.duration_hours || !response.timeline.every(isTimelineEntry)) {
    throw new Error("The analysis response has an invalid hourly timeline.");
  }
  return response as AnalysisResponse;
}
