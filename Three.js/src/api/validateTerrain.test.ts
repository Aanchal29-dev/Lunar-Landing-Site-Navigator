import { describe, expect, it } from "vitest";

import { assertTerrainResponse } from "./validateTerrain";

const valid = {
  terrain_available: false, location: { latitude_deg: -85.2, longitude_deg: 32.5 },
  pixel: { row: null, column: null, elevation_m: null, slope_deg: null },
  region: { analysis_radius_m: 500, mean_elevation_m: null, elevation_range_m: null, mean_slope_deg: null, maximum_slope_deg: null, elevation_stddev_m_roughness_proxy: null, valid_pixel_count: 0, total_pixel_count: 0, valid_pixel_percentage: 0, valid_data_percentage: 0, requested_area_coverage_percentage: 0, coverage_status: "outside_raster" },
  raster: { resolution_m: 5, crs: "MOON_ME", dataset_provenance: "NASA LOLA", dataset_source_url: "https://example.test/lola", dataset_limitations: ["Regional data."] }, warnings: ["Outside coverage."],
};

describe("terrain response boundary", () => {
  it("accepts an explicit unavailable-terrain response without inventing measurements", () => expect(assertTerrainResponse(valid)).toBe(valid));
  it("rejects malformed terrain metrics", () => expect(() => assertTerrainResponse({ ...valid, region: { ...valid.region, analysis_radius_m: "500" } })).toThrow("invalid measurement"));
});
