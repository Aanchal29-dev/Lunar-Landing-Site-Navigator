import { assertAnalysisResponse } from "./validateAnalysis";
import type { HistoricalReplayResponse, MissionDetail, MissionSummary } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object"; }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every((item) => typeof item === "string"); }

function assertReplay(value: unknown): void {
  if (!isRecord(value) || !["eligible", "eligible_with_location_note", "ineligible"].includes(String(value.status)) || (value.location_field !== "actual_location" && value.location_field !== "intended_location") || typeof value.label !== "string") throw new Error("The mission replay metadata is invalid.");
}

function assertMarker(value: unknown): void {
  if (!isRecord(value) || !finite(value.latitude_deg) || !finite(value.longitude_deg) || typeof value.location_type !== "string" || typeof value.coordinate_quality !== "string") throw new Error("The mission marker location is invalid.");
}

function assertSummary(value: unknown): void {
  if (!isRecord(value) || !["id", "name", "country", "operator", "event_time_utc", "time_precision", "landing_outcome"].every((key) => typeof value[key] === "string")) throw new Error("The mission summary is invalid.");
  assertMarker(value.marker_location);
  assertReplay(value.replay);
}

export function assertMissionSummaries(value: unknown): MissionSummary[] {
  if (!Array.isArray(value)) throw new Error("The mission list was not an array.");
  value.forEach(assertSummary);
  return value as MissionSummary[];
}

function assertLocation(value: unknown): void {
  if (!isRecord(value) || !["name", "location_type", "coordinate_quality", "precision_or_uncertainty", "coordinate_reference", "original_coordinate_text"].every((key) => typeof value[key] === "string") || !finite(value.latitude_deg) || !finite(value.longitude_deg) || !strings(value.source_keys)) throw new Error("The documented mission location is invalid.");
}

export function assertMissionDetail(value: unknown): MissionDetail {
  assertSummary(value);
  if (!isRecord(value) || !["spacecraft_or_lander", "event_description", "mission_objective", "overall_mission_outcome", "what_happened", "achievements"].every((key) => typeof value[key] === "string") || (value.documented_failure_reason !== null && typeof value.documented_failure_reason !== "string") || !Array.isArray(value.sources) || value.sources.length === 0) throw new Error("The mission detail is incomplete.");
  assertLocation(value.intended_location);
  assertLocation(value.actual_location);
  if (!value.sources.every((source) => isRecord(source) && ["key", "title", "url", "supports"].every((key) => typeof source[key] === "string"))) throw new Error("The mission sources are invalid.");
  return value as MissionDetail;
}

export function assertHistoricalReplayResponse(value: unknown): HistoricalReplayResponse {
  if (!isRecord(value)) throw new Error("The historical replay response is incomplete.");
  const context = value.historical_context;
  if (!isRecord(context) || !["mission_id", "location_label", "location_type", "coordinate_quality"].every((key) => typeof context[key] === "string")) throw new Error("The historical replay response is incomplete.");
  assertAnalysisResponse(value.analysis);
  return value as HistoricalReplayResponse;
}
