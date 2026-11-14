import { afterEach, describe, expect, it, vi } from "vitest";

import { analyzeVisibility } from "./visibility";

const validResponse = {
  location: { latitude_deg: -85.2, longitude_deg: 32.5 },
  start_utc: "2026-11-20T00:00:00Z", end_utc: "2026-11-20T01:00:00Z", duration_hours: 1, sampling_minutes: 60,
  metrics: { sunlight_percent: 100, earth_visibility_percent: 100, longest_darkness_hours: 0, longest_earth_gap_hours: 0 },
  model: { type: "simplified_geometric_horizon", horizon_degrees: 0, site_altitude_km: 0, terrain_obstruction_included: false, sampling_method: "hourly_midpoints", source: "NASA JPL Horizons", lunar_reference_frame: "MOON_ME", lunar_radii_km: [1737.4, 1737.4, 1737.4], limitations: [] },
  timeline: [{ interval_start_utc: "2026-11-20T00:00:00Z", interval_end_utc: "2026-11-20T01:00:00Z", sample_utc: "2026-11-20T00:30:00Z", sun_azimuth_deg: 0, sun_elevation_deg: 1, earth_azimuth_deg: 0, earth_elevation_deg: 1, sun_visible: true, earth_visible: true }],
};

afterEach(() => vi.unstubAllGlobals());

describe("analyzeVisibility", () => {
  it("sends the selected site and UTC window to the shared backend endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(validResponse), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await analyzeVisibility({ latitude_deg: -85.2, longitude_deg: 32.5, start_utc: "2026-11-20T00:00:00Z", duration_hours: 1 });

    expect(fetchMock).toHaveBeenCalledWith("/api/analyze", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ latitude_deg: -85.2, longitude_deg: 32.5, start_utc: "2026-11-20T00:00:00Z", duration_hours: 1 }),
    }));
  });
});
