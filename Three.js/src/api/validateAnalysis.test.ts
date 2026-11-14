import { describe, expect, it } from "vitest";
import { assertAnalysisResponse } from "./validateAnalysis";

const valid = {
  location: { latitude_deg: 0, longitude_deg: 0 }, start_utc: "2026-11-20T00:00:00Z", end_utc: "2026-11-20T01:00:00Z",
  duration_hours: 1, sampling_minutes: 60,
  metrics: { sunlight_percent: 100, earth_visibility_percent: 100, longest_darkness_hours: 0, longest_earth_gap_hours: 0 },
  timeline: [{ interval_start_utc: "2026-11-20T00:00:00Z", interval_end_utc: "2026-11-20T01:00:00Z", sample_utc: "2026-11-20T00:30:00Z", sun_azimuth_deg: 0, sun_elevation_deg: 1, earth_azimuth_deg: 0, earth_elevation_deg: 1, sun_visible: true, earth_visible: true }],
  model: { type: "simplified_geometric_horizon", horizon_degrees: 0, site_altitude_km: 0, terrain_obstruction_included: false, sampling_method: "hourly_midpoints", source: "NASA JPL Horizons", lunar_reference_frame: "MOON_ME", lunar_radii_km: [1737.4, 1737.4, 1737.4], limitations: [] },
};

describe("analysis response boundary", () => {
  it("accepts a complete aligned timeline", () => expect(assertAnalysisResponse(valid)).toBe(valid));
  it("rejects a response whose timeline length differs from its mission duration", () => expect(() => assertAnalysisResponse({ ...valid, duration_hours: 2 })).toThrow("hourly timeline"));
});
