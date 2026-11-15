import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TerrainScreening } from "./TerrainScreening";

const response = {
  terrain_available: true, location: { latitude_deg: -85.2, longitude_deg: 32.5 },
  pixel: { row: 10, column: 11, elevation_m: 1234.5, slope_deg: 4.2 },
  region: { analysis_radius_m: 500, mean_elevation_m: 1230, elevation_range_m: 24, mean_slope_deg: 3.5, maximum_slope_deg: 7.5, elevation_stddev_m_roughness_proxy: 2.2, valid_pixel_count: 100, total_pixel_count: 100, valid_pixel_percentage: 100, valid_data_percentage: 100, requested_area_coverage_percentage: 100, coverage_status: "in_raster" },
  raster: { resolution_m: 5, crs: "MOON_ME", dataset_provenance: "NASA LOLA", dataset_source_url: "https://example.test/lola", dataset_limitations: ["Regional data."] }, warnings: [],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TerrainScreening", () => {
  it("shows returned local-raster values only after the user requests them", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TerrainScreening coordinate={{ latitude_deg: -85.2, longitude_deg: 32.5 }} />);

    expect(screen.getByText(/No terrain values are shown/)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Check available terrain data" }));

    expect(await screen.findByText("1234.5 m")).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/terrain/analyze", expect.objectContaining({ method: "POST" }));
  });

  it("keeps outside-coverage terrain explicitly unavailable instead of inventing a measurement", async () => {
    const unavailable = {
      ...response,
      terrain_available: false,
      pixel: { row: null, column: null, elevation_m: null, slope_deg: null },
      region: { ...response.region, mean_elevation_m: null, elevation_range_m: null, mean_slope_deg: null, maximum_slope_deg: null, elevation_stddev_m_roughness_proxy: null, valid_pixel_count: 0, total_pixel_count: 0, valid_pixel_percentage: 0, valid_data_percentage: 0, requested_area_coverage_percentage: 0, coverage_status: "outside_raster" },
      warnings: ["Coordinate lies outside the available raster coverage."],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(unavailable), { status: 200 })));
    render(<TerrainScreening coordinate={{ latitude_deg: -85.2, longitude_deg: 32.5 }} />);

    fireEvent.click(screen.getByRole("button", { name: "Check available terrain data" }));

    expect(await screen.findByRole("heading", { name: "No terrain measurements are available for this location" })).not.toBeNull();
    expect(screen.getByText(/does not substitute flat terrain/)).not.toBeNull();
  });
});
