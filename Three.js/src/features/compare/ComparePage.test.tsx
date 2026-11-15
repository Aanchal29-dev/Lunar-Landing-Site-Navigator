import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { PlanProvider } from "../../app/PlanProvider";
import { ComparePage } from "./ComparePage";

const analysis = { location: { latitude_deg: -85.2, longitude_deg: 32.5 }, start_utc: "2026-11-20T00:00:00Z", end_utc: "2026-11-20T01:00:00Z", duration_hours: 1, sampling_minutes: 60, metrics: { sunlight_percent: 100, earth_visibility_percent: 80, longest_darkness_hours: 0, longest_earth_gap_hours: 1 }, model: { type: "simplified_geometric_horizon", horizon_degrees: 0, site_altitude_km: 0, terrain_obstruction_included: false, sampling_method: "hourly_midpoints", source: "NASA JPL Horizons", lunar_reference_frame: "MOON_ME", lunar_radii_km: [1737.4, 1737.4, 1737.4], limitations: [] }, timeline: [{ interval_start_utc: "2026-11-20T00:00:00Z", interval_end_utc: "2026-11-20T01:00:00Z", sample_utc: "2026-11-20T00:30:00Z", sun_azimuth_deg: 0, sun_elevation_deg: 1, earth_azimuth_deg: 0, earth_elevation_deg: 1, sun_visible: true, earth_visible: true }] };
const response = { start_utc: analysis.start_utc, duration_hours: 1, results: ["Site A", "Site B"].map((label) => ({ label, latitude_deg: -85.2, longitude_deg: 32.5, status: "ok", error: null, visibility: analysis, terrain: null, terrain_available: false })), tradeoffs: ["Trade-off from backend."], provenance: { source_measurements: [], calculated_estimates: [], assumed_values: [], unavailable_information: [] } };

afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals(); });

describe("ComparePage", () => {
  it("sends two user-selected locations to the shared comparison endpoint before showing trade-offs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><PlanProvider><ComparePage /></PlanProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Use these coordinates" }));
    fireEvent.change(screen.getByLabelText("Longitude, east-positive"), { target: { value: "33.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Use these coordinates" }));
    fireEvent.click(screen.getByRole("button", { name: "Compare locations" }));

    expect(await screen.findByRole("heading", { name: "Location trade-offs" })).not.toBeNull();
    expect(screen.getByText("Trade-off from backend.")).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/compare", expect.objectContaining({ method: "POST" }));
  });
});
