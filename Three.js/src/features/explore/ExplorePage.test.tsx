import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { PlanProvider } from "../../app/PlanProvider";
import { ExplorePage } from "./ExplorePage";

vi.mock("./LunarGlobe", () => ({
  LunarGlobe: ({ onSelect }: { onSelect: (coordinate: { latitude_deg: number; longitude_deg: number }) => void }) => (
    <button onClick={() => onSelect({ latitude_deg: -85.2, longitude_deg: 32.5 })}>Select test site</button>
  ),
}));

const response = {
  location: { latitude_deg: -85.2, longitude_deg: 32.5 },
  start_utc: "2026-11-20T00:00:00Z", end_utc: "2026-11-20T01:00:00Z", duration_hours: 1, sampling_minutes: 60,
  metrics: { sunlight_percent: 100, earth_visibility_percent: 100, longest_darkness_hours: 0, longest_earth_gap_hours: 0 },
  model: { type: "simplified_geometric_horizon", horizon_degrees: 0, site_altitude_km: 0, terrain_obstruction_included: false, sampling_method: "hourly_midpoints", source: "NASA JPL Horizons", lunar_reference_frame: "MOON_ME", lunar_radii_km: [1737.4, 1737.4, 1737.4], limitations: ["Simplified horizon."] },
  timeline: [{ interval_start_utc: "2026-11-20T00:00:00Z", interval_end_utc: "2026-11-20T01:00:00Z", sample_utc: "2026-11-20T00:30:00Z", sun_azimuth_deg: 0, sun_elevation_deg: 1, earth_azimuth_deg: 0, earth_elevation_deg: 1, sun_visible: true, earth_visible: true }],
};

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("ExplorePage analysis workflow", () => {
  it("renders results only after the selected plan succeeds against the real API boundary", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><PlanProvider><ExplorePage /></PlanProvider></MemoryRouter>);

    expect(screen.queryByRole("heading", { name: "Sun and Earth visibility" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Duration (hours)"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save mission window" }));
    fireEvent.click(await screen.findByRole("button", { name: "Select test site" }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze Sun and Earth visibility" }));

    expect(await screen.findByRole("heading", { name: "Sun and Earth visibility" })).not.toBeNull();
    expect(screen.getAllByText("100.0%")).toHaveLength(2);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/analyze", expect.objectContaining({ method: "POST" })));
  });
});
