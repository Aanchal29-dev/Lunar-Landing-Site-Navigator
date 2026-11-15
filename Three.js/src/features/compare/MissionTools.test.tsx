import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MissionTools } from "./MissionTools";

const analysis = { location: { latitude_deg: -85.2, longitude_deg: 32.5 }, start_utc: "2026-11-20T00:00:00Z", end_utc: "2026-11-20T01:00:00Z", duration_hours: 1, sampling_minutes: 60, metrics: { sunlight_percent: 100, earth_visibility_percent: 80, longest_darkness_hours: 0, longest_earth_gap_hours: 1 }, model: { type: "simplified_geometric_horizon", horizon_degrees: 0, site_altitude_km: 0, terrain_obstruction_included: false, sampling_method: "hourly_midpoints", source: "NASA JPL Horizons", lunar_reference_frame: "MOON_ME", lunar_radii_km: [1737.4, 1737.4, 1737.4], limitations: [] }, timeline: [{ interval_start_utc: "2026-11-20T00:00:00Z", interval_end_utc: "2026-11-20T01:00:00Z", sample_utc: "2026-11-20T00:30:00Z", sun_azimuth_deg: 0, sun_elevation_deg: 1, earth_azimuth_deg: 0, earth_elevation_deg: 1, sun_visible: true, earth_visible: true }] };
const provenance = { source_measurements: [], calculated_estimates: [], assumed_values: [], unavailable_information: [] };
const stress = { latitude_deg: -85.2, longitude_deg: 32.5, baseline: analysis, variant: analysis, deltas: { sunlight_percent_delta: 1, earth_visibility_percent_delta: -1, longest_darkness_hours_delta: 0, longest_earth_gap_hours_delta: 0, duration_hours_delta: 0 }, warnings: [], provenance };
const candidate = { offset_days: 0, start_utc: analysis.start_utc, status: "ok", error: null, visibility: analysis, score: 1 };
const windows = { latitude_deg: -85.2, longitude_deg: 32.5, duration_hours: 1, selection_criteria: "Balanced", tested_offsets_days: [-3, 0], evaluated_windows: [{ ...candidate, offset_days: -3 }, candidate], preferred_window: { ...candidate }, tradeoffs: [], is_globally_optimal: false, provenance };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("MissionTools", () => {
  it("runs bounded stress and alternative-window backend requests", async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url === "/api/stress-test" ? stress : windows), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    render(<MissionTools coordinate={{ latitude_deg: -85.2, longitude_deg: 32.5 }} label="Site A" baseline={{ start_utc: analysis.start_utc, duration_hours: 1 }} />);

    fireEvent.click(screen.getByRole("button", { name: "Evaluate alternate window" }));
    expect(await screen.findByRole("heading", { name: "Variant minus baseline" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Evaluate other dates" }));
    expect(await screen.findByText(/Preferred among tested/)).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/stress-test", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/mission-windows", expect.objectContaining({ method: "POST" }));
  });
});
