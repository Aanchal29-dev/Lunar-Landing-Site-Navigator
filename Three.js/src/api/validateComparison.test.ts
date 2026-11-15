import { describe, expect, it } from "vitest";

import { assertCompareResponse, assertMissionWindowsResponse, assertStressTestResponse } from "./validateComparison";

const analysis = {
  location: { latitude_deg: -85.2, longitude_deg: 32.5 }, start_utc: "2026-11-20T00:00:00Z", end_utc: "2026-11-20T01:00:00Z", duration_hours: 1, sampling_minutes: 60,
  metrics: { sunlight_percent: 100, earth_visibility_percent: 100, longest_darkness_hours: 0, longest_earth_gap_hours: 0 },
  model: { type: "simplified_geometric_horizon", horizon_degrees: 0, site_altitude_km: 0, terrain_obstruction_included: false, sampling_method: "hourly_midpoints", source: "NASA JPL Horizons", lunar_reference_frame: "MOON_ME", lunar_radii_km: [1737.4, 1737.4, 1737.4], limitations: [] },
  timeline: [{ interval_start_utc: "2026-11-20T00:00:00Z", interval_end_utc: "2026-11-20T01:00:00Z", sample_utc: "2026-11-20T00:30:00Z", sun_azimuth_deg: 0, sun_elevation_deg: 1, earth_azimuth_deg: 0, earth_elevation_deg: 1, sun_visible: true, earth_visible: true }],
};
const provenance = { source_measurements: [], calculated_estimates: [], assumed_values: [], unavailable_information: [] };

describe("comparison API boundary", () => {
  it("accepts a source-backed site comparison and bounded window result", () => {
    const compared = { label: "Site A", latitude_deg: -85.2, longitude_deg: 32.5, status: "ok", error: null, visibility: analysis, terrain: null, terrain_available: false };
    expect(assertCompareResponse({ start_utc: analysis.start_utc, duration_hours: 1, results: [compared, { ...compared, label: "Site B" }], tradeoffs: [], provenance }).results).toHaveLength(2);
    const candidate = { offset_days: 0, start_utc: analysis.start_utc, status: "ok", error: null, visibility: analysis, score: 10 };
    expect(assertMissionWindowsResponse({ latitude_deg: -85.2, longitude_deg: 32.5, duration_hours: 1, selection_criteria: "Balanced", tested_offsets_days: [0, 3], evaluated_windows: [candidate, { ...candidate, offset_days: 3 }], preferred_window: { ...candidate }, tradeoffs: [], is_globally_optimal: false, provenance }).preferred_window?.offset_days).toBe(0);
  });

  it("rejects a stress result without all required deltas", () => {
    expect(() => assertStressTestResponse({ latitude_deg: -85.2, longitude_deg: 32.5, baseline: analysis, variant: analysis, deltas: {}, warnings: [], provenance })).toThrow("invalid deltas");
  });
});
