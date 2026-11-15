import { assertAnalysisResponse } from "./validateAnalysis";
import { assertTerrainResponse } from "./validateTerrain";
import type { CompareResponse, MissionWindowsResponse, Provenance, StressTestResponse } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object"; }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every((item) => typeof item === "string"); }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }

function assertProvenance(value: unknown): asserts value is Provenance {
  if (!isRecord(value) || !strings(value.source_measurements) || !strings(value.calculated_estimates) || !strings(value.assumed_values) || !strings(value.unavailable_information)) {
    throw new Error("The response is missing scientific provenance.");
  }
}

function assertComparisonItem(value: unknown): void {
  if (!isRecord(value) || typeof value.label !== "string" || !finite(value.latitude_deg) || !finite(value.longitude_deg) || (value.status !== "ok" && value.status !== "error") || (value.error !== null && typeof value.error !== "string")) {
    throw new Error("The comparison response has an invalid site result.");
  }
  if (value.visibility !== null) assertAnalysisResponse(value.visibility);
  if (value.status === "ok" && value.visibility === null) throw new Error("A successful comparison site is missing visibility data.");
  if (value.terrain && isRecord(value.terrain) && value.terrain.terrain_available === true) assertTerrainResponse(value.terrain);
  if (value.terrain && isRecord(value.terrain) && value.terrain.terrain_available === false && !strings(value.terrain.warnings)) throw new Error("The unavailable terrain summary is invalid.");
}

export function assertCompareResponse(value: unknown): CompareResponse {
  if (!isRecord(value) || typeof value.start_utc !== "string" || !Number.isInteger(value.duration_hours) || !Array.isArray(value.results) || !strings(value.tradeoffs)) throw new Error("The comparison response is missing required data.");
  value.results.forEach(assertComparisonItem);
  assertProvenance(value.provenance);
  return value as CompareResponse;
}

export function assertStressTestResponse(value: unknown): StressTestResponse {
  if (!isRecord(value) || !finite(value.latitude_deg) || !finite(value.longitude_deg) || !isRecord(value.deltas) || !strings(value.warnings)) throw new Error("The stress-test response is missing required data.");
  const deltas = value.deltas;
  assertAnalysisResponse(value.baseline);
  assertAnalysisResponse(value.variant);
  if (!["sunlight_percent_delta", "earth_visibility_percent_delta", "longest_darkness_hours_delta", "longest_earth_gap_hours_delta", "duration_hours_delta"].every((key) => finite(deltas[key]))) throw new Error("The stress-test response has invalid deltas.");
  assertProvenance(value.provenance);
  return value as StressTestResponse;
}

export function assertMissionWindowsResponse(value: unknown): MissionWindowsResponse {
  if (!isRecord(value) || !finite(value.latitude_deg) || !finite(value.longitude_deg) || !Number.isInteger(value.duration_hours) || typeof value.selection_criteria !== "string" || !Array.isArray(value.tested_offsets_days) || !strings(value.tradeoffs) || value.is_globally_optimal !== false || !Array.isArray(value.evaluated_windows)) throw new Error("The mission-windows response is missing required data.");
  for (const item of value.evaluated_windows) {
    if (!isRecord(item) || !Number.isInteger(item.offset_days) || typeof item.start_utc !== "string" || (item.status !== "ok" && item.status !== "error") || (item.error !== null && typeof item.error !== "string") || (item.score !== null && !finite(item.score))) throw new Error("The mission-windows response has an invalid candidate.");
    if (item.visibility !== null) assertAnalysisResponse(item.visibility);
    if (item.status === "ok" && item.visibility === null) throw new Error("A successful mission-window candidate is missing visibility data.");
  }
  if (value.preferred_window !== null) {
    const preferred = value.preferred_window;
    if (!isRecord(preferred) || !value.evaluated_windows.some((item) => isRecord(item) && item.offset_days === preferred.offset_days && item.start_utc === preferred.start_utc)) {
      throw new Error("The preferred mission window is not an evaluated candidate.");
    }
  }
  assertProvenance(value.provenance);
  return value as MissionWindowsResponse;
}
